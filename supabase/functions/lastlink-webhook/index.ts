// Edge Function: lastlink-webhook  (v2)
// Recebe os webhooks da Lastlink (Postback / Notifications) e:
//   1) Salva o payload bruto em `lastlink_events` (auditoria + flag is_test).
//   2) Faz match do lead pelo email do comprador.
//   3) Atualiza trial_leads com TODOS os campos úteis: pagamento, comprador,
//      oferta, afiliado, UTMs, link de fatura, próxima cobrança, etc.
//   4) Em compras confirmadas → força status='converted' (impede re-kick).
//   5) Em cancelamento/refund → atualiza subscription_status (não kicka).
//
// SEGURANÇA:
//   - Valida `?token=` da query contra o secret `LASTLINK_WEBHOOK_TOKEN`.
//
// COMO CONFIGURAR NO PAINEL DA LASTLINK:
//   URL: https://wspsuempnswljkphatur.supabase.co/functions/v1/lastlink-webhook?token=<TOKEN>
//   Eventos: marcar TODOS (17 eventos) — o handler ignora os irrelevantes.
//
// V2 (02/05/2026): payload da Lastlink inspecionado em produção.
//   - PaymentMethod corrigido p/ Data.Purchase.Payment.PaymentMethod
//   - Eventos REAIS de refund: Payment_Refund / Payment_Chargeback
//   - Captura: CPF, telefone, nome, endereço, oferta, afiliado, parcelas,
//     próxima cobrança, link da fatura, UTMs, flag is_test.
//
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const log = (event: string, data: Record<string, unknown>) => {
  console.log(JSON.stringify({ tag: "lastlink-webhook", event, ...data }));
};

const PAID_EVENTS = new Set([
  "Purchase_Order_Confirmed",     // cartão aprovado
  "Purchase_Request_Confirmed",   // pix/boleto pago
  "Recurrent_Payment",            // renovação cobrada
]);

const CANCELED_EVENTS = new Set([
  "Subscription_Canceled",
  "Subscription_Expired",
  "Product_Access_Ended",
]);

const REFUNDED_EVENTS = new Set([
  "Payment_Refund",
  "Payment_Chargeback",
]);

