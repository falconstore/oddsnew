import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { TEMPLATES, kickoffToDateStr, kickoffToTimeStr, type FieldConfig } from '@/lib/botTemplatesData';
import { EventoAutocomplete } from '@/components/procedures/EventoAutocomplete';
import { FreebetSelectField } from '@/components/procedures/FreebetSelectField';
import {
  DEFAULT_CONFIG, loadImage, fileToDataURL, renderWatermarkedCanvas,
} from '@/lib/watermark';
import { PasteImageZone } from '@/components/PasteImageZone';
import { useBookmakers } from '@/hooks/useBookmakers';
import { useProcedures } from '@/hooks/useProcedures';
import { getAllPlatforms } from '@/lib/procedureUtils';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useProcedureDrafts, useCreateDraft, draftImageUrl,
  type ProcedureDraft,
} from '@/hooks/useProcedureDrafts';
import defaultLogoUrl from '@assets/logo_1778182494299.png';

// Destino e GIF fixos do disparo (Fase 2).
// CHAT_ID = grupo "GRUPO PRÉ ENVIO 🦈🔥".
const CHAT_ID = -1002197121868;
// file_id do GIF de atenção (subido 1x via scripts/upload-gif-atencao.mjs).
const GIF_ATENCAO_FILE_ID = 'CgACAgEAAyEGAASC9WtMAAECOFxqO0vU1puA5-mv9Tkkvb8bNqbH0AACsgYAArx72UWJ2Kr93mPV6jwE';
import {
  Send, Plus, Trash2, Film, Calculator,
  CheckCircle2, FileText, Ticket, Loader2, ClipboardCheck, Clock, XCircle, Ban,
} from 'lucide-react';

// ── Tipos da sequência ───────────────────────────────────────────────────
interface Entrada {
  id: string;
  casa: string;
  odd: string;          // ex: "45.00"
  aposte: string;       // ex: "6,50"
  link: string;         // link da partida (vai escondido no texto "LINK DA PARTIDA")
  observacao: string;   // observação opcional da entrada
  freebet: boolean;     // marca a entrada como aposta grátis (sai "🎟️ FREEBET" na legenda)
  printDataUrl: string | null; // preview do print (já com marca d'água)
  printName: string | null;
}

