// Modal "Definir Resultados" — paridade doc 06 do pacote handoff-shark.
// SEM_FB / GANHAR_FB → 3 blocos: A Lucro/Prejuízo + B Ganhar Freebet + DG Duplo Green.
// QUEIMAR_FB         → A + B' (read-only "FB QUEIMADA") + DG + D Resumo do Par
//                      (paridade doc §4.2 / checklist 5).
// max-w-md (~448px). Validação: (lucro preenchido) OU (Ganhei FB E valor>0).
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Trophy, AlertCircle, Loader2, Ticket, Link2 } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { useSetProcedureResult } from '@/hooks/useProcedures';

interface DefinirResultadosModalProps {
  procedure: Procedure;
  /** Procedimento GANHAR_FB que originou a freebet (quando tipo=QUEIMAR_FB). */
  originProcedure?: Procedure | null;
  onClose: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DefinirResultadosModal({ procedure, originProcedure, onClose }: DefinirResultadosModalProps) {
  const setResult = useSetProcedureResult();

  const isQueima = procedure.tipo === 'QUEIMAR_FB';

  // Pré-preenchimento (paridade doc 06 §2-§4)
  const previstoLucro = procedure.lucro_prejuizo_previsto ?? procedure.profit_loss ?? null;
  const previstoFB = procedure.freebet_valor_previsto ?? procedure.freebet_value ?? 0;

  const [lucroStr, setLucroStr] = useState<string>(
    procedure.resultado_lucro != null
      ? String(procedure.resultado_lucro)
      : '',
  );

  // Bloco B — toggle "Ganhei FB" (NÃO usado em QUEIMAR_FB; o bloco vira read-only)
  const [ganheiFB, setGanheiFB] = useState<boolean>(
    !isQueima && (
      (procedure.resultado_freebet_ganha ?? 0) > 0 ||
        procedure.freebet_creditada === 'SIM' ||
        previstoFB > 0
    ),
  );
  const [fbStr, setFbStr] = useState<string>(
    procedure.resultado_freebet_ganha != null
      ? String(procedure.resultado_freebet_ganha)
      : '',
  );

  // Bloco DG — toggle "Confirmado" + valor opcional
  const [dgConfirmado, setDgConfirmado] = useState<boolean>(!!procedure.duplo_green_confirmado);
  const [dgLucroStr, setDgLucroStr] = useState<string>(
    procedure.duplo_green_lucro != null ? String(procedure.duplo_green_lucro) : '',
  );

  const [observacao, setObservacao] = useState<string>(procedure.resultado_observacao ?? '');

  // Validação (paridade doc 06 §6.1):
  //   QUEIMAR_FB: só exige lucro preenchido (não tem "Ganhei FB").
  //   Outros:     (lucro preenchido OU (Ganhei FB E valor FB > 0)) E valor FB ≥ 0.
  const validation = useMemo(() => {
    const lucroNum = lucroStr.trim() === '' ? null : Number(lucroStr);
    const lucroValido = lucroNum !== null && !Number.isNaN(lucroNum);
    const fbNum = fbStr.trim() === '' ? null : Number(fbStr);
    const fbValido = fbNum !== null && !Number.isNaN(fbNum) && fbNum > 0;
    const fbInvalidoNeg = fbNum !== null && (Number.isNaN(fbNum) || fbNum < 0);
    const dgNum = dgLucroStr.trim() === '' ? null : Number(dgLucroStr);
    const dgInvalido = dgNum !== null && Number.isNaN(dgNum);

    const algumPreenchido = isQueima
      ? lucroValido
      : lucroValido || (ganheiFB && fbValido);
    const canSubmit = algumPreenchido && !fbInvalidoNeg && !dgInvalido;
    return { canSubmit, lucroNum, fbNum, dgNum, lucroValido, fbValido, fbInvalidoNeg };
  }, [lucroStr, fbStr, dgLucroStr, ganheiFB, isQueima]);

  function handleGanheiFBToggle(v: boolean) {
    setGanheiFB(v);
    if (!v) setFbStr(''); // desmarcar limpa valor
  }
  function handleDgToggle(v: boolean) {
    setDgConfirmado(v);
    if (!v) setDgLucroStr('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validation.canSubmit) return;
    try {
      await setResult.mutateAsync({
        id: procedure.id,
        freebet_valor_previsto: previstoFB || null,
        resultado_lucro: validation.lucroNum,
        // Doc §4.2 — pra QUEIMAR_FB NÃO mandamos resultado_freebet_ganha (a FB foi
        // queimada, não ganha). O hook deriva freebet_creditada=null nesse caso.
        resultado_freebet_ganha: isQueima ? null : (ganheiFB ? validation.fbNum : null),
        // freebet_creditada é derivado automaticamente no hook (SIM se valor>0, NAO senão)
        freebet_creditada: null,
        resultado_observacao: observacao.trim() || null,
        duplo_green_confirmado: dgConfirmado,
        duplo_green_lucro: dgConfirmado ? validation.dgNum : null,
      });
      onClose();
    } catch {
      /* toast handled in hook; modal fica aberto, valores preservados (doc 06 §9) */
    }
  }

  const isLoading = setResult.isPending;
  const showEsperado = previstoLucro != null && Math.abs(previstoLucro) > 0.001;
  const sinalEsperado = (previstoLucro ?? 0) >= 0 ? '+' : '−';

  // Bloco D — Resumo do Par (só QUEIMAR_FB). Etapa 1 = L/P da origem (resultado_lucro
  // ou lucro_prejuizo se ainda não fechado). Etapa 2 = L/P em digitação (esta queima).
  const resumoPar = useMemo(() => {
    if (!isQueima) return null;
    const etapa1 =
      Number(originProcedure?.resultado_lucro ?? originProcedure?.profit_loss ?? 0) || 0;
    const etapa2Num = lucroStr.trim() === '' ? 0 : Number(lucroStr);
    const etapa2 = Number.isFinite(etapa2Num) ? etapa2Num : 0;
    const liquido = etapa1 + etapa2;
    return { etapa1, etapa2, liquido };
  }, [isQueima, originProcedure, lucroStr]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-[#22272B] shadow-2xl shadow-black/50 animate-fade-in-up"
        data-testid="modal-definir-resultados"
      >
        {/* Header (doc 06 §1) */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-[#333C43] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Definir resultados — #{procedure.procedure_number}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isQueima
                  ? 'Queima de FB. Informe só o lucro/prejuízo em cash da queima.'
                  : 'Informe o lucro/prejuízo em cash e/ou se ganhou uma FreeBet. Os 2 podem coexistir.'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isLoading}
            data-testid="button-close-resultados"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <form onSubmit={handleSubmit} id="resultado-form" className="space-y-3">
            {/* Bloco A — LUCRO / PREJUÍZO (sempre visível) — doc 06 §2 */}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center justify-center">
                    A
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                    Lucro / Prejuízo
                  </span>
                </div>
                {showEsperado && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    esperado: {sinalEsperado}R$ {Math.abs(previstoLucro!).toFixed(2)}
                  </span>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                value={lucroStr}
                onChange={(e) => setLucroStr(e.target.value)}
                data-testid="input-resultado-lucro"
                placeholder="Ex: 30,00 (negativo = prejuízo)"
                className="bg-emerald-500/[0.06] border-emerald-500/30 focus:border-emerald-500/60 h-9 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Positivo = lucro · negativo = prejuízo · 0 = empate · em branco = não se aplica.
              </p>
            </div>

            {/* Bloco B — depende do tipo (doc 06 §3 / §4.2) */}
            {isQueima ? (
              // QUEIMAR_FB: read-only "FB QUEIMADA" (doc §4.2 / checklist 5)
              <div
                className="rounded-xl border border-purple-500/25 bg-purple-500/[0.04] p-3.5"
                data-testid="bloco-fb-queimada"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold flex items-center justify-center">
                    B
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                    FreeBet Queimada
                  </span>
                </div>
                {originProcedure ? (
                  <div className="rounded-lg bg-purple-500/[0.06] border border-purple-500/20 p-2.5 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Ticket className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="font-mono font-semibold text-purple-200">
                        REF #{originProcedure.procedure_number}
                      </span>
                      <span className="text-foreground">·</span>
                      <span className="text-emerald-300 font-mono">
                        R$ {fmt(Number(
                          originProcedure.resultado_freebet_ganha ??
                            originProcedure.freebet_valor_previsto ??
                            originProcedure.freebet_value ??
                            0,
                        ))}
                      </span>
                      <span className="text-foreground">·</span>
                      <span className="text-foreground font-semibold">
                        {originProcedure.platform}
                      </span>
                    </div>
                    {originProcedure.partida_descricao && (
                      <p className="text-[11px] text-muted-foreground ml-5 truncate">
                        {originProcedure.partida_descricao}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-300">
                      Origem não vinculada — abra o procedimento e selecione uma FB no
                      autocomplete pra fechar o ciclo automaticamente.
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  A FB já foi creditada na origem. Esta etapa só registra o lucro/prejuízo
                  da queima.
                </p>
              </div>
            ) : (
              // SEM_FB / GANHAR_FB: toggle "Ganhei FB" (doc 06 §3)
              <div className="rounded-xl border border-purple-500/25 bg-purple-500/[0.04] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold flex items-center justify-center">
                      B
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                      Ganhar Freebet
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={ganheiFB}
                      onCheckedChange={(v) => handleGanheiFBToggle(!!v)}
                      data-testid="checkbox-ganhei-fb"
                      className="border-purple-500/40 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                    />
                    <span className="text-[11px] font-semibold text-purple-200">Ganhei FB</span>
                  </label>
                </div>
                {ganheiFB ? (
                  <>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      Valor da FB ganha (R$)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fbStr}
                      onChange={(e) => setFbStr(e.target.value)}
                      data-testid="input-resultado-freebet-ganha"
                      placeholder={previstoFB > 0 ? `Ex: ${previstoFB.toFixed(2)}` : 'Ex: 20,00'}
                      className="bg-purple-500/[0.06] border-purple-500/30 focus:border-purple-500/60 h-9 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      A freebet será registrada como REF #{procedure.procedure_number} para queima futura.
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Marque acima se a operação rendeu uma FreeBet (independente do cash).
                  </p>
                )}
              </div>
            )}

            {/* Bloco DG — DUPLO GREEN (sempre visível, com toggle) — doc 06 §4 */}
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎯</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Duplo Green
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={dgConfirmado}
                    onCheckedChange={(v) => handleDgToggle(!!v)}
                    data-testid="checkbox-duplo-green"
                    className="border-amber-500/40 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                  <span className="text-[11px] font-semibold text-amber-200">Confirmado</span>
                </label>
              </div>
              {dgConfirmado ? (
                <>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                    Valor do lucro DG (R$) — opcional
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dgLucroStr}
                    onChange={(e) => setDgLucroStr(e.target.value)}
                    data-testid="input-duplo-green-lucro"
                    placeholder="Ex: 45,00"
                    className="bg-amber-500/[0.06] border-amber-500/30 focus:border-amber-500/60 h-9 text-sm font-mono"
                  />
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Marque se houve Duplo Green nesta operação.
                </p>
              )}
            </div>

            {/* Bloco D — RESUMO DO PAR (só QUEIMAR_FB) — doc §4.2 */}
            {isQueima && resumoPar && (
              <div
                className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.04] p-3.5"
                data-testid="bloco-resumo-par"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                    Resumo do Par
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Etapa 1{originProcedure ? ` (#${originProcedure.procedure_number})` : ''}
                    </span>
                    <span className={resumoPar.etapa1 >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                      {resumoPar.etapa1 >= 0 ? '+' : '−'}R$ {fmt(Math.abs(resumoPar.etapa1))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Etapa 2 (#{procedure.procedure_number})
                    </span>
                    <span className={resumoPar.etapa2 >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                      {resumoPar.etapa2 >= 0 ? '+' : '−'}R$ {fmt(Math.abs(resumoPar.etapa2))}
                    </span>
                  </div>
                  <div className="border-t border-cyan-500/20 pt-1.5 mt-1.5 flex items-center justify-between">
                    <span className="text-cyan-200 font-semibold">LÍQUIDO DO PAR</span>
                    <span
                      className={
                        resumoPar.liquido >= 0
                          ? 'text-emerald-300 font-bold'
                          : 'text-red-300 font-bold'
                      }
                      data-testid="text-resumo-par-liquido"
                    >
                      {resumoPar.liquido >= 0 ? '+' : '−'}R$ {fmt(Math.abs(resumoPar.liquido))}{' '}
                      {resumoPar.liquido >= 0 ? '🟢' : '🔴'}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Atualiza ao vivo conforme você digita o lucro da queima.
                </p>
              </div>
            )}

            {/* Observação (doc 06 §5) */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Observação (opcional)
              </label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value.slice(0, 500))}
                data-testid="input-resultado-observacao"
                placeholder="Ex: jogo cancelado, cashout antecipado..."
                rows={2}
                className="bg-white/[0.03] border-white/10 focus:border-cyan-500/40 text-xs"
              />
            </div>

            {/* Avisos */}
            {!validation.canSubmit && (lucroStr || ganheiFB) && (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-300">
                  {validation.fbInvalidoNeg
                    ? 'Valor da Freebet não pode ser negativo.'
                    : isQueima
                      ? 'Preencha o lucro/prejuízo da queima.'
                      : ganheiFB && (validation.fbNum ?? 0) <= 0
                        ? 'Você marcou "Ganhei FB" — preencha um valor maior que zero.'
                        : 'Preencha o lucro/prejuízo OU marque que ganhou freebet com valor.'}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Footer (doc 06 §1) */}
        <div className="flex-shrink-0 border-t border-[#333C43] px-5 py-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            data-testid="button-cancelar-resultados"
            className="text-muted-foreground hover:bg-white/5 text-sm h-9"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="resultado-form"
            disabled={isLoading || !validation.canSubmit}
            data-testid="button-salvar-resultados"
            className="bg-emerald-600 hover:bg-emerald-600/90 text-white h-9 text-sm px-5 font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </span>
            ) : (
              '✓ Salvar resultado'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
