import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { supabase, Procedure } from '@/lib/supabase'
import { format } from 'date-fns'

function uid() {
  return Math.random().toString(36).slice(2, 8)
}

export function useProceduresToday() {
  const qc = useQueryClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const channelName = useRef(`procedures-today-${uid()}`)

  const query = useQuery<Procedure[]>({
    queryKey: ['procedures', 'today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .eq('date', today)
        .eq('archived', false)
        .order('procedure_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as Procedure[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'procedures',
        filter: `date=eq.${today}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['procedures', 'today', today] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [today, qc])

  return query
}

export function useProceduresList(filter: 'all' | 'active' | 'done' = 'all') {
  const qc = useQueryClient()
  const channelName = useRef(`procedures-list-${uid()}`)

  const query = useQuery<Procedure[]>({
    queryKey: ['procedures', 'list', filter],
    queryFn: async () => {
      let q = supabase
        .from('procedures')
        .select('*')
        .eq('archived', false)
        .order('date', { ascending: false })
        .order('procedure_number', { ascending: false })
        .limit(100)

      if (filter === 'active') {
        q = q.in('status', ['Enviado', 'Enviada Partida em Aberto', 'Aguardando Resultado', 'Falta Girar Freebet', 'Freebet Pendente'])
      } else if (filter === 'done') {
        q = q.in('status', ['Concluído', 'Lucro Direto'])
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Procedure[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'procedures' }, () => {
        qc.invalidateQueries({ queryKey: ['procedures', 'list'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])

  return query
}

export function useProcedureById(id: string) {
  return useQuery<Procedure | null>({
    queryKey: ['procedure', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Procedure
    },
    enabled: Boolean(id),
  })
}
