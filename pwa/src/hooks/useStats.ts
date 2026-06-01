import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

export type PeriodKey = 'today' | 'yesterday' | '7d' | '30d' | '90d'

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today',     label: 'Hoje'    },
  { key: 'yesterday', label: 'Ontem'   },
  { key: '7d',        label: '7 dias'  },
  { key: '30d',       label: '30 dias' },
  { key: '90d',       label: '3 meses' },
]

function periodRange(period: PeriodKey): { start: string; end: string } {
  const now = new Date()
  switch (period) {
    case 'today':
      return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
    case 'yesterday': {
      const y = subDays(now, 1)
      return { start: format(y, 'yyyy-MM-dd'), end: format(y, 'yyyy-MM-dd') }
    }
    case '7d':
      return { start: format(subDays(now, 6), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
    case '30d':
      return { start: format(subDays(now, 29), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
    case '90d':
      return { start: format(subDays(now, 89), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') }
  }
}

export type PeriodStats = {
  totalOperacoes: number
  operacoesEncerradas: number
  operacoesAbertas: number
  totalFreebets: number
  totalFreebetsValor: number
  totalSemFb: number
  lucroBruto: number
  potencialFreebet: number
}

const OPEN_STATUSES = ['Enviado', 'Enviada Partida em Aberto', 'Aguardando Resultado', 'Falta Girar Freebet', 'Freebet Pendente']

export function usePeriodStats(period: PeriodKey) {
  const { start, end } = periodRange(period)
  return useQuery<PeriodStats>({
    queryKey: ['stats', 'period', period, start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedures')
        .select('profit_loss, resultado_lucro, lucro_prejuizo_previsto, duplo_green_lucro, duplo_green_confirmado, tipo, freebet_value, status, tachado, archived')
        .gte('date', start)
        .lte('date', end)
        .eq('archived', false)
        .eq('tachado', false)
      if (error) throw error

      // Hierarquia L/P: DG confirmado > resultado_lucro > profit_loss (≠0) > lucro_prejuizo_previsto
      const getLucroEfetivo = (p: any): number => {
        if (p.duplo_green_confirmado && p.duplo_green_lucro != null) return Number(p.duplo_green_lucro)
        if (p.resultado_lucro != null) return Number(p.resultado_lucro)
        if (Number(p.profit_loss) !== 0) return Number(p.profit_loss)
        return Number(p.lucro_prejuizo_previsto ?? 0)
      }

      const procs = (data ?? []) as any[]
      const fbProcs = procs.filter(p => p.tipo === 'GANHAR_FB' || p.tipo === 'QUEIMAR_FB')
      const encerradas = procs.filter(p => p.resultado_lucro != null || (p.profit_loss !== null && Number(p.profit_loss) !== 0)).length
      const potencialFreebet = period === 'today'
        ? procs.filter(p => OPEN_STATUSES.includes(p.status) && (p.tipo === 'GANHAR_FB' || p.tipo === 'QUEIMAR_FB') && Number(p.freebet_value) > 0)
               .reduce((s: number, p: any) => s + Number(p.freebet_value), 0)
        : 0

      return {
        totalOperacoes: procs.length,
        operacoesEncerradas: encerradas,
        operacoesAbertas: procs.length - encerradas,
        totalFreebets: fbProcs.length,
        totalFreebetsValor: fbProcs.reduce((s: number, p: any) => s + (Number(p.freebet_value) || 0), 0),
        totalSemFb: procs.filter(p => p.tipo === 'SEM_FB').length,
        lucroBruto: procs.reduce((s: number, p: any) => s + getLucroEfetivo(p), 0),
        potencialFreebet,
      }
    },
    staleTime: 30_000,
  })
}

export type DayPoint = { date: string; lucro: number; total: number }

export function useLast90DaysStats() {
  return useQuery<DayPoint[]>({
    queryKey: ['stats', 'last90'],
    queryFn: async () => {
      const end = new Date()
      const start = subDays(end, 89)
      const { data, error } = await supabase
        .from('procedures')
        .select('date, profit_loss, resultado_lucro, lucro_prejuizo_previsto, duplo_green_lucro, duplo_green_confirmado, tachado, archived')
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .eq('archived', false)
        .eq('tachado', false)
      if (error) throw error

      const getLucroEfetivo = (p: any): number => {
        if (p.duplo_green_confirmado && p.duplo_green_lucro != null) return Number(p.duplo_green_lucro)
        if (p.resultado_lucro != null) return Number(p.resultado_lucro)
        if (Number(p.profit_loss) !== 0) return Number(p.profit_loss)
        return Number(p.lucro_prejuizo_previsto ?? 0)
      }

      const map = new Map<string, DayPoint>()
      for (let i = 0; i < 90; i++) {
        const d = format(subDays(end, 89 - i), 'yyyy-MM-dd')
        map.set(d, { date: d, lucro: 0, total: 0 })
      }
      for (const p of (data ?? []) as any[]) {
        const s = map.get(p.date)
        if (!s) continue
        s.total++
        s.lucro += getLucroEfetivo(p)
      }
      return Array.from(map.values())
    },
    staleTime: 60_000,
  })
}
