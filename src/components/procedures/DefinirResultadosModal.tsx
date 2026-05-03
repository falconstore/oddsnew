import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Trophy, TrendingUp, Ticket, Check, AlertCircle } from 'lucide-react';
import { Procedure, ProcedureResultFormData, FreebetCreditada } from '@/types/procedures';
import { useSetProcedureResult } from '@/hooks/useProcedures';

interface DefinirResultadosModalProps {
  procedure: Procedure;
  onClose: () => void;
}

export function DefinirResultadosModal({ procedure, onClose }: DefinirResultadosModalProps) {
  const setResult = useSetProcedureResult();

  const previstoFB = procedure.freebet_valor_previsto ?? procedure.freebet_value ?? 0;
  const hasFreebet = previstoFB > 0;

  const [form, setForm] = useState<ProcedureResultFormData>({
    resultado_lucro: procedure.resultado_lucro?.toString() ?? procedure.profit_loss?.toString() ?? '',
    resultado_freebet_ganha: procedure.resultado_freebet_ganha?.toString() ?? '',
    freebet_creditada: procedure.freebet_creditada ?? '',
    resultado_observacao: procedure.resultado_observacao ?? '',
  });

  const lucro = parseFloat(form.resultado_lucro);
  const lucroValido = !isNaN(lucro);
  const fbGanha = parseFloat(form.resultado_freebet_ganha);
  const fbGanhaValido = !isNaN(fbGanha) && fbGanha > 0;

  // Auto-status preview: só vira "Falta Girar" se a freebet foi REALMENTE creditada
  // com valor > 0. Marcar SIM com valor zero/vazio cai em Lucro Direto (e o salvamento
  // é bloqueado mais abaixo pra forçar o usuário a preencher o valor).
  const autoStatus = hasFreebet && form.freebet_creditada === 'SIM' && fbGanhaValido
    ? 'Falta Girar Freebet'
    : 'Lucro Direto';

  const needsFBValue = hasFreebet && form.freebet_creditada === 'SIM' && !fbGanhaValido;
  const canSubmit = lucroValido && (!hasFreebet || form.freebet_creditada !== '') && !needsFBValue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await setResult.mutateAsync({
        id: procedure.id,
        freebet_valor_previsto: previstoFB || null,
        resultado_lucro: lucro,
        resultado_freebet_ganha: form.resultado_freebet_ganha ? parseFloat(form.resultado_freebet_ganha) : null,
        freebet_creditada: (form.freebet_creditada || null) as FreebetCreditada | null,
        resultado_observacao: form.resultado_observacao || null,
      });
      onClose();
    } catch {
      /* handled in hook */
    }
  };

  const isLoading = setResult.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 animate-fade-in-up" data-testid="modal-definir-resultados">
        {/* Header */}
        <div className="relative flex-shrink-0 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border-b border-white/10 p-5">
          <div className="absolute inset-0 bg-gradient-to-b from-background/95 to-background/80" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <Trophy className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Definir Resultados</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Procedimento #{procedure.procedure_number} • {procedure.platform}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isLoading}
              data-testid="button-close-resultados"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10"
            >
              <X className="w-4.5 h-4.5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-background/95 p-5">
          <form onSubmit={handleSubmit} id="resultado-form" className="space-y-5">
            {procedure.partida_descricao && (
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Evento: </span>
                {procedure.partida_descricao}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="w-3 h-3" /> Lucro/Prejuízo Real <span className="text-primary">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.resultado_lucro}
                  onChange={(e) => setForm({ ...form, resultado_lucro: e.target.value })}
                  required
                  data-testid="input-resultado-lucro"
                  placeholder="0.00"
                  className="bg-emerald-500/5 border-emerald-500/20 focus:border-emerald-500/50 h-9 text-sm font-mono"
                />
                {procedure.lucro_prejuizo_previsto != null && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Previsto: R$ {procedure.lucro_prejuizo_previsto.toFixed(2)}
                  </p>
                )}
              </div>

              {hasFreebet && (
                <div>
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Ticket className="w-3 h-3" /> Freebet Ganha (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.resultado_freebet_ganha}
                    onChange={(e) => setForm({ ...form, resultado_freebet_ganha: e.target.value })}
                    data-testid="input-resultado-freebet-ganha"
                    placeholder="0.00"
                    className="bg-purple-500/5 border-purple-500/20 focus:border-purple-500/50 h-9 text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Previsto: R$ {previstoFB.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {hasFreebet && (
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Ticket className="w-3 h-3" /> Freebet foi creditada? <span className="text-primary">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['SIM', 'NAO'] as FreebetCreditada[]).map((opt) => {
                    const selected = form.freebet_creditada === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setForm({ ...form, freebet_creditada: opt })}
                        data-testid={`button-freebet-creditada-${opt.toLowerCase()}`}
                        className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                          selected
                            ? opt === 'SIM'
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                              : 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                            : 'bg-white/[0.03] border-white/10 text-muted-foreground hover:bg-white/[0.06]'
                        }`}
                      >
                        {opt === 'SIM' ? '✓ SIM, foi creditada' : '✗ NÃO foi creditada'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
                Observação
              </Label>
              <Textarea
                value={form.resultado_observacao}
                onChange={(e) => setForm({ ...form, resultado_observacao: e.target.value })}
                data-testid="input-resultado-observacao"
                placeholder="Notas sobre o resultado (opcional)..."
                className="bg-white/5 border-white/10 focus:border-cyan-500/50 text-sm min-h-[60px]"
              />
            </div>

            {canSubmit && (
              <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/20 p-3 flex items-start gap-2">
                <Check className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="text-cyan-300 font-semibold mb-0.5">Status será definido como:</p>
                  <p className="text-foreground">
                    <span className="font-mono">{autoStatus}</span>
                    {' '}
                    <span className="text-muted-foreground">
                      ({autoStatus === 'Falta Girar Freebet'
                        ? 'freebet creditada, ainda precisa girar'
                        : 'sem freebet pendente, lucro direto'})
                    </span>
                  </p>
                </div>
              </div>
            )}

            {hasFreebet && form.freebet_creditada === '' && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  Selecione se a freebet foi creditada pra liberar o salvamento.
                </p>
              </div>
            )}

            {needsFBValue && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  Você marcou que a freebet foi creditada — preencha o valor real ganho (R$) pra registrar como "Falta Girar Freebet".
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-background/95 border-t border-white/10 px-5 py-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            data-testid="button-cancelar-resultados"
            className="border-white/10 hover:bg-white/5 text-sm h-9"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="resultado-form"
            disabled={isLoading || !canSubmit}
            data-testid="button-salvar-resultados"
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-500/90 hover:to-emerald-600/90 text-white shadow-lg shadow-emerald-500/20 h-9 text-sm px-6 font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </span>
            ) : (
              'Registrar Resultado'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
