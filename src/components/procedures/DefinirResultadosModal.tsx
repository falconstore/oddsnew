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
  /** Procedimento(s) GANHAR_FB que originaram a(s) freebet(s) — quando tipo=QUEIMAR_FB.
   *  Multi-origem: pode haver mais de uma (REF N° 469, 472). O primeiro = primário. */
  originProcedures?: Procedure[] | null;
  onClose: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DefinirResultadosModal({ procedure, originProcedures, onClose }: DefinirResultadosModalProps) {
  const setResult = useSetProcedureResult();

  const isQueima = procedure.tipo === 'QUEIMAR_FB';
  // Lista de origens (sempre array). Primeiro = primário.
  const origins = useMemo(() => (originProcedures ?? []).filter(Boolean) as Procedure[], [originProcedures]);

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

  // Bloco D — Resumo do Par (só QUEIMAR_FB). Uma etapa por origem (L/P da origem:
  // resultado_lucro, ou profit_loss/previsto se ainda não fechado) + a etapa desta
  // queima (L/P em digitação). Líquido = soma de todas.
  const resumoPar = useMemo(() => {
    if (!isQueima) return null;
    const etapasOrigem = origins.map((o) => ({
      number: o.procedure_number,
      valor: Number(o.resultado_lucro ?? o.profit_loss ?? o.lucro_prejuizo_previsto ?? 0) || 0,
    }));
    const etapa2Num = lucroStr.trim() === '' ? 0 : Number(lucroStr);
    const etapaQueima = Number.isFinite(etapa2Num) ? etapa2Num : 0;
    const somaOrigens = etapasOrigem.reduce((acc, e) => acc + e.valor, 0);
    const liquido = somaOrigens + etapaQueima;
    return { etapasOrigem, etapaQueima, liquido };
  }, [isQueima, origins, lucroStr]);

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
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
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
            <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 border border-primary/40 text-primary text-[10px] font-bold flex items-center justify-center">
                    A
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
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
                className="bg-primary/[0.06] border-primary/30 focus:border-primary/60 h-9 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Positivo = lucro · negativo = prejuízo · 0 = empate · em branco = não se aplica.
              </p>
            </div>

            {/* Bloco B — depende do tipo (doc 06 §3 / §4.2) */}
            {isQueima ? (
              // QUEIMAR_FB: read-only "FB QUEIMADA" (doc §4.2 / checklist 5)
              <div
                className="rounded-xl border border-border bg-muted/30 p-3.5"
                data-testid="bloco-fb-queimada"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full border border-border text-muted-foreground text-[10px] font-bold flex items-center justify-center">
                    B
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    FreeBet Queimada
                  </span>
                </div>
                {origins.length > 0 ? (
                  <div className="space-y-1.5">
                    {origins.map((o) => (
                      <div key={o.id} className="rounded-lg bg-muted border border-border p-2.5 space-y-1">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Ticket className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono font-semibold text-foreground">
                            REF #{o.procedure_number}
                          </span>
                          <span className="text-foreground">·</span>
                          <span className="text-primary font-mono">
                            R$ {fmt(Number(
                              o.resultado_freebet_ganha ??
                                o.freebet_valor_previsto ??
                                o.freebet_value ??
                                0,
                            ))}
                          </span>
                          <span className="text-foreground">·</span>
                          <span className="text-foreground font-semibold">
                            {o.platform}
                          </span>
                        </div>
                        {o.partida_descricao && (
                          <p className="text-[11px] text-muted-foreground ml-5 truncate">
                            {o.partida_descricao}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-warning/5 border border-warning/20 p-2.5 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                    <p className="text-[11px] text-warning/90">
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
              <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full border border-border text-muted-foreground text-[10px] font-bold flex items-center justify-center">
                      B
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Ganhar Freebet
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={ganheiFB}
                      onCheckedChange={(v) => handleGanheiFBToggle(!!v)}
                      data-testid="checkbox-ganhei-fb"
                      className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="text-[11px] font-semibold text-foreground">Ganhei FB</span>
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
                      className="bg-muted border-border focus:border-primary/60 h-9 text-sm font-mono"
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
            <div className="rounded-xl border border-warning/25 bg-warning/[0.04] p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎯</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-warning">
                    Duplo Green
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={dgConfirmado}
                    onCheckedChange={(v) => handleDgToggle(!!v)}
                    data-testid="checkbox-duplo-green"
                    className="border-warning/40 data-[state=checked]:bg-warning data-[state=checked]:border-warning"
                  />
                  <span className="text-[11px] font-semibold text-warning/90">Confirmado</span>
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
                    className="bg-warning/[0.06] border-warning/30 focus:border-warning/60 h-9 text-sm font-mono"
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
                className="rounded-xl border border-border bg-muted/20 p-3.5"
                data-testid="bloco-resumo-par"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Resumo do Par
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[12px]">
                  {resumoPar.etapasOrigem.map((et, i) => (
                    <div key={`${et.number}-${i}`} className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Etapa {i + 1} (#{et.number})
                      </span>
                      <span className={et.valor >= 0 ? 'text-primary' : 'text-destructive'}>
                        {et.valor >= 0 ? '+' : '−'}R$ {fmt(Math.abs(et.valor))}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Etapa {resumoPar.etapasOrigem.length + 1} (#{procedure.procedure_number})
                    </span>
                    <span className={resumoPar.etapaQueima >= 0 ? 'text-primary' : 'text-destructive'}>
                      {resumoPar.etapaQueima >= 0 ? '+' : '−'}R$ {fmt(Math.abs(resumoPar.etapaQueima))}
                    </span>
                  </div>
                  <div className="border-t border-border pt-1.5 mt-1.5 flex items-center justify-between">
                    <span className="text-foreground font-semibold">LÍQUIDO DO PAR</span>
                    <span
                      className={
                        resumoPar.liquido >= 0
                          ? 'text-primary font-bold'
                          : 'text-destructive font-bold'
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
                className="bg-white/[0.03] border-white/10 focus:border-border text-xs"
              />
            </div>

            {/* Avisos */}
            {!validation.canSubmit && (lucroStr || ganheiFB) && (
              <div className="rounded-lg bg-warning/5 border border-warning/20 p-2.5 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-warning/90">
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
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 text-sm px-5 font-semibold"
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