const REFUND_REQUESTED_EVENTS = new Set([
  "Refund_Requested",
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

function toIsoOrNull(s: unknown): string | null {
  if (typeof s !== "string" || !s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

const CRITICAL_ALERT_EVENTS = new Set<string>([
  "Subscription_Canceled",
  "Payment_Refund",
  "Payment_Chargeback",
  "Refund_Requested",
]);

const ALERT_EVENT_LABELS: Record<string, string> = {
  Subscription_Canceled: "🛑 Assinatura cancelada",
  Payment_Refund: "↩️ Reembolso processado",
  Payment_Chargeback: "⚠️ Chargeback recebido",
  Refund_Requested: "📩 Reembolso solicitado",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Manda DM/aviso pro chat de alertas configurado, se houver.
 * Best-effort: nunca quebra o webhook em caso de erro.
 */
async function sendAlertTelegramDM(args: {
  eventType: string;
  buyerName: string | null;
  buyerEmail: string | null;
  amount: number | null;
  currency: string;
  reason: string | null;
  leadId: string | null;
  isTest: boolean;
}): Promise<void> {
  if (!CRITICAL_ALERT_EVENTS.has(args.eventType)) return;
  if (args.isTest) return;
  const botToken =
    Deno.env.get("TELEGRAM_LASTLINK_ALERT_BOT_TOKEN") ??
    Deno.env.get("TELEGRAM_TRIAL_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_LASTLINK_ALERT_CHAT_ID");
  if (!botToken || !chatId) {
    log("alert-telegram-skipped", {
      reason: "missing-config",
      has_token: !!botToken,
      has_chat: !!chatId,
    });
    return;
  }

  const label = ALERT_EVENT_LABELS[args.eventType] ?? args.eventType;
  const lines: string[] = [`<b>${escapeHtml(label)}</b>`];
  const who = args.buyerName ?? args.buyerEmail ?? "Cliente desconhecido";
  lines.push(`👤 ${escapeHtml(who)}`);
  if (args.buyerEmail && args.buyerEmail !== who) lines.push(`✉️ ${escapeHtml(args.buyerEmail)}`);
  if (args.amount != null) {
    try {
      const fmt = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: (args.currency || "BRL").toUpperCase(),
        maximumFractionDigits: 2,
      }).format(args.amount);
      lines.push(`💰 ${escapeHtml(fmt)}`);
    } catch {
      lines.push(`💰 ${args.amount.toFixed(2)} ${escapeHtml(args.currency)}`);
    }
  }
  if (args.reason) lines.push(`📝 Motivo: ${escapeHtml(args.reason)}`);

  const baseUrl = (Deno.env.get("APP_BASE_URL") ?? Deno.env.get("ADMIN_BASE_URL") ?? "")
    .replace(/\/+$/, "");
  const adminUrl = baseUrl
    ? (args.leadId
        ? `${baseUrl}/lastlink-admin?lead=${encodeURIComponent(args.leadId)}`
        : `${baseUrl}/lastlink-admin`)
    : null;

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (adminUrl) {
      body.reply_markup = {
        inline_keyboard: [[{ text: "Ver no Lastlink Admin", url: adminUrl }]],
      };
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      log("alert-telegram-failed", { status: res.status, body: txt.slice(0, 300) });
    } else {
      log("alert-telegram-sent", { event: args.eventType, lead_id: args.leadId });
    }
  } catch (err) {
    log("alert-telegram-error", { error: String(err) });
  }
}

Deno.serve(async (req) => {
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

    // ===== Parse =====
    const eventType: string =
      pick<string>(payload, "Event", "event", "EventType", "type") ?? "Unknown";
    const eventId = pick<string>(payload, "Id", "id");
    const isTest = Boolean(pick<boolean>(payload, "IsTest", "isTest"));
    const data: any = pick(payload, "Data", "data") ?? payload;

    // Buyer
    const buyerEmail = normalizeEmail(
      pick(data, "Buyer.Email", "buyer.email", "Customer.Email", "customer.email", "Email"),
    );
    const buyerName = pick<string>(data, "Buyer.Name", "buyer.name", "Customer.Name");
    const buyerDocument = pick<string>(data, "Buyer.Document", "buyer.document");
    const buyerPhone = pick<string>(data, "Buyer.PhoneNumber", "buyer.phoneNumber", "Buyer.Phone");
    const buyerAddress = pick<unknown>(data, "Buyer.Address", "buyer.address");

    // Identifiers
    const orderId = pick<string>(
      data,
      "Purchase.OrderId", "purchase.orderId",
      "Purchase.Id", "purchase.id",
      "OrderId", "orderId",
    );
    const subscriptionId = pick<string>(
      data,
      "Subscriptions.0.Id", "subscriptions.0.id",
      "Subscription.Id", "subscription.id",
      "SubscriptionId",
    );
    const productId = pick<string>(
      data,
      "Products.0.Id", "products.0.id",
      "Subscriptions.0.ProductId", "subscriptions.0.productId",
      "Product.Id", "ProductId",
    );
    const productName = pick<string>(
      data,
      "Products.0.Name", "products.0.name",
      "Product.Name", "ProductName",
    );

    // Offer
    const offerId = pick<string>(data, "Offer.Id", "offer.id");
    const offerName = pick<string>(data, "Offer.Name", "offer.name");
    const offerUrl = pick<string>(data, "Offer.Url", "offer.url");

    // Purchase / Payment
    const paymentId = pick<string>(data, "Purchase.PaymentId", "purchase.paymentId");
    const paymentMethod = pick<string>(
      data,
      "Purchase.Payment.PaymentMethod", "purchase.payment.paymentMethod",  // V2: caminho REAL da Lastlink
      "Purchase.PaymentMethod", "purchase.paymentMethod",                   // fallback legacy
      "PaymentMethod",
    );
    const installments = pick<number>(
      data,
      "Purchase.Payment.NumberOfInstallments", "purchase.payment.numberOfInstallments",
    );
    const priceValue = toNumberOrNull(pick(
      data,
      "Purchase.Price.Value", "purchase.price.value",
      "Price.Value", "price.value", "Price", "price", "Amount", "amount",
    ));
    const priceCurrency = pick<string>(
      data,
      "Purchase.Price.Currency", "purchase.price.currency",
      "Price.Currency", "Currency",
    ) ?? "BRL";
    const originalPrice = toNumberOrNull(pick(
      data,
      "Purchase.OriginalPrice.Value", "purchase.originalPrice.value",
    ));
    const recurrency = pick<number>(data, "Purchase.Recurrency", "purchase.recurrency");
    const nextBilling = toIsoOrNull(pick(data, "Purchase.NextBilling", "purchase.nextBilling"));
    const invoiceUrl = pick<string>(data, "Purchase.InvoiceUrl", "purchase.invoiceUrl");
    const originUrl = pick<string>(data, "Purchase.OriginUrl", "purchase.originUrl");
    const affiliateEmail = pick<string>(
      data,
      "Purchase.Affiliate.Email", "purchase.affiliate.email",
    );
    const couponCode = pick<string>(
      data,
      "Purchase.Coupon.Code", "purchase.coupon.code",
      "Coupon.Code", "coupon.code", "Coupon", "coupon",
    );
    const utm = pick<unknown>(data, "Utm", "utm");

    const cancelOrRefundReason = pick<string>(
      data,
      "Reason", "reason",
      "RefundReason", "refundReason",
      "CancelReason", "cancelReason",
      "CancellationReason", "cancellationReason",
      "Subscription.CancelReason", "subscription.cancelReason",
      "Subscriptions.0.CancelReason", "subscriptions.0.cancelReason",
      "Purchase.CancelReason", "purchase.cancelReason",
      "Purchase.RefundReason", "purchase.refundReason",
    ) ?? null;

    const paidAt = toIsoOrNull(
      pick(data, "Purchase.PaymentDate", "purchase.paymentDate", "PaymentDate"),
    ) ?? new Date().toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ===== Match do lead =====
    let leadId: string | null = null;
    let matchedVia: string | null = null;

    if (buyerEmail && !isTest) {
      const { data: byEmail } = await supabase
        .from("trial_leads")
        .select("id")
        .eq("email", buyerEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byEmail) { leadId = byEmail.id; matchedVia = "email"; }
    }
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

    // ===== Auditoria (sempre) =====
    await supabase.from("lastlink_events").insert({
      event_type: eventType,
      order_id: orderId ?? null,
      buyer_email: buyerEmail ?? null,
      matched_lead: leadId,
      is_test: isTest,
      payload,
    });

    // ===== Update do lead se achamos =====
    if (leadId) {
      const updates: Record<string, unknown> = {
        lastlink_last_event: eventType,
        lastlink_last_event_at: new Date().toISOString(),
        lastlink_event_id: eventId ?? null,
        lastlink_is_test: isTest,
        lastlink_raw: payload,
      };

      if (orderId) updates.lastlink_order_id = orderId;
      if (subscriptionId) updates.lastlink_subscription_id = subscriptionId;
      if (productId) updates.lastlink_product_id = productId;
      if (productName) updates.plan_name = productName;
      if (paymentId) updates.lastlink_payment_id = paymentId;
      if (paymentMethod) updates.payment_method = paymentMethod;
      if (installments != null) updates.installments = installments;
      if (priceValue != null) updates.paid_amount = priceValue;
      if (priceCurrency) updates.paid_currency = priceCurrency;
      if (originalPrice != null) updates.original_price = originalPrice;
      if (recurrency != null) updates.recurrency_months = recurrency;
      if (nextBilling) updates.next_billing_at = nextBilling;
      if (invoiceUrl) updates.lastlink_invoice_url = invoiceUrl;
      if (originUrl) updates.lastlink_origin_url = originUrl;
      if (affiliateEmail) updates.lastlink_affiliate_email = affiliateEmail;
      if (couponCode) updates.coupon_code = couponCode;
      if (utm) updates.lastlink_utm = utm;
      if (offerId) updates.lastlink_offer_id = offerId;
      if (offerName) updates.lastlink_offer_name = offerName;
      if (offerUrl) updates.lastlink_offer_url = offerUrl;
      if (buyerName) updates.buyer_name = buyerName;
      if (buyerDocument) updates.buyer_document = buyerDocument;
      if (buyerPhone) updates.buyer_phone = buyerPhone;
      if (buyerAddress) updates.buyer_address = buyerAddress;

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
      } else if (REFUND_REQUESTED_EVENTS.has(eventType)) {
        updates.subscription_status = "refund_requested";
      }

      const { error: upErr } = await supabase
        .from("trial_leads")
        .update(updates)
        .eq("id", leadId);
      if (upErr) console.error("lastlink update failed", upErr);

      log("matched", {
        event: eventType,
        is_test: isTest,
        lead_id: leadId,
        matched_via: matchedVia,
        order_id: orderId ?? null,
        subscription_id: subscriptionId ?? null,
        amount: priceValue,
        plan: productName ?? null,
        coupon: couponCode ?? null,
        affiliate: affiliateEmail ?? null,
      });

      // Alerta best-effort no Telegram (eventos críticos). Nunca quebra a resposta.
      await sendAlertTelegramDM({
        eventType,
        buyerName: buyerName ?? null,
        buyerEmail: buyerEmail ?? null,
        amount: priceValue,
        currency: priceCurrency,
        reason: cancelOrRefundReason,
        leadId,
        isTest,
      }).catch((err) => log("alert-telegram-throw", { error: String(err) }));

      // Push notification best-effort para assinatura pendente / cancelamento
      if (!isTest && leadId) {
        const PUSH_NOTIFY_EVENTS = new Set([
          "Purchase_Order_Pending",
          "Purchase_Order_Expired",
          ...CANCELED_EVENTS,
        ]);
        if (PUSH_NOTIFY_EVENTS.has(eventType)) {
          const pushType = CANCELED_EVENTS.has(eventType) ? "subscription_canceled"
            : eventType === "Purchase_Order_Expired" ? "subscription_expired"
            : "subscription_pending";
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({ type: pushType, lead_id: leadId, triggered_by: "lastlink-webhook" }),
          }).catch((err) => log("push-notification-throw", { error: String(err) }));
        }
      }

      return json({ ok: true, action: "matched", event: eventType, lead_id: leadId, is_test: isTest });
    }

    // Sem match por email/order/subscription — se for evento de compra E tiver
    // email, cria um novo lead com cohort='direct' (compra direta, sem trial).
    // Isso garante que compradores que não passaram pelo trial apareçam na aba
    // Lastlink Admin do BetShark.
    const LEAD_CREATION_EVENTS = new Set([
      ...PAID_EVENTS,
      ...CANCELED_EVENTS,
      ...REFUNDED_EVENTS,
      ...REFUND_REQUESTED_EVENTS,
    ]);

    if (buyerEmail && !isTest && LEAD_CREATION_EVENTS.has(eventType)) {
      const newLead: Record<string, unknown> = {
        name: buyerName || buyerEmail.split("@")[0],
        email: buyerEmail,
        // whatsapp e telegram_username têm UNIQUE constraint; pra compras diretas
        // (sem trial), usamos placeholders únicos baseados no email. Se tiver
        // telefone real do buyer, usamos ele pra whatsapp.
        whatsapp: buyerPhone || `direct_${buyerEmail}`,
        telegram_username: `direct_${buyerEmail}`,
        status: PAID_EVENTS.has(eventType) ? "converted" : "pending",
        cohort: "direct",
        lastlink_last_event: eventType,
        lastlink_last_event_at: new Date().toISOString(),
        lastlink_event_id: eventId ?? null,
        lastlink_is_test: false,
        lastlink_raw: payload,
      };
      if (orderId) newLead.lastlink_order_id = orderId;
      if (subscriptionId) newLead.lastlink_subscription_id = subscriptionId;
      if (productId) newLead.lastlink_product_id = productId;
      if (productName) newLead.plan_name = productName;
      if (paymentId) newLead.lastlink_payment_id = paymentId;
      if (paymentMethod) newLead.payment_method = paymentMethod;
      if (installments != null) newLead.installments = installments;
      if (priceValue != null) newLead.paid_amount = priceValue;
      if (priceCurrency) newLead.paid_currency = priceCurrency;
      if (originalPrice != null) newLead.original_price = originalPrice;
      if (recurrency != null) newLead.recurrency_months = recurrency;
      if (nextBilling) newLead.next_billing_at = nextBilling;
      if (invoiceUrl) newLead.lastlink_invoice_url = invoiceUrl;
      if (originUrl) newLead.lastlink_origin_url = originUrl;
      if (affiliateEmail) newLead.lastlink_affiliate_email = affiliateEmail;
      if (couponCode) newLead.coupon_code = couponCode;
      if (utm) newLead.lastlink_utm = utm;
      if (offerId) newLead.lastlink_offer_id = offerId;
      if (offerName) newLead.lastlink_offer_name = offerName;
      if (offerUrl) newLead.lastlink_offer_url = offerUrl;
      if (buyerName) newLead.buyer_name = buyerName;
      if (buyerDocument) newLead.buyer_document = buyerDocument;
      if (buyerPhone) newLead.buyer_phone = buyerPhone;
      if (buyerAddress) newLead.buyer_address = buyerAddress;
      if (PAID_EVENTS.has(eventType)) {
        newLead.paid_at = paidAt;
        newLead.subscription_status = "active";
      } else if (CANCELED_EVENTS.has(eventType)) {
        newLead.subscription_status = "canceled";
        newLead.canceled_at = new Date().toISOString();
      } else if (REFUNDED_EVENTS.has(eventType)) {
        newLead.subscription_status = "refunded";
        newLead.refunded_at = new Date().toISOString();
      } else if (REFUND_REQUESTED_EVENTS.has(eventType)) {
        newLead.subscription_status = "refund_requested";
      }

      const { data: created, error: insErr } = await supabase
        .from("trial_leads")
        .insert(newLead)
        .select("id")
        .single();

      if (insErr) {
        console.error("lastlink create-lead failed", insErr);
      } else {
        leadId = created.id;
        // Atualiza o evento de auditoria com o lead recém-criado
        await supabase
          .from("lastlink_events")
          .update({ matched_lead: created.id })
          .eq("id", (await supabase.from("lastlink_events").select("id").eq("buyer_email", buyerEmail).order("received_at", { ascending: false }).limit(1).single()).data?.id ?? "");

        log("created-direct", {
          event: eventType,
          lead_id: created.id,
          buyer_email: buyerEmail,
          amount: priceValue,
        });

        await sendAlertTelegramDM({
          eventType,
          buyerName: buyerName ?? null,
          buyerEmail: buyerEmail ?? null,
          amount: priceValue,
          currency: priceCurrency,
          reason: cancelOrRefundReason,
          leadId: created.id,
          isTest,
        }).catch((err) => log("alert-telegram-throw", { error: String(err) }));

        return json({ ok: true, action: "created-direct", event: eventType, lead_id: created.id });
      }
    }

    log("no-match", {
      event: eventType,
      is_test: isTest,
      order_id: orderId ?? null,
      buyer_email: buyerEmail ?? null,
    });

    // Mesmo sem match, eventos críticos merecem alerta no Telegram.
    await sendAlertTelegramDM({
      eventType,
      buyerName: buyerName ?? null,
      buyerEmail: buyerEmail ?? null,
      amount: priceValue,
      currency: priceCurrency,
      reason: cancelOrRefundReason,
      leadId: null,
      isTest,
    }).catch((err) => log("alert-telegram-throw", { error: String(err) }));

    return json({ ok: true, action: "no-match", event: eventType, is_test: isTest });
  } catch (err) {
    console.error("lastlink-webhook unexpected", err);
    return json({ ok: false, error: "internal error" }, { status: 500 });
  }
});
