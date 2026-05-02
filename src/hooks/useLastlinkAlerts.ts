import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  REALTIME_LISTEN_TYPES,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
  type RealtimePostgresInsertPayload,
} from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { LastlinkEvent } from '@/types/trial';

const CRITICAL_EVENTS = new Set<string>([
  'Subscription_Canceled',
  'Payment_Refund',
  'Payment_Chargeback',
  'Refund_Requested',
]);

const EVENT_LABELS: Record<string, string> = {
  Subscription_Canceled: 'Assinatura cancelada',
  Payment_Refund: 'Reembolso processado',
  Payment_Chargeback: 'Chargeback recebido',
  Refund_Requested: 'Reembolso solicitado',
};

const EVENT_ICONS: Record<string, string> = {
  Subscription_Canceled: '🛑',
  Payment_Refund: '↩️',
  Payment_Chargeback: '⚠️',
  Refund_Requested: '📩',
};

/** Type guard: valor é um objeto plain (não null, não array). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Acessa um caminho ponto-separado em uma estrutura aninhada de
 * objetos/arrays sem usar `any`. Suporta índices numéricos pra arrays
 * (ex.: "Subscriptions.0.Id").
 */
function getAtPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const seg of path.split('.')) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx)) return undefined;
      cur = cur[idx];
    } else if (isPlainObject(cur)) {
      cur = cur[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Devolve o primeiro valor não-vazio entre os caminhos informados. */
function pickFirst(root: unknown, paths: readonly string[]): unknown {
  for (const path of paths) {
    const v = getAtPath(root, path);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function pickString(root: unknown, paths: readonly string[]): string | null {
  const v = pickFirst(root, paths);
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function pickNumber(root: unknown, paths: readonly string[]): number | null {
  const v = pickFirst(root, paths);
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmtMoney(value: number | null, currency: string = 'BRL'): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: (currency || 'BRL').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

function extractAlertInfo(row: LastlinkEvent) {
  const payload: unknown = row.payload ?? {};
  const data: unknown = isPlainObject(payload)
    ? (payload.Data ?? payload.data ?? payload)
    : payload;

  const buyerName =
    pickString(data, [
      'Buyer.Name', 'buyer.name', 'Customer.Name', 'customer.name',
    ]) ??
    row.buyer_email ??
    'Cliente desconhecido';

  const amountNum = pickNumber(data, [
    'Purchase.Price.Value', 'purchase.price.value',
    'Price.Value', 'price.value',
    'Amount', 'amount',
  ]);
  const currency =
    pickString(data, [
      'Purchase.Price.Currency', 'purchase.price.currency',
      'Price.Currency', 'Currency',
    ]) ?? 'BRL';
  const amount = fmtMoney(amountNum, currency);

  const reason = pickString(data, [
    'Reason', 'reason',
    'RefundReason', 'refundReason',
    'CancelReason', 'cancelReason',
    'CancellationReason', 'cancellationReason',
    'Subscription.CancelReason', 'subscription.cancelReason',
    'Subscriptions.0.CancelReason', 'subscriptions.0.cancelReason',
    'Purchase.CancelReason', 'purchase.cancelReason',
    'Purchase.RefundReason', 'purchase.refundReason',
  ]);

  return { buyerName, amount, reason };
}

interface UseLastlinkAlertsOptions {
  enabled?: boolean;
}

/**
 * Mounts a global realtime listener that fires a persistent red toast
 * whenever a critical Lastlink event arrives (cancelamento, refund,
 * chargeback ou pedido de reembolso). Deduplica por id da linha — não
 * dispara em cima de eventos já vistos na sessão.
 */
export const useLastlinkAlerts = ({ enabled = true }: UseLastlinkAlertsOptions = {}) => {
  const navigate = useNavigate();
  const seenIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel('lastlink-critical-alerts')
      .on(
        REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
        {
          event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT,
          schema: 'public',
          table: 'lastlink_events',
        },
        (payload: RealtimePostgresInsertPayload<LastlinkEvent>) => {
          const row = payload.new;
          if (!row || !row.event_type) return;
          if (!CRITICAL_EVENTS.has(row.event_type)) return;
          if (row.is_test) return;
          if (seenIdsRef.current.has(row.id)) return;
          seenIdsRef.current.add(row.id);

          const { buyerName, amount, reason } = extractAlertInfo(row);
          const label = EVENT_LABELS[row.event_type] ?? row.event_type;
          const icon = EVENT_ICONS[row.event_type] ?? '⚠️';

          const lines: string[] = [buyerName];
          if (amount) lines.push(amount);
          if (reason) lines.push(`Motivo: ${reason}`);

          toast.error(`${icon} ${label}`, {
            description: lines.join(' · '),
            duration: Infinity,
            closeButton: true,
            className:
              '!bg-red-950/95 !border-red-500/60 !text-red-50 backdrop-blur-md',
            classNames: {
              title: '!text-red-50 !font-semibold',
              description: '!text-red-100/90',
              actionButton: '!bg-red-500 hover:!bg-red-400 !text-white !font-semibold',
              closeButton: '!bg-red-900 !border-red-500/40 !text-red-100',
            },
            action: {
              label: 'Ver no Lastlink Admin',
              onClick: () => {
                const target = row.matched_lead
                  ? `/lastlink-admin?lead=${row.matched_lead}`
                  : '/lastlink-admin';
                navigate(target);
              },
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, enabled]);
};
