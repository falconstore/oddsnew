import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { TEMPLATES, kickoffToDateStr, kickoffToTimeStr, type FieldConfig } from '@/lib/botTemplatesData';
import { EventoAutocomplete } from '@/components/procedures/EventoAutocomplete';
import {
  DEFAULT_CONFIG, loadImage, fileToDataURL, renderWatermarkedCanvas,
} from '@/lib/watermark';
import { PasteImageZone } from '@/components/PasteImageZone';
import { useBookmakers } from '@/hooks/useBookmakers';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import { toast } from '@/hooks/use-toast';
import defaultLogoUrl from '@assets/logo_1778182494299.png';

// Destino e GIF fixos do disparo (Fase 2).
// CHAT_ID = grupo "GRUPO PRÉ ENVIO 🦈🔥".
const CHAT_ID = -1002197121868;
// file_id do GIF de atenção (subido 1x via scripts/upload-gif-atencao.mjs).
const GIF_ATENCAO_FILE_ID = 'CgACAgEAAyEGAASC9WtMAAECOFxqO0vU1puA5-mv9Tkkvb8bNqbH0AACsgYAArx72UWJ2Kr93mPV6jwE';
import {
  Send, Plus, Trash2, Film, Calculator,
  CheckCircle2, FileText, Ticket, Loader2,
} from 'lucide-react';

// ── Tipos da sequência ───────────────────────────────────────────────────
interface Entrada {
  id: string;
  casa: string;
  odd: string;          // ex: "45.00"
  aposte: string;       // ex: "6,50"
  link: string;         // link da partida (vai escondido no texto "LINK DA PARTIDA")
  observacao: string;   // observação opcional da entrada
  printDataUrl: string | null; // preview do print (já com marca d'água)
  printName: string | null;
}

let _seq = 0;
const novaEntrada = (): Entrada => ({
  id: `e${++_seq}`, casa: '', odd: '', aposte: '', link: '', observacao: '', printDataUrl: null, printName: null,
});

