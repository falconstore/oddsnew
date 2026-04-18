import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TrialUpgradeEvent, TrialUpgradeEventType } from '@/types/trial';

export type TrialStatsRange = 'today' | '7d' | '30d' | 'all';

const sinceFor = (range: TrialStatsRange): Date | null => {
  const now = new Date();
  if (range === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
};

export interface TrialUpgradeStats {
  range: TrialStatsRange;
  views: number;
  clicksWhatsapp: number;
  clicksTelegram: number;
  clicksCheckout: number;
  totalClicks: number;
  uniqueLeadsClicked: number;
  remindersSent: number;
  conversionRate: number;
}

export const useTrialUpgradeStats = (range: TrialStatsRange) => {
  return useQuery({
    queryKey: ['trial_upgrade_stats', range],
    queryFn: async (): Promise<TrialUpgradeStats> => {
      const since = sinceFor(range);
      const sinceIso = since?.toISOString();

      let eventsQ = supabase
        .from('trial_upgrade_events')
        .select('id, lead_id, event_type, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (sinceIso) eventsQ = eventsQ.gte('created_at', sinceIso);

      let remindersQ = supabase
        .from('trial_leads')
        .select('id', { count: 'exact', head: true })
        .not('reminder_sent_at', 'is', null);
      if (sinceIso) remindersQ = remindersQ.gte('reminder_sent_at', sinceIso);

      const [eventsRes, remindersRes] = await Promise.all([eventsQ, remindersQ]);
      if (eventsRes.error) throw eventsRes.error;
      if (remindersRes.error) throw remindersRes.error;

      const events = (eventsRes.data ?? []) as Pick<TrialUpgradeEvent, 'id' | 'lead_id' | 'event_type' | 'created_at'>[];

      const counts: Record<TrialUpgradeEventType, number> = {
        view: 0,
        cta_whatsapp: 0,
        cta_telegram: 0,
        cta_checkout: 0,
        cta_free_group: 0,
        cta_open_form: 0,
      };
      const uniqueLeads = new Set<string>();
      for (const e of events) {
        counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;
        if (e.event_type !== 'view' && e.lead_id) uniqueLeads.add(e.lead_id);
      }

      const totalClicks = counts.cta_whatsapp + counts.cta_telegram + counts.cta_checkout;
      const remindersSent = remindersRes.count ?? 0;
      const conversionRate = remindersSent > 0
        ? (uniqueLeads.size / remindersSent) * 100
        : 0;

      return {
        range,
        views: counts.view,
        clicksWhatsapp: counts.cta_whatsapp,
        clicksTelegram: counts.cta_telegram,
        clicksCheckout: counts.cta_checkout,
        totalClicks,
        uniqueLeadsClicked: uniqueLeads.size,
        remindersSent,
        conversionRate,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};
