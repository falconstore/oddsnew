// Edge Function: lastlink-webhook
// Recebe os webhooks da Lastlink (Postback / Notifications) e:
//   1) Salva o payload bruto em `lastlink_events` (auditoria).
//   2) Faz match do lead pelo email do comprador (campo mais confiável).
//   3) Atualiza trial_leads com order_id, valor, plano, cupom, etc.
//   4) Em compras confirmadas → força status='converted' (impede re-kick
//      pelo trial-webhook caso o cliente seja re-adicionado depois).
//   5) Em cancelamento/refund → atualiza subscription_status mas NÃO
//      kicka — o operador decide manualmente no painel.
//
// SEGURANÇA:
//   - Valida o `?token=` da query contra o secret `LASTLINK_WEBHOOK_TOKEN`
//     configurado nas Edge Function secrets do projeto.
//
// COMO CONFIGURAR NO PAINEL DA LASTLINK:
//   URL do webhook:
//     https://wspsuempnswljkphatur.supabase.co/functions/v1/lastlink-webhook?token=<TOKEN>
//   Eventos a habilitar:
//     - Purchase_Order_Confirmed
//     - Recurrent_Payment
//     - Purchase_Refund / Purchase_Chargeback
//     - Subscription_Canceled / Subscription_Expired
//
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown>) => {
  console.log(JSON.stringify({ tag: "lastlink-webhook", event, ...data }));
};

const PAID_EVENTS = new Set([
  "Purchase_Order_Confirmed",
  "Purchase_Request_Confirmed",
  "Recurrent_Payment",
]);

const CANCELED_EVENTS = new Set([
  "Subscription_Canceled",
  "Subscription_Expired",
]);

const REFUNDED_EVENTS = new Set([
  "Purchase_Refund",
  "Purchase_Chargeback",
]);

