import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Send, Plus, Trash2, Image as ImageIcon, Film, Calculator,
  CheckCircle2, FileText, Ticket, Loader2, X,
} from 'lucide-react';

// ── Tipos da sequência ───────────────────────────────────────────────────
interface Entrada {
  id: string;
  casa: string;
  oddLinha: string;     // ex: "ODD 4,25 + ATIVE O BOOST 26% X APOSTE R$100,00"
  link: string;         // bilhete pronto / link da partida
  printDataUrl: string | null; // preview do print (base64) — upload local por enquanto
  printName: string | null;
}

let _seq = 0;
const novaEntrada = (): Entrada => ({
  id: `e${++_seq}`, casa: '', oddLinha: '', link: '', printDataUrl: null, printName: null,
});

export default function EnvioProcedimentos() {
  // 1) Texto do procedimento (por enquanto colado/livre; integraremos os
  //    templates da aba Templates Bot na fase de disparo real).
  const [texto, setTexto] = useState('');

  // 2) Entradas dinâmicas (1..N)
  const [entradas, setEntradas] = useState<Entrada[]>([novaEntrada()]);

  // 3) Calculadora
  const [calcPrint, setCalcPrint] = useState<{ dataUrl: string; name: string } | null>(null);
  const [calcLink, setCalcLink] = useState('');

  const [enviando, setEnviando] = useState(false);

  const addEntrada = () => setEntradas((p) => [...p, novaEntrada()]);
  const removeEntrada = (id: string) => setEntradas((p) => p.filter((e) => e.id !== id));
  const updateEntrada = (id: string, patch: Partial<Entrada>) =>
    setEntradas((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const onEntradaPrint = async (id: string, file: File | null) => {
    if (!file) return;
    const dataUrl = await readFile(file);
    updateEntrada(id, { printDataUrl: dataUrl, printName: file.name });
  };

  const onCalcPrint = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await readFile(file);
    setCalcPrint({ dataUrl, name: file.name });
  };

  // Validação mínima pra "disparar"
  const podeEnviar = useMemo(() => {
    if (!texto.trim()) return false;
    if (entradas.length === 0) return false;
    return entradas.every((e) => e.casa.trim() && e.oddLinha.trim());
  }, [texto, entradas]);

  const handleEnviarPreview = async () => {
    // Fase 1: ainda sem disparo real no Telegram. Aqui só simula/valida a
    // sequência. O disparo (edge function) entra na fase 2.
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 600));
    setEnviando(false);
    alert(
      'Pré-visualização montada com sucesso!\n\n' +
      'O disparo real no Telegram será ligado na próxima fase (canal de teste).',
    );
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

            {/* Texto do procedimento */}
            <section className="panel-bracket p-4">
              <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
                <FileText className="w-3 h-3" /> [ 2 · TEXTO DO PROCEDIMENTO ]
              </p>
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={'Cole aqui o texto do procedimento (ou geraremos pelos templates).\n\nEx:\n🔵 PROCEDIMENTO 552 - 23/06/2026\n🟢 PROCEDIMENTO REFERENTE A SUPERODD DA PAGOLBET 🔥\n...'}
                className="min-h-[160px] font-mono text-[13px]"
              />
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Na próxima fase isto será preenchido pelos templates existentes (Superodd, Queimar FB, etc.).
              </p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input value={e.casa} onChange={(ev) => updateEntrada(e.id, { casa: ev.target.value })}
                        placeholder="Casa (ex: PAGOLBET)" className="text-sm" />
                      <Input value={e.link} onChange={(ev) => updateEntrada(e.id, { link: ev.target.value })}
                        placeholder="Link (bilhete / partida)" className="text-sm" />
                    </div>
                    <Input value={e.oddLinha} onChange={(ev) => updateEntrada(e.id, { oddLinha: ev.target.value })}
                      placeholder="Linha da odd (ex: ODD 4,25 + BOOST 26% X APOSTE R$100,00)" className="text-sm" />
                    {/* Print da entrada */}
                    <div className="flex items-center gap-2">
                      {e.printDataUrl ? (
                        <div className="relative">
                          <img src={e.printDataUrl} alt="" className="h-14 w-14 object-cover rounded border border-border" />
                          <button onClick={() => updateEntrada(e.id, { printDataUrl: null, printName: null })}
                            className="absolute -top-1.5 -right-1.5 bg-card border border-border rounded-full p-0.5 hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="h-14 w-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/40 text-muted-foreground/60">
                          <ImageIcon className="w-5 h-5" />
                          <input type="file" accept="image/*" className="hidden"
                            onChange={(ev) => onEntradaPrint(e.id, ev.target.files?.[0] ?? null)} />
                        </label>
                      )}
                      <span className="text-[11px] text-muted-foreground/60">
                        {e.printName ? e.printName : 'Print do bilhete (opcional)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Calculadora */}
            <section className="panel-bracket p-4">
              <p className="telemetry-label text-primary flex items-center gap-1.5 mb-2">
                <Calculator className="w-3 h-3" /> [ 4 · CALCULADORA ]
              </p>
              <div className="flex items-center gap-3">
                {calcPrint ? (
                  <div className="relative">
                    <img src={calcPrint.dataUrl} alt="" className="h-16 w-16 object-cover rounded border border-border" />
                    <button onClick={() => setCalcPrint(null)}
                      className="absolute -top-1.5 -right-1.5 bg-card border border-border rounded-full p-0.5 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="h-16 w-16 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/40 text-muted-foreground/60">
                    <ImageIcon className="w-5 h-5" />
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(ev) => onCalcPrint(ev.target.files?.[0] ?? null)} />
                  </label>
                )}
                <Input value={calcLink} onChange={(e) => setCalcLink(e.target.value)}
                  placeholder="Link da calculadora" className="text-sm flex-1" />
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
                  <PreviewLine key={e.id} icon={Ticket} label={`Entrada ${i + 1}${e.casa ? ` · ${e.casa}` : ''}`} ok={!!(e.casa.trim() && e.oddLinha.trim())} />
                ))}
                <PreviewLine icon={Calculator} label="Calculadora" ok={!!calcLink.trim() || !!calcPrint} />
                <PreviewLine icon={CheckCircle2} label="Fechamento 🦈 ✅" ok />
              </ol>

              <Button
                onClick={handleEnviarPreview}
                disabled={!podeEnviar || enviando}
                className="w-full mt-4 gap-2"
              >
                {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Montando…</> : <><Send className="w-4 h-4" /> Pré-visualizar envio</>}
              </Button>
              <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
                Disparo no Telegram (canal de teste) entra na próxima fase.
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
