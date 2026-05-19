import { useQuery } from '@tanstack/react-query'
import { supabase, Procedure } from '@/lib/supabase'
import { format, subDays, parseISO } from 'date-fns'

export type DailyStats = {
  date: string
  total: number
  lucro: number
  freebets: number
  dg: number
}

export function useLast30DaysStats() {
  return useQuery<DailyStats[]>({
    queryKey: ['stats', 'last30'],
    queryFn: async () => {
      const end = new Date()
      const start = subDays(end, 29)
      const { data, error } = await supabase
        .from('procedures')
        .select('date, profit_loss, resultado_lucro, duplo_green_confirmado, duplo_green_lucro, tipo, freebet_creditada, tachado, archived')
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .eq('archived', false)
        .eq('tachado', false)
      if (error) throw error

      const map = new Map<string, DailyStats>()
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(end, 29 - i), 'yyyy-MM-dd')
        map.set(d, { date: d, total: 0, lucro: 0, freebets: 0, dg: 0 })
      }

      for (const p of (data ?? []) as any[]) {
        const s = map.get(p.date)
        if (!s) continue
        s.total++
        const efectivo = p.duplo_green_lucro ?? p.resultado_lucro ?? p.profit_loss ?? 0
        s.lucro += Number(efectivo)
        if (p.tipo === 'GANHAR_FB' && p.freebet_creditada === 'SIM') s.freebets++
        if (p.duplo_green_confirmado) s.dg++
      }

      return Array.from(map.values())
    },
    staleTime: 60_000,
  })
}

export function useTodayStats() {
  const today = format(new Date(), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['stats', 'today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedures')
        .select('profit_loss, resultado_lucro, duplo_green_confirmado, duplo_green_lucro, tipo, freebet_creditada, tachado, archived, status')
        .eq('date', today)
        .eq('archived', false)
        .eq('tachado', false)
      if (error) throw error

      let total = 0, lucro = 0, freebets = 0, dg = 0
      for (const p of (data ?? []) as any[]) {
        total++
        const efetivo = p.duplo_green_lucro ?? p.resultado_lucro ?? p.profit_loss ?? 0
        lucro += Number(efetivo)
        if (p.tipo === 'GANHAR_FB' && p.freebet_creditada === 'SIM') freebets++
        if (p.duplo_green_confirmado) dg++
      }
      return { total, lucro, freebets, dg }
    },
    staleTime: 30_000,
  })
}
