import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useProcedureChecks(leadEmail: string | null) {
  return useQuery<Set<string>>({
    queryKey: ['procedure_checks', leadEmail],
    enabled: Boolean(leadEmail),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_procedure_checks')
        .select('procedure_id')
        .eq('lead_email', leadEmail!)
      if (error) {
        // Tabela pode não existir ainda — retorna set vazio graciosamente
        console.warn('useProcedureChecks:', error.message)
        return new Set<string>()
      }
      return new Set((data ?? []).map((r: { procedure_id: string }) => r.procedure_id))
    },
    staleTime: 30_000,
  })
}

export function useToggleProcedureCheck(leadEmail: string | null) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ procedureId, checked }: { procedureId: string; checked: boolean }) => {
      if (!leadEmail) return
      if (checked) {
        const { error } = await supabase
          .from('user_procedure_checks')
          .insert({ lead_email: leadEmail, procedure_id: procedureId })
        if (error && error.code !== '23505') throw error // 23505 = unique violation (já marcado)
      } else {
        const { error } = await supabase
          .from('user_procedure_checks')
          .delete()
          .eq('lead_email', leadEmail)
          .eq('procedure_id', procedureId)
        if (error) throw error
      }
    },
    onMutate: async ({ procedureId, checked }) => {
      await qc.cancelQueries({ queryKey: ['procedure_checks', leadEmail] })
      const prev = qc.getQueryData<Set<string>>(['procedure_checks', leadEmail])
      qc.setQueryData<Set<string>>(['procedure_checks', leadEmail], old => {
        const next = new Set(old ?? [])
        if (checked) next.add(procedureId)
        else next.delete(procedureId)
        return next
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['procedure_checks', leadEmail], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['procedure_checks', leadEmail] })
    },
  })
}