export default function EnvioProcedimentos() {
  // 1) Texto do procedimento — gerado pelos templates existentes (reusados da
  //    aba Templates Bot) OU editado/colado manualmente.
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]?.id ?? '');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [textoManual, setTextoManual] = useState<string | null>(null); // != null quando o user editou à mão
  // Dados de evento por campo (evento1, evento2…) vindos do autocomplete API-Football.
  type EventoVal = { partida_descricao: string; fixture_id: number | null; kickoff_at: string | null };
  const [eventoData, setEventoData] = useState<Record<string, EventoVal>>({});

  const template = useMemo(() => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0], [templateId]);

  // Aplica defaults dos campos ao trocar de template.
  useEffect(() => {
    if (!template) return;
    const init: Record<string, string> = {};
    for (const f of template.fields) init[f.id] = f.default ? f.default() : '';
    setCampos(init);
    setEventoData({});
    setTextoManual(null); // volta a gerar pelo template
  }, [template]);

  // Campos enriquecidos: injeta evento1/evento1_data/evento1_hora a partir do
  // autocomplete (mesma lógica da aba Templates Bot), pro generate() montar a
  // linha da partida com data e horário corretos.
  const camposEnriquecidos = useMemo(() => {
    const merged: Record<string, string> = { ...campos };
    for (const [id, ev] of Object.entries(eventoData)) {
      merged[id] = ev.partida_descricao;
      merged[`${id}_data`] = kickoffToDateStr(ev.kickoff_at);
      merged[`${id}_hora`] = kickoffToTimeStr(ev.kickoff_at);
    }
    return merged;
  }, [campos, eventoData]);

  // Texto final: o manual (se editado) ou o gerado pelo template.
  // Texto do template em MAIÚSCULO (padrão dos procedimentos), como na aba
  // Templates Bot. Se o usuário editou à mão, respeita o que ele escreveu.
  const texto = textoManual ?? (template ? template.generate(camposEnriquecidos).toUpperCase() : '');

  const setCampo = (id: string, v: string) => {
    setCampos((p) => ({ ...p, [id]: v }));
    setTextoManual(null); // editar um campo volta pro modo gerado
  };

  const setEvento = (id: string, partial: EventoVal) => {
    setEventoData((p) => ({ ...p, [id]: partial }));
    setCampos((p) => ({ ...p, [id]: partial.partida_descricao }));
    setTextoManual(null);
  };

  // Campos visíveis (respeita showIf) e que não são do tipo freebet_select
  // (esse é específico do BotTemplates; aqui tratamos como texto simples).
  const camposVisiveis = useMemo<FieldConfig[]>(() => {
    if (!template) return [];
    return template.fields.filter((f) => !f.showIf || f.showIf(campos));
  }, [template, campos]);

  // 2) Entradas dinâmicas (1..N)
  const [entradas, setEntradas] = useState<Entrada[]>([novaEntrada()]);

  // Casas cadastradas (fonte oficial: tabela bookmakers) — pro autocomplete.
  const { data: bookmakers = [] } = useBookmakers();
  const casasCadastradas = useMemo(
    () => bookmakers.map((b) => b.name).filter(Boolean).sort(),
    [bookmakers],
  );

  // 3) Calculadora
  const [calcPrint, setCalcPrint] = useState<{ dataUrl: string; name: string } | null>(null);
  const [calcLink, setCalcLink] = useState('');

  const [enviando, setEnviando] = useState(false);

  const addEntrada = () => setEntradas((p) => [...p, novaEntrada()]);
  const removeEntrada = (id: string) => setEntradas((p) => p.filter((e) => e.id !== id));
  const updateEntrada = (id: string, patch: Partial<Entrada>) =>
    setEntradas((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  // Logo padrão da marca d'água (mesmo da aba Marca d'Água). Carregado 1x.
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    loadImage(defaultLogoUrl).then(setLogoImg).catch(() => setLogoImg(null));
  }, []);

  // Aplica a marca d'água padrão no print e devolve o dataURL já marcado.
  // Se o logo ainda não carregou, devolve a imagem original (sem travar o fluxo).
  const aplicarMarcaDagua = async (file: File): Promise<string> => {
    const dataUrl = await fileToDataURL(file);
    if (!logoImg) return dataUrl;
    try {
      const baseImg = await loadImage(dataUrl);
      const canvas = renderWatermarkedCanvas(baseImg, logoImg, DEFAULT_CONFIG);
      return canvas.toDataURL('image/png');
    } catch {
      return dataUrl; // fallback — usa o original se algo falhar
    }
  };

  const onEntradaPrint = async (id: string, file: File | null) => {
    if (!file) return;
    const dataUrl = await aplicarMarcaDagua(file);
    updateEntrada(id, { printDataUrl: dataUrl, printName: file.name });
  };

  const onCalcPrint = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await aplicarMarcaDagua(file);
    setCalcPrint({ dataUrl, name: file.name });
  };

  // Validação mínima pra "disparar"
  const podeEnviar = useMemo(() => {
    if (!texto.trim()) return false;
    if (entradas.length === 0) return false;
    return entradas.every((e) => e.casa.trim() && e.odd.trim() && e.aposte.trim());
  }, [texto, entradas]);

  const handleEnviar = async () => {
    setEnviando(true);
    try {
      const { data, error } = await supabaseProcedures.functions.invoke('procedure-send', {
        body: {
          chatId: CHAT_ID,
          gifFileId: GIF_ATENCAO_FILE_ID || null,
          texto,
          entradas: entradas.map((e) => ({
            casa: e.casa,
            odd: e.odd,
            aposte: e.aposte,
            link: e.link,
            observacao: e.observacao,
            printDataUrl: e.printDataUrl,
          })),
          calc: (calcPrint || calcLink) ? { printDataUrl: calcPrint?.dataUrl ?? null, link: calcLink } : null,
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || 'Falha no envio');
      toast({ title: 'Enviado!', description: 'A sequência foi disparada no grupo.' });
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar',
        description: err?.message ?? 'Não foi possível disparar a sequência.',
        variant: 'destructive',
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in pb-24">
        <PageHeader
          eyebrow="ENVIO"
          title="Envio de Procedimentos"
          subtitle="MONTE A SEQUÊNCIA E DISPARE NO TELEGRAM"
          icon={Send}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* COLUNA ESQUERDA — montagem */}
          <div className="space-y-5">
            {/* GIF de atenção (fixo) */}
            <section className="panel-bracket p-4">
              <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
                <Film className="w-3 h-3" /> [ 1 · GIF DE ATENÇÃO ]
              </p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center border border-border">
                  <Film className="w-5 h-5 text-muted-foreground/60" />
                </div>
                <span>GIF fixo "ATENÇÃO" — será reaproveitado do Telegram. (configuração na fase de disparo)</span>
              </div>
            </section>

            {/* Texto do procedimento — via template */}
            <section className="panel-bracket p-4">
              <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
                <FileText className="w-3 h-3" /> [ 2 · TEXTO DO PROCEDIMENTO ]
              </p>

              {/* Seletor de template */}
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full h-9 px-2 text-sm bg-background border border-border outline-none focus:border-primary mb-3"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </select>

              {/* Campos do template */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {camposVisiveis.map((f) => (
                  <div key={f.id} className={cn((f.type === 'toggle' || f.type === 'evento') && 'sm:col-span-2')}>
                    {f.type === 'toggle' ? (
                      <label className="flex items-center justify-between gap-2 h-9 px-2.5 border border-border rounded bg-card cursor-pointer">
                        <span className="text-xs text-foreground/90">{f.label}</span>
                        <Switch
                          checked={campos[f.id] === 'true'}
                          onCheckedChange={(c) => setCampo(f.id, c ? 'true' : 'false')}
                        />
                      </label>
                    ) : f.type === 'evento' ? (
                      <div>
                        <label className="block text-[10px] text-muted-foreground/70 mb-0.5">{f.label}</label>
                        <EventoAutocomplete
                          partidaDescricao={eventoData[f.id]?.partida_descricao ?? campos[f.id] ?? ''}
                          fixtureId={eventoData[f.id]?.fixture_id ?? null}
                          kickoffAt={eventoData[f.id]?.kickoff_at ?? null}
                          onChange={(partial) => setEvento(f.id, {
                            partida_descricao: partial.partida_descricao,
                            fixture_id: partial.fixture_id,
                            kickoff_at: partial.kickoff_at,
                          })}
                          inputClassName="h-9 text-sm"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] text-muted-foreground/70 mb-0.5">{f.label}</label>
                        <Input
                          type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
                          value={campos[f.id] ?? ''}
                          onChange={(e) => setCampo(f.id, f.uppercase ? e.target.value.toUpperCase() : e.target.value)}
                          placeholder={f.placeholder}
                          className="text-sm h-9"
                        />
                        {f.hint && <p className="text-[9px] text-muted-foreground/50 mt-0.5">{f.hint}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Preview do texto gerado (editável) */}
              <p className="text-[10px] text-muted-foreground/60 mb-1">Pré-visualização (pode editar à mão):</p>
              <Textarea
                value={texto}
                onChange={(e) => setTextoManual(e.target.value)}
                className="min-h-[150px] font-mono text-[13px]"
              />
              {textoManual !== null && (
                <button
                  onClick={() => setTextoManual(null)}
                  className="text-[10px] text-primary/80 hover:underline mt-1"
                >
                  ↺ Voltar ao texto gerado pelo template
                </button>
              )}
            </section>

            {/* Entradas */}
            <section className="panel-bracket p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="telemetry-label text-primary flex items-center gap-1.5">
                  <Ticket className="w-3 h-3" /> [ 3 · ENTRADAS ({entradas.length}) ]
                </p>
                <Button size="sm" variant="outline" onClick={addEntrada} className="h-7 gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Adicionar entrada
                </Button>
              </div>

              {/* Casas cadastradas (bookmakers) — autocomplete compartilhado */}
              <datalist id="envio-casas-datalist">
                {casasCadastradas.map((c) => <option key={c} value={c} />)}
              </datalist>

              <div className="space-y-3">
                {entradas.map((e, idx) => (
                  <div key={e.id} className="border border-border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="telemetry-label text-muted-foreground">ENTRADA {idx + 1}</span>
                      {entradas.length > 1 && (
                        <button onClick={() => removeEntrada(e.id)} className="text-muted-foreground/60 hover:text-destructive" title="Remover">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input value={e.casa} onChange={(ev) => updateEntrada(e.id, { casa: ev.target.value })}
                        placeholder="Casa" className="text-sm"
                        list="envio-casas-datalist" autoComplete="off" />
                      <Input value={e.odd} onChange={(ev) => updateEntrada(e.id, { odd: ev.target.value })}
                        placeholder="ODD (ex: 45.00)" className="text-sm" />
                      <Input value={e.aposte} onChange={(ev) => updateEntrada(e.id, { aposte: ev.target.value })}
                        placeholder="APOSTE (ex: 6,50)" className="text-sm" />
                    </div>
                    <Input value={e.link} onChange={(ev) => updateEntrada(e.id, { link: ev.target.value })}
                      placeholder="Link da partida (fica escondido em 'LINK DA PARTIDA')" className="text-sm" />
                    <Input value={e.observacao} onChange={(ev) => updateEntrada(e.id, { observacao: ev.target.value })}
                      placeholder="Observação (opcional)" className="text-sm" />
                    {/* Preview da legenda que vai pro Telegram */}
                    {(e.casa || e.odd || e.aposte) && (
                      <p className="text-[11px] text-muted-foreground/70">
                        Sairá: <span className="text-foreground/90">{e.casa || 'Casa'} - <u>ODD {e.odd || '—'}</u> - APOSTE <u>{e.aposte || '—'}</u></span>
                      </p>
                    )}
                    {/* Print da entrada — colar (Ctrl+V), arrastar ou selecionar.
                        Já sai com marca d'água aplicada. */}
                    <PasteImageZone
                      previewUrl={e.printDataUrl}
                      onFile={(file) => onEntradaPrint(e.id, file)}
                      onClear={() => updateEntrada(e.id, { printDataUrl: null, printName: null })}
                      label="Cole o bilhete (Ctrl+V), arraste ou clique pra selecionar"
                    />
                    {e.printDataUrl && (
                      <p className="text-[10px] text-primary/70 mt-1">✓ marca d'água aplicada</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Calculadora */}
            <section className="panel-bracket p-4">
              <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
                <Calculator className="w-3 h-3" /> [ 4 · CALCULADORA ]
              </p>
              <div className="space-y-2">
                <PasteImageZone
                  previewUrl={calcPrint?.dataUrl ?? null}
                  onFile={(file) => onCalcPrint(file)}
                  onClear={() => setCalcPrint(null)}
                  label="Cole o print da calculadora (Ctrl+V), arraste ou selecione"
                />
                {calcPrint && <p className="text-[10px] text-primary/70">✓ marca d'água aplicada</p>}
                <Input value={calcLink} onChange={(e) => setCalcLink(e.target.value)}
                  placeholder="Link da calculadora" className="text-sm" />
              </div>
            </section>
          </div>

          {/* COLUNA DIREITA — preview da sequência + enviar */}
          <aside className="lg:sticky lg:top-4 h-fit space-y-3">
            <div className="panel-bracket p-4">
              <p className="telemetry-label text-primary mb-2">[ SEQUÊNCIA DE ENVIO ]</p>
              <ol className="space-y-1.5 text-xs">
                <PreviewLine icon={Film} label="GIF de atenção" ok />
                <PreviewLine icon={FileText} label="Texto do procedimento" ok={!!texto.trim()} />
                {entradas.map((e, i) => (
                  <PreviewLine key={e.id} icon={Ticket} label={`Entrada ${i + 1}${e.casa ? ` · ${e.casa}` : ''}`} ok={!!(e.casa.trim() && e.odd.trim() && e.aposte.trim())} />
                ))}
                <PreviewLine icon={Calculator} label="Calculadora" ok={!!calcLink.trim() || !!calcPrint} />
                <PreviewLine icon={CheckCircle2} label="Fechamento 🦈 ✅" ok />
              </ol>

              <Button
                onClick={handleEnviar}
                disabled={!podeEnviar || enviando}
                className="w-full mt-4 gap-2"
              >
                {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <><Send className="w-4 h-4" /> Enviar no grupo</>}
              </Button>
              <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
                Dispara em sequência no grupo de pré-envio 🦈🔥
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

function PreviewLine({ icon: Icon, label, ok }: { icon: React.ComponentType<{ className?: string }>; label: string; ok: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', ok ? 'bg-primary' : 'bg-muted-foreground/30')} />
      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', ok ? 'text-primary/70' : 'text-muted-foreground/40')} />
      <span className={cn('truncate', ok ? 'text-foreground/90' : 'text-muted-foreground/50')}>{label}</span>
    </li>
  );
}