let _seq = 0;
const novaEntrada = (): Entrada => ({
  id: `e${++_seq}`, casa: '', odd: '', aposte: '', link: '', observacao: '', freebet: false, printDataUrl: null, printName: null,
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

  // Campos visíveis (respeita showIf). O tipo freebet_select usa o
  // FreebetSelectField compartilhado (igual ao Templates Bot).
  const camposVisiveis = useMemo<FieldConfig[]>(() => {
    if (!template) return [];
    return template.fields.filter((f) => !f.showIf || f.showIf(campos));
  }, [template, campos]);

  // 2) Entradas dinâmicas (1..N)
  const [entradas, setEntradas] = useState<Entrada[]>([novaEntrada()]);

  // Casas cadastradas pro autocomplete: bookmakers + plataformas já usadas em
  // procedimentos, normalizado em UPPERCASE e deduplicado (igual Templates Bot).
  const { data: bookmakers = [] } = useBookmakers();
  const { data: procedures = [] } = useProcedures();
  const casasCadastradas = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const b of bookmakers) {
      const name = (b.name ?? '').trim().toUpperCase();
      if (name && !seen.has(name)) { seen.add(name); result.push(name); }
    }
    for (const p of getAllPlatforms(procedures)) {
      if (!seen.has(p)) { seen.add(p); result.push(p); }
    }
    return result.sort();
  }, [bookmakers, procedures]);

  // 3) Calculadora
  const [calcPrint, setCalcPrint] = useState<{ dataUrl: string; name: string } | null>(null);
  const [calcLink, setCalcLink] = useState('');

  const [enviando, setEnviando] = useState(false);

  // Fluxo de revisão.
  const { user } = useAuth();
  const qc = useQueryClient();
  const createDraft = useCreateDraft();
  const { data: meusDrafts = [] } = useProcedureDrafts(); // todos; filtro abaixo
  const meusDraftsRecentes = useMemo(() => {
    const email = user?.email ?? null;
    return meusDrafts
      .filter((d) => d.created_by_email === email)
      .slice(0, 8);
  }, [meusDrafts, user?.email]);
  const [disparandoId, setDisparandoId] = useState<string | null>(null);

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

  // Limpa o formulário após salvar um rascunho com sucesso.
  const resetForm = () => {
    setEntradas([novaEntrada()]);
    setCalcPrint(null);
    setCalcLink('');
    if (template) {
      const init: Record<string, string> = {};
      for (const f of template.fields) init[f.id] = f.default ? f.default() : '';
      setCampos(init);
    }
    setEventoData({});
    setTextoManual(null);
  };

  // "Enviar para Revisão" — salva o procedimento como rascunho pendente (com
  // upload das imagens). NÃO dispara no Telegram; quem libera é o revisor.
  const handleEnviarRevisao = async () => {
    setEnviando(true);
    try {
      const res = await createDraft.mutateAsync({
        templateId: textoManual !== null ? null : (template?.id ?? null),
        texto,
        entradas: entradas.map((e) => ({
          casa: e.casa, odd: e.odd, aposte: e.aposte, link: e.link,
          observacao: e.observacao, freebet: e.freebet, printDataUrl: e.printDataUrl,
        })),
        calc: (calcPrint || calcLink) ? { printDataUrl: calcPrint?.dataUrl ?? null, link: calcLink } : null,
        createdByEmail: user?.email ?? null,
        createdById: user?.id ?? null,
      });
      if (res?.id) {
        toast({ title: 'Enviado para revisão!', description: 'O procedimento entrou na fila de revisão.' });
        resetForm();
      }
    } catch {
      /* o toast de erro vem do hook */
    } finally {
      setEnviando(false);
    }
  };

  // Dispara no grupo um rascunho JÁ APROVADO (usa as imagens do Storage).
  // O procedure-send faz claim-then-send: ele mesmo marca o rascunho como
  // 'enviado' (atômico) ANTES de disparar, então não precisamos chamar markSent
  // aqui — e um duplo-clique/reenvio é barrado no servidor (409 alreadySent).
  const handleDispararAprovado = async (d: ProcedureDraft) => {
    setDisparandoId(d.id);
    try {
      const { data, error } = await supabaseProcedures.functions.invoke('procedure-send', {
        body: {
          chatId: CHAT_ID,
          gifFileId: GIF_ATENCAO_FILE_ID || null,
          draftId: d.id,
          texto: d.texto,
          entradas: d.entradas.map((e) => ({
            casa: e.casa, odd: e.odd, aposte: e.aposte, link: e.link,
            observacao: e.observacao, freebet: e.freebet,
            printUrl: draftImageUrl(e.image_path),
          })),
          calc: d.calc && (d.calc.image_path || d.calc.link)
            ? { printUrl: draftImageUrl(d.calc.image_path), link: d.calc.link }
            : null,
        },
      });
      if (error) throw error;
      if (data?.ok === false) {
        if (data?.alreadySent) {
          toast({ title: 'Já enviado', description: 'Esse procedimento já tinha sido disparado.' });
        } else {
          throw new Error(data.error || 'Falha no envio');
        }
      } else {
        toast({ title: 'Enviado!', description: 'A sequência foi disparada no grupo.' });
      }
      // Atualiza a lista (o status virou 'enviado' no servidor).
      qc.invalidateQueries({ queryKey: ['procedure_drafts'] });
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar',
        description: err?.message ?? 'Não foi possível disparar a sequência.',
        variant: 'destructive',
      });
    } finally {
      setDisparandoId(null);
    }
  };

  return (
    <Layout>
      {/* Datalist único (escopo global da página) — autocomplete de casas no
          campo do template E nas entradas. */}
      <datalist id="envio-casas-datalist">
        {casasCadastradas.map((c) => <option key={c} value={c} />)}
      </datalist>
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
                  <div key={f.id} className={cn((f.type === 'toggle' || f.type === 'evento' || f.type === 'freebet_select') && 'sm:col-span-2')}>
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
                    ) : f.type === 'freebet_select' ? (
                      <div>
                        <label className="block text-[10px] text-muted-foreground/70 mb-0.5">{f.label}</label>
                        <FreebetSelectField
                          value={campos[f.id] ?? ''}
                          onChange={(v) => setCampo(f.id, v)}
                        />
                        {f.hint && <p className="text-[9px] text-muted-foreground/50 mt-0.5">{f.hint}</p>}
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
                          // Campo de casa: autocomplete com as casas do sistema.
                          list={f.id === 'casa' ? 'envio-casas-datalist' : undefined}
                          autoComplete={f.id === 'casa' ? 'off' : undefined}
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
                    {/* Toggle: marca a entrada como aposta grátis (freebet). Quando
                        ligado, sai "🎟️ FREEBET" no fim da linha principal da legenda. */}
                    <label className="flex items-center justify-between gap-2 h-9 px-2.5 border border-border rounded bg-background cursor-pointer">
                      <span className="text-xs text-foreground/90 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-primary/70" /> Aposta grátis (freebet)
                      </span>
                      <Switch
                        checked={e.freebet}
                        onCheckedChange={(c) => updateEntrada(e.id, { freebet: c })}
                      />
                    </label>
                    {/* Preview da legenda que vai pro Telegram */}
                    {(e.casa || e.odd || e.aposte) && (
                      <p className="text-[11px] text-muted-foreground/70">
                        Sairá: <span className="text-foreground/90">{e.casa || 'Casa'} - <u>ODD {e.odd || '—'}</u> - APOSTE <u>{e.aposte || '—'}</u>{e.freebet && ' - 🎟️ FREEBET'}</span>
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
                onClick={handleEnviarRevisao}
                disabled={!podeEnviar || enviando}
                className="w-full mt-4 gap-2"
              >
                {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <><ClipboardCheck className="w-4 h-4" /> Enviar para revisão</>}
              </Button>
              <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
                Vai pra fila de revisão. O disparo no grupo só libera após aprovação. 🦈🔥
              </p>
            </div>

            {/* Meus rascunhos — status + disparo dos aprovados */}
            {meusDraftsRecentes.length > 0 && (
              <div className="panel-bracket p-4">
                <p className="telemetry-label text-primary mb-2 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> [ MEUS RASCUNHOS ]
                </p>
                <div className="space-y-2">
                  {meusDraftsRecentes.map((d) => (
                    <MeuRascunhoLine
                      key={d.id}
                      draft={d}
                      disparando={disparandoId === d.id}
                      onDisparar={() => handleDispararAprovado(d)}
                    />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}

function MeuRascunhoLine({ draft: d, disparando, onDisparar }: { draft: ProcedureDraft; disparando: boolean; onDisparar: () => void }) {
  const resumo = (d.texto ?? '').split('\n')[0]?.slice(0, 40) || 'Procedimento';
  const STATUS: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
    pendente: { label: 'Em revisão', cls: 'text-amber-400', icon: Clock },
    aprovado: { label: 'Aprovado', cls: 'text-primary', icon: CheckCircle2 },
    rejeitado: { label: 'Rejeitado', cls: 'text-destructive', icon: XCircle },
    enviado: { label: 'Enviado', cls: 'text-sky-400', icon: Send },
  };
  const s = STATUS[d.status] ?? STATUS.pendente;
  const Icon = s.icon;
  return (
    <div className="border border-border rounded p-2.5 bg-card space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-foreground/80 truncate" title={resumo}>{resumo}</span>
        <span className={cn('inline-flex items-center gap-1 text-[10px] flex-shrink-0', s.cls)}>
          <Icon className="w-3 h-3" /> {s.label}
        </span>
      </div>
      {d.status === 'rejeitado' && d.reject_reason && (
        <p className="text-[10px] text-destructive/80 flex items-start gap-1">
          <Ban className="w-3 h-3 mt-0.5 flex-shrink-0" /> {d.reject_reason}
        </p>
      )}
      {d.status === 'aprovado' && (
        <Button size="sm" onClick={onDisparar} disabled={disparando} className="w-full h-7 gap-1.5 text-xs">
          {disparando ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando…</> : <><Send className="w-3 h-3" /> Enviar no grupo</>}
        </Button>
      )}
    </div>
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
