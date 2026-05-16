import { useState, useCallback } from 'react';
import { Bot, CheckCircle2, AlertTriangle, Loader2, ClipboardPaste, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { parseMessage, ParseResult } from '@/lib/botParser';
import { supabaseProcedures } from '@/lib/supabaseProcedures';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { normalizePlatformName } from '@/lib/procedureUtils';

interface Props {
  open: boolean;
  onClose: () => void;
}

function buildInsertRow(parsed: any, rawMessage: string, missingFields?: string[]): Record<string, unknown> {
  return {
    procedure_number: parsed.procedure_number,
    external_id: parsed.external_id,
    promotion_name: parsed.titulo || undefined,
    date: parsed.date,
    created_date: parsed.date,
    platform: parsed.platform ? normalizePlatformName(parsed.platform) : '—',
    category: parsed.category,
    status: 'Enviada Partida em Aberto',
    tipo: parsed.tipo,
    prioridade: parsed.prioridade,
    partida_descricao: parsed.partida_descricao,
    kickoff_at: parsed.kickoff_at,
    data_partida: parsed.data_partida,
    horario_partida: parsed.horario_partida,
    lucro_prejuizo_previsto: parsed.lucro_prejuizo_previsto,
    freebet_valor_previsto: parsed.freebet_valor_previsto,
    freebet_value: parsed.freebet_valor_previsto,
    profit_loss: 0,
    dp: parsed.dp,
    freebet_reference: parsed.tipo === 'QUEIMAR_FB' && parsed.ref_procedure_number
      ? parsed.ref_procedure_number
      : undefined,
    tags: parsed.tags ?? [],
    is_favorite: false,
    archived: false,
    tachado: false,
    reenviado_count: 0,
    is_extra: parsed.is_extra,
    duplo_green_confirmado: parsed.is_duplo_green,
    esporte: 'futebol',
    bot_needs_review: true,
    bot_raw_message: rawMessage,
    bot_missing_fields: missingFields && missingFields.length > 0 ? missingFields : null,
  };
}

const TIPO_LABELS: Record<string, string> = {
  SEM_FB: 'Lucro Direto',
  GANHAR_FB: 'Ganhar Freebet',
  QUEIMAR_FB: 'Queimar Freebet',
};

const TIPO_COLORS: Record<string, string> = {
  SEM_FB: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  GANHAR_FB: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  QUEIMAR_FB: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

export function RegisterBotMessageModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const parsed: ParseResult | null = text.trim().length > 10 ? parseMessage(text) : null;

  const isOk = parsed?.ok === true;
  const isPartial = parsed?.ok === 'partial';
  const isInvalid = parsed?.ok === false;

  const handlePaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
    } catch {
      // ignore
    }
  }, []);

  const handleRegister = async () => {
    if (!parsed || parsed.ok === false) return;
    setLoading(true);
    try {
      const isPartialParse = parsed.ok === 'partial';
      const data = parsed.data;
      const missingFields = isPartialParse ? (data as any).missingFields : [];

      // Resolves freebet_reference_id for QUEIMAR_FB
      let freebetReferenceId: string | null = null;
      if (data.tipo === 'QUEIMAR_FB' && data.ref_procedure_number) {
        const { data: refProc } = await supabaseProcedures
          .from('procedures')
          .select('id')
          .eq('procedure_number', data.ref_procedure_number)
          .order('created_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (refProc) freebetReferenceId = refProc.id;
      }

      const insertRow = {
        ...buildInsertRow(data, text, missingFields),
        freebet_reference_id: freebetReferenceId,
      };

      const { error } = await supabaseProcedures.rpc('bot_insert_procedure', { p_data: insertRow });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['procedures'] });

      toast({
        title: `Procedimento #${data.procedure_number} registrado`,
        description: isPartialParse
          ? 'Registrado com campos incompletos — revise no painel.'
          : 'Registrado com sucesso via bot.',
      });

      setText('');
      onClose();
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar',
        description: err?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setText('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-[#0d1117] border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Bot className="w-4 h-4 text-primary" />
            Registrar via Bot
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instrução */}
          <p className="text-xs text-muted-foreground">
            Cole aqui a mensagem do Telegram com o procedimento. O app vai parsear e registrar igual o bot faria.
          </p>

          {/* Textarea */}
          <div className="relative">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Cole a mensagem do procedimento aqui..."
              className="min-h-[140px] bg-white/5 border-white/10 text-sm font-mono resize-none placeholder:text-muted-foreground/50 focus-visible:ring-primary/40"
              data-testid="textarea-bot-message"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              className="absolute top-2 right-2 h-7 px-2 text-xs text-muted-foreground hover:text-white hover:bg-white/10"
              data-testid="button-paste-message"
            >
              <ClipboardPaste className="w-3 h-3 mr-1" />
              Colar
            </Button>
          </div>

          {/* Preview do parse */}
          {parsed && !isInvalid && (
            <div className={`rounded-xl border p-3 space-y-2 text-sm ${
              isOk
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-yellow-500/30 bg-yellow-500/5'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {isOk ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                )}
                <span className={`text-xs font-semibold ${isOk ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {isOk ? 'Parse completo' : 'Parse parcial — campos faltando'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-muted-foreground">Procedimento</div>
                <div className="font-mono font-semibold text-white">#{parsed.data.procedure_number}</div>

                <div className="text-muted-foreground">Tipo</div>
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${TIPO_COLORS[parsed.data.tipo] ?? ''}`}>
                    {TIPO_LABELS[parsed.data.tipo] ?? parsed.data.tipo}
                  </span>
                </div>

                <div className="text-muted-foreground">Plataforma</div>
                <div className="text-white">{parsed.data.platform ?? <span className="text-yellow-400/70">—</span>}</div>

                {parsed.data.partida_descricao && (
                  <>
                    <div className="text-muted-foreground">Evento</div>
                    <div className="text-white truncate">{parsed.data.partida_descricao}</div>
                  </>
                )}

                {parsed.data.lucro_prejuizo_previsto != null && (
                  <>
                    <div className="text-muted-foreground">Lucro previsto</div>
                    <div className="text-emerald-400 font-semibold">R$ {parsed.data.lucro_prejuizo_previsto.toFixed(2)}</div>
                  </>
                )}

                {parsed.data.freebet_valor_previsto != null && (
                  <>
                    <div className="text-muted-foreground">Freebet</div>
                    <div className="text-blue-400 font-semibold">R$ {parsed.data.freebet_valor_previsto.toFixed(2)}</div>
                  </>
                )}
              </div>

              {isPartial && (parsed.data as any).missingFields?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-yellow-500/20">
                  <p className="text-[10px] text-yellow-400/80 font-semibold uppercase tracking-wide mb-1">Campos faltando:</p>
                  <ul className="space-y-0.5">
                    {(parsed.data as any).missingFields.map((f: string) => (
                      <li key={f} className="text-[11px] text-yellow-300/70">• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {isInvalid && text.trim().length > 10 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
              <X className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-400">Mensagem não reconhecida</p>
                <p className="text-[11px] text-red-300/70 mt-0.5">
                  {parsed?.missingFields?.[0] ?? 'Verifique se é uma mensagem de procedimento válida.'}
                </p>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              size="sm"
              className="border-white/10 hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegister}
              disabled={!parsed || parsed.ok === false || loading}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md shadow-primary/20 font-semibold"
              data-testid="button-register-bot"
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Registrando...</>
              ) : (
                <><Bot className="w-3.5 h-3.5 mr-1.5" />Registrar</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
