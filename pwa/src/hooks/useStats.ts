import { useQuery } from '@tanstack/react-query'
import { supabase, Procedure } from '@/lib/supabase'
import { format, subDays } from 'date-fns'

export type DailyStats = {
  date: string
  // Idêntico ao admin getDailyStats
  totalOperacoes: number
  operacoesEncerradas: number
  operacoesAbertas: number
  totalFreebets: number
  totalFreebetsValor: number
  totalSemFb: number
  lucroBruto: number
}

export type DayPoint = {
  date: string
  lucro: number
  total: number
}

export function useTodayStats() {
  const today = format(new Date(), 'yyyy-MM-dd')
  return useQuery<DailyStats>({
    queryKey: ['stats', 'today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedures')
        .select('profit_loss, tipo, freebet_value, tachado, archived')
        .eq('date', today)
        .eq('archived', false)
        .eq('tachado', false)
      if (error) throw error

      const procs = (data ?? []) as Pick<Procedure, 'profit_loss' | 'tipo' | 'freebet_value' | 'tachado' | 'archived'>[]

      const fbProcs = procs.filter(p => p.tipo === 'GANHAR_FB' || p.tipo === 'QUEIMAR_FB')
      const totalFreebets = fbProcs.length
      const totalFreebetsValor = fbProcs.reduce((s, p) => s + (Number(p.freebet_value) || 0), 0)
      const totalSemFb = procs.filter(p => p.tipo === 'SEM_FB').length
      const lucroBruto = procs.reduce((s, p) => s + (Number(p.profit_loss) || 0), 0)
      const operacoesEncerradas = procs.filter(p => p.profit_loss !== null && Number(p.profit_loss) !== 0).length

      return {
        date: today,
        totalOperacoes: procs.length,
        operacoesEncerradas,
        operacoesAbertas: procs.length - operacoesEncerradas,
        totalFreebets,
        totalFreebetsValor,
        totalSemFb,
        lucroBruto,
      }
    },
    staleTime: 30_000,
  })
}

export function useLast30DaysStats() {
  return useQuery<DayPoint[]>({
    queryKey: ['stats', 'last30'],
    queryFn: async () => {
      const end = new Date()
      const start = subDays(end, 29)
      const { data, error } = await supabase
        .from('procedures')
        .select('date, profit_loss, tachado, archived')
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .eq('archived', false)
        .eq('tachado', false)
      if (error) throw error

      const map = new Map<string, DayPoint>()
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(end, 29 - i), 'yyyy-MM-dd')
        map.set(d, { date: d, lucro: 0, total: 0 })
      }
      for (const p of (data ?? []) as any[]) {
        const s = map.get(p.date)
        if (!s) continue
        s.total++
        s.lucro += Number(p.profit_loss) || 0
      }
      return Array.from(map.values())
    },
    staleTime: 60_000,
  })
}