function pick<T = unknown>(obj: any, ...paths: string[]): T | undefined {
  for (const path of paths) {
    let cur: any = obj;
    for (const seg of path.split(".")) {
      if (cur == null) break;
      cur = cur[seg];
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

function normalizeEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim().toLowerCase();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, { status: 405 });

  try {
    const expectedToken = Deno.env.get("LASTLINK_WEBHOOK_TOKEN");
    if (!expectedToken) {
      console.error("lastlink-webhook: LASTLINK_WEBHOOK_TOKEN is not configured");
      return json({ ok: false, error: "webhook token not configured" }, { status: 500 });
    }

    const url = new URL(req.url);
    const queryToken =
      url.searchParams.get("token") ??
      url.searchParams.get("secret") ??
      req.headers.get("x-lastlink-token") ??
      req.headers.get("x-webhook-token");

    if (queryToken !== expectedToken) {
      log("invalid-token", { has_query: !!queryToken });
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));

    // A Lastlink envia o payload em duas convenções:
    //   { Event: "...", Data: { ... } }      (formato moderno)
    //   { event: "...", data: { ... } }     (formato legacy)
    // Tratamos os dois normalizando para minúsculo na hora de ler.
    const eventType: string =
      pick<string>(payload, "Event", "event", "EventType", "type") ?? "Unknown";
    const data: any = pick(payload, "Data", "data") ?? payload;

    const buyerEmail = normalizeEmail(
      pick(data, "Buyer.Email", "buyer.email", "Customer.Email", "customer.email", "Email"),
    );

    const orderId = pick<string>(
      data,
      "Purchase.OrderId", "purchase.orderId",
      "Purchase.Id", "purchase.id",
      "OrderId", "orderId", "Id", "id",
    );

    const subscriptionId = pick<string>(
      data,
      "Subscriptions.0.Id", "subscriptions.0.id",
      "Subscription.Id", "subscription.id",
      "SubscriptionId", "subscriptionId",
    );

    const productId = pick<string>(
      data,
      "Products.0.Id", "products.0.id",
      "Product.Id", "product.id",
      "ProductId", "productId",
    );

    const productName = pick<string>(
      data,
      "Products.0.Name", "products.0.name",
      "Product.Name", "product.name",
      "ProductName", "productName",
    );

    const priceValue = pick<number | string>(
      data,
      "Purchase.Price.Value", "purchase.price.value",
      "Purchase.Total", "purchase.total",
      "Price.Value", "price.value",
      "Price", "price", "Amount", "amount",
    );
    const priceCurrency = pick<string>(
      data,
      "Purchase.Price.Currency", "purchase.price.currency",
      "Price.Currency", "price.currency",
      "Currency", "currency",
    ) ?? "BRL";

    const paymentMethod = pick<string>(
      data,
      "Purchase.PaymentMethod", "purchase.paymentMethod",
      "PaymentMethod", "paymentMethod",
    );

    const couponCode = pick<string>(
      data,
      "Purchase.Coupon.Code", "purchase.coupon.code",
      "Coupon.Code", "coupon.code",
      "Coupon", "coupon",
    );

    const paymentDateRaw = pick<string>(
      data,
      "Purchase.PaymentDate", "purchase.paymentDate",
      "PaymentDate", "paymentDate",
      "Purchase.CreatedDate", "purchase.createdDate",
    );
    const paidAt = paymentDateRaw ? new Date(paymentDateRaw).toISOString() : new Date().toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ===== 1) Tenta achar o lead =====
    let leadId: string | null = null;
    let matchedVia: string | null = null;

    if (buyerEmail) {
      const { data: byEmail } = await supabase
        .from("trial_leads")
        .select("id")
        .eq("email", buyerEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byEmail) { leadId = byEmail.id; matchedVia = "email"; }
    }

    // Fallback: se já temos lastlink_order_id de evento anterior, casa por aí.
    if (!leadId && orderId) {
      const { data: byOrder } = await supabase
        .from("trial_leads")
        .select("id")
        .eq("lastlink_order_id", orderId)
        .limit(1)
        .maybeSingle();
      if (byOrder) { leadId = byOrder.id; matchedVia = "order_id"; }
    }

    if (!leadId && subscriptionId) {
      const { data: bySub } = await supabase
        .from("trial_leads")
        .select("id")
        .eq("lastlink_subscription_id", subscriptionId)
        .limit(1)
        .maybeSingle();
      if (bySub) { leadId = bySub.id; matchedVia = "subscription_id"; }
    }

    // ===== 2) Salva sempre o evento bruto (auditoria) =====
    await supabase.from("lastlink_events").insert({
      event_type: eventType,
      order_id: orderId ?? null,
      buyer_email: buyerEmail ?? null,
      matched_lead: leadId,
      payload,
    });

    // ===== 3) Atualiza o lead se achamos =====
    if (leadId) {
      const updates: Record<string, unknown> = {
        lastlink_last_event: eventType,
        lastlink_last_event_at: new Date().toISOString(),
        lastlink_raw: payload,
      };
      if (orderId) updates.lastlink_order_id = orderId;
      if (subscriptionId) updates.lastlink_subscription_id = subscriptionId;
      if (productId) updates.lastlink_product_id = productId;
      if (productName) updates.plan_name = productName;
      if (priceValue !== undefined) {
        const numeric = typeof priceValue === "string"
          ? Number(priceValue.replace(",", "."))
          : Number(priceValue);
        if (Number.isFinite(numeric)) updates.paid_amount = numeric;
      }
      if (priceCurrency) updates.paid_currency = priceCurrency;
      if (paymentMethod) updates.payment_method = paymentMethod;
      if (couponCode) updates.coupon_code = couponCode;

      if (PAID_EVENTS.has(eventType)) {
        updates.paid_at = paidAt;
        updates.subscription_status = "active";
        updates.status = "converted";
      } else if (CANCELED_EVENTS.has(eventType)) {
        updates.subscription_status = "canceled";
        updates.canceled_at = new Date().toISOString();
      } else if (REFUNDED_EVENTS.has(eventType)) {
        updates.subscription_status = "refunded";
        updates.refunded_at = new Date().toISOString();
      }

      const { error: upErr } = await supabase
        .from("trial_leads")
        .update(updates)
        .eq("id", leadId);
      if (upErr) console.error("lastlink update failed", upErr);

      log("matched", {
        event: eventType,
        lead_id: leadId,
        matched_via: matchedVia,
        order_id: orderId ?? null,
        subscription_id: subscriptionId ?? null,
        amount: updates.paid_amount ?? null,
        plan: productName ?? null,
        coupon: couponCode ?? null,
      });
      return json({ ok: true, action: "matched", event: eventType, lead_id: leadId });
    }

    log("no-match", {
      event: eventType,
      order_id: orderId ?? null,
      buyer_email: buyerEmail ?? null,
    });
    return json({ ok: true, action: "no-match", event: eventType });
  } catch (err) {
    console.error("lastlink-webhook unexpected", err);
    return json({ ok: false, error: "internal error" }, { status: 500 });
  }
});
