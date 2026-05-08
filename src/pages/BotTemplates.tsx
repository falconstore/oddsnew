import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Bot, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/Sidebar';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  if (!iso) return 'DD/MM/AAAA';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtTime(t: string): string {
  return t || 'HH:MM';
}

function fmtVal(v: string): string {
  return v || '0,00';
}

function placeholder(label: string): string {
  return label;
}

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

interface FieldConfig {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'date' | 'time';
  default?: () => string;
  hint?: string;
  optional?: boolean;
  uppercase?: boolean;
}

interface TemplateConfig {
  id: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
  dotColor: string;
  emoji: string;
  fields: FieldConfig[];
  generate: (f: Record<string, string>) => string;
}

// ─────────────────────────────────────────
// Definição dos 5 templates
// ─────────────────────────────────────────

const TEMPLATES: TemplateConfig[] = [
  {
    id: 'queimar_fb',
    name: 'Queimar FreeBet',
    shortName: 'Queimar FB',
    description: 'Para girar freebet ganha em procedimento anterior.',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    emoji: '🟢',
    fields: [
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 130', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'numRef', label: 'Nº do Proc de Referência (FB)', placeholder: 'Ex: 110', type: 'text' },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Bet365', type: 'text', uppercase: true },
      { id: 'timeA', label: 'Time A', placeholder: 'Ex: Flamengo', type: 'text', uppercase: true },
      { id: 'timeB', label: 'Time B', placeholder: 'Ex: Palmeiras', type: 'text', uppercase: true },
      { id: 'dataPartida', label: 'Data da Partida', placeholder: '', type: 'date', default: todayISO },
      { id: 'horaPartida', label: 'Horário da Partida', placeholder: '20:00', type: 'time', default: () => '20:00' },
      { id: 'lucro', label: 'Lucro Previsto (ex: 17,00)', placeholder: '17,00', type: 'text' },
    ],
    generate: (f) => {
      const linha2 = f.numRef
        ? `🟢 PROCEDIMENTO REFERENTE ÀS FREEBETS DO PROCEDIMENTO ${f.numRef} EXTRA 🔥`
        : `🟢 PROCEDIMENTO REFERENTE ÀS FREEBETS DO PROCEDIMENTO [REF] EXTRA 🔥`;
      return [
        `🟢 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        linha2,
        `CASA: ${(f.casa || 'CASA').toUpperCase()}`,
        `UTILIZAREMOS O JOGO ENTRE:`,
        `${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataPartida)} ÀS ${fmtTime(f.horaPartida)}`,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, CHAME O SUPORTE`,
        `🟡 LUCRO: 💵 ${fmtVal(f.lucro)} 💵`,
        `😍 chance de duplo green 😍`,
      ].join('\n');
    },
  },
  {
    id: 'ganhar_fb_promo',
    name: 'Ganhar Freebet — Promoção',
    shortName: 'Ganhar FB (Promo)',
    description: 'Promoção da casa com aposta grátis. Ex: "Super Sextou".',
    color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    dotColor: 'bg-cyan-400',
    emoji: '🟢',
    fields: [
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 129', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Sportingbet', type: 'text', uppercase: true },
      { id: 'campanha', label: 'Nome da Campanha', placeholder: 'Ex: SUPER SEXTOU', type: 'text', uppercase: true },
      { id: 'timeA', label: 'Time A (partida 1)', placeholder: 'Ex: RB Leipzig', type: 'text', uppercase: true },
      { id: 'timeB', label: 'Time B (partida 1)', placeholder: 'Ex: St Pauli', type: 'text', uppercase: true },
      { id: 'dataP1', label: 'Data Partida 1', placeholder: '', type: 'date', default: todayISO },
      { id: 'horaP1', label: 'Horário Partida 1', placeholder: '10:30', type: 'time', default: () => '10:30' },
      { id: 'timeC', label: 'Time A (partida 2)', placeholder: 'Opcional', type: 'text', uppercase: true, optional: true },
      { id: 'timeD', label: 'Time B (partida 2)', placeholder: 'Opcional', type: 'text', uppercase: true, optional: true },
      { id: 'dataP2', label: 'Data Partida 2', placeholder: '', type: 'date', optional: true },
      { id: 'horaP2', label: 'Horário Partida 2', placeholder: 'Opcional', type: 'time', optional: true },
      { id: 'freebetValor', label: 'Valor da Freebet (ex: 25,00)', placeholder: '25,00', type: 'text' },
    ],
    generate: (f) => {
      const partidas = [`${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataP1)} ÀS ${fmtTime(f.horaP1)}`];
      if (f.timeC && f.timeD && f.dataP2 && f.horaP2) {
        partidas.push(`${f.timeC.toUpperCase()} X ${f.timeD.toUpperCase()} - ${fmtDate(f.dataP2)} ÀS ${fmtTime(f.horaP2)}`);
      }
      return [
        `🟢 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE A PROMOÇÃO DA ${(f.casa || 'CASA').toUpperCase()} - ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        ...partidas,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA`,
        `🟡 RECOMPENSA: 🎁 ${fmtVal(f.freebetValor)} EM FREEBET`,
        `😍 chance de duplo green 😍`,
      ].join('\n');
    },
  },
  {
    id: 'ganhar_fb_missao',
    name: 'Ganhar Freebet — Missão',
    shortName: 'Ganhar FB (Missão)',
    description: 'Missão da casa com recompensa em freebet ao completar.',
    color: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    dotColor: 'bg-violet-400',
    emoji: '🟢',
    fields: [
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 115', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'missao', label: 'Nome da Missão', placeholder: 'Ex: LIGA DOS CAMPEÕES', type: 'text', uppercase: true },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betano', type: 'text', uppercase: true },
      { id: 'timeA', label: 'Time A (partida 1)', placeholder: 'Ex: Bayern', type: 'text', uppercase: true },
      { id: 'timeB', label: 'Time B (partida 1)', placeholder: 'Ex: PSG', type: 'text', uppercase: true },
      { id: 'dataP1', label: 'Data Partida 1', placeholder: '', type: 'date', default: todayISO },
      { id: 'horaP1', label: 'Horário Partida 1', placeholder: '16:00', type: 'time', default: () => '16:00' },
      { id: 'timeC', label: 'Time A (partida 2)', placeholder: 'Opcional', type: 'text', uppercase: true, optional: true },
      { id: 'timeD', label: 'Time B (partida 2)', placeholder: 'Opcional', type: 'text', uppercase: true, optional: true },
      { id: 'dataP2', label: 'Data Partida 2', placeholder: '', type: 'date', optional: true },
      { id: 'horaP2', label: 'Horário Partida 2', placeholder: 'Opcional', type: 'time', optional: true },
      { id: 'freebetValor', label: 'Valor da Freebet (ex: 50,00)', placeholder: '50,00', type: 'text' },
    ],
    generate: (f) => {
      const partidas = [`${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataP1)} ÀS ${fmtTime(f.horaP1)}`];
      if (f.timeC && f.timeD && f.dataP2 && f.horaP2) {
        partidas.push(`${f.timeC.toUpperCase()} X ${f.timeD.toUpperCase()} - ${fmtDate(f.dataP2)} ÀS ${fmtTime(f.horaP2)}`);
      }
      return [
        `🟢 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE À MISSÃO ${(f.missao || 'NOME DA MISSÃO').toUpperCase()} 🔥`,
        `CASA: ${(f.casa || 'CASA').toUpperCase()}`,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        ...partidas,
        `🟥 atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA`,
        `🟡 RECOMPENSA: 🎁 ${fmtVal(f.freebetValor)} EM FREEBET`,
        `😍 chance de duplo green para um lado 😍`,
      ].join('\n');
    },
  },
  {
    id: 'superodd_dg',
    name: 'Superodd — Duplo Green',
    shortName: 'Superodd (DG)',
    description: 'Superodd com objetivo de Duplo Green em cash. Emoji azul 🔵.',
    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotColor: 'bg-blue-400',
    emoji: '🔵',
    fields: [
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 116', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betesporte', type: 'text', uppercase: true },
      { id: 'timeA', label: 'Time A', placeholder: 'Ex: Corinthians', type: 'text', uppercase: true },
      { id: 'timeB', label: 'Time B', placeholder: 'Ex: Vasco', type: 'text', uppercase: true },
      { id: 'dataPartida', label: 'Data da Partida', placeholder: '', type: 'date', default: todayISO },
      { id: 'horaPartida', label: 'Horário da Partida', placeholder: '19:00', type: 'time', default: () => '19:00' },
      { id: 'valorDG', label: 'Objetivo Duplo Green (ex: 210,00)', placeholder: '210,00', type: 'text' },
    ],
    generate: (f) => {
      return [
        `🔵 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE A SUPERODD DA ${(f.casa || 'CASA').toUpperCase()} 🔥`,
        `UTILIZAREMOS O JOGO ENTRE:`,
        `${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataPartida)} ÀS ${fmtTime(f.horaPartida)}`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE CALCULADORA 🧮`,
        `🟡 OBJETIVO DUPLO GREEN - 💵 ${fmtVal(f.valorDG)}`,
        `😍 chance de duplo green 😍`,
      ].join('\n');
    },
  },
  {
    id: 'promo_range',
    name: 'Promoção — Lucro em Range',
    shortName: 'Promoção (Range)',
    description: 'Lucro varia entre valor mínimo e máximo. Ex: R$3,25 à R$3,75.',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotColor: 'bg-amber-400',
    emoji: '🟢',
    fields: [
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 117', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'campanha', label: 'Nome da Promoção/Campanha', placeholder: 'Ex: SUPER ODDS WEEK', type: 'text', uppercase: true },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betfair', type: 'text', uppercase: true },
      { id: 'timeA', label: 'Time A', placeholder: 'Ex: São Paulo', type: 'text', uppercase: true },
      { id: 'timeB', label: 'Time B', placeholder: 'Ex: Santos', type: 'text', uppercase: true },
      { id: 'dataPartida', label: 'Data da Partida', placeholder: '', type: 'date', default: todayISO },
      { id: 'horaPartida', label: 'Horário da Partida', placeholder: '18:30', type: 'time', default: () => '18:30' },
      { id: 'lucroMin', label: 'Lucro Mínimo (ex: 3,25)', placeholder: '3,25', type: 'text' },
      { id: 'lucroMax', label: 'Lucro Máximo (ex: 3,75)', placeholder: '3,75', type: 'text' },
    ],
    generate: (f) => {
      return [
        `🟢 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE À PROMOÇÃO ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
        `CASA: ${(f.casa || 'CASA').toUpperCase()}`,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        `${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataPartida)} ÀS ${fmtTime(f.horaPartida)}`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA 👆`,
        `🟡 LUCRO: 💵 ${fmtVal(f.lucroMin)} À ${fmtVal(f.lucroMax)} 💵`,
        `😍 chance de duplo green 😍`,
      ].join('\n');
    },
  },
];

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────

export default function BotTemplates() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  const template = TEMPLATES[activeIdx];

  // Reset fields when template changes, applying defaults
  useEffect(() => {
    const defaults: Record<string, string> = {};
    template.fields.forEach(f => {
      defaults[f.id] = f.default ? f.default() : '';
    });
    setFields(defaults);
    setShowOptional(false);
    setCopied(false);
  }, [activeIdx]);

  const setField = useCallback((id: string, value: string) => {
    setFields(prev => ({ ...prev, [id]: value }));
  }, []);

  const resetFields = useCallback(() => {
    const defaults: Record<string, string> = {};
    template.fields.forEach(f => {
      defaults[f.id] = f.default ? f.default() : '';
    });
    setFields(defaults);
  }, [template]);

  const preview = template.generate(fields);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = preview;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const requiredFields = template.fields.filter(f => !f.optional);
  const optionalFields = template.fields.filter(f => f.optional);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 md:ml-64 p-4 md:p-6 flex flex-col gap-6 min-w-0">

        {/* Header */}
        <div className="flex items-center gap-3 pt-10 md:pt-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shrink-0">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">Templates do Bot</h1>
            <p className="text-sm text-muted-foreground">Preencha e copie o procedimento pronto para enviar no Telegram</p>
          </div>
        </div>

        {/* Template selector tabs */}
        <div className="flex gap-2 flex-wrap" data-testid="template-tabs">
          {TEMPLATES.map((t, i) => (
            <button
              key={t.id}
              data-testid={`tab-template-${t.id}`}
              onClick={() => setActiveIdx(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-200',
                i === activeIdx
                  ? t.color + ' shadow-sm'
                  : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground bg-card/50'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', i === activeIdx ? t.dotColor : 'bg-muted-foreground/30')} />
              {t.shortName}
            </button>
          ))}
        </div>

        {/* Description */}
        <motion.div
          key={template.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-muted-foreground bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5"
        >
          <span className="font-medium text-foreground">{template.name}</span>
          {' — '}{template.description}
        </motion.div>

        {/* Main grid: form + preview */}
        <motion.div
          key={template.id + '-grid'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
        >
          {/* ── Form ── */}
          <div className="flex flex-col gap-4 bg-card border border-border rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Preencha os campos</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFields}
                className="h-7 text-xs text-muted-foreground gap-1.5"
                data-testid="btn-reset-fields"
              >
                <RefreshCw className="h-3 w-3" />
                Limpar
              </Button>
            </div>

            {/* Required fields */}
            <div className="flex flex-col gap-3">
              {requiredFields.map(f => (
                <FieldInput key={f.id} field={f} value={fields[f.id] ?? ''} onChange={v => setField(f.id, v)} />
              ))}
            </div>

            {/* Optional fields toggle */}
            {optionalFields.length > 0 && (
              <div className="border-t border-border/50 pt-3">
                <button
                  onClick={() => setShowOptional(v => !v)}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="btn-toggle-optional"
                >
                  {showOptional ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showOptional ? 'Ocultar' : 'Adicionar'} 2ª partida (opcional)
                </button>

                {showOptional && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex flex-col gap-3 mt-3 overflow-hidden"
                  >
                    {optionalFields.map(f => (
                      <FieldInput key={f.id} field={f} value={fields[f.id] ?? ''} onChange={v => setField(f.id, v)} />
                    ))}
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* ── Preview ── */}
          <div className="flex flex-col gap-3 bg-card border border-border rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Preview — copie e envie no Telegram</p>
              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                {template.emoji} {template.shortName}
              </Badge>
            </div>

            {/* Preview text */}
            <div
              className="bg-muted/20 border border-border/50 rounded-xl p-4 font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap min-h-[200px] select-all"
              data-testid="template-preview"
            >
              {preview}
            </div>

            {/* Copy button */}
            <Button
              onClick={handleCopy}
              className={cn(
                'w-full h-11 font-semibold gap-2 transition-all duration-300',
                copied
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg'
              )}
              data-testid="btn-copy-template"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copiado! Cole direto no Telegram
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar Template
                </>
              )}
            </Button>

            {/* Tip */}
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              O bot confirma em até 3 segundos com <span className="text-emerald-400 font-medium">✅ Procedimento registrado</span>
            </p>
          </div>
        </motion.div>

        {/* Quick rules */}
        <div className="bg-muted/20 border border-border/40 rounded-2xl p-4 md:p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Regras que o bot verifica</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ['🟢 ou 🔵 + PROCEDIMENTO N - DD/MM/AAAA', 'Primeira linha obrigatória'],
              ['CASA: NomeDaCasa ou DA NOMECASA', 'Identificação da casa de apostas'],
              ['Time A X Time B - DD/MM/AAAA ÀS HH:MM', 'Formato exato da partida'],
              ['LUCRO / RECOMPENSA / OBJETIVO DUPLO GREEN', 'Pelo menos um valor previsto'],
              ['REFERENTE ÀS FREEBETS DO PROCEDIMENTO N', 'Obrigatório no tipo Queimar FB'],
              ['😍 chance de duplo green 😍', 'Marca prioridade como ALTA'],
            ].map(([rule, desc]) => (
              <div key={rule} className="flex flex-col gap-0.5 bg-background/50 rounded-xl px-3 py-2.5 border border-border/30">
                <span className="text-[12px] font-mono text-foreground/90">{rule}</span>
                <span className="text-[11px] text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

// ─────────────────────────────────────────
// FieldInput sub-componente
// ─────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: string;
  onChange: (v: string) => void;
}) {
  const handleChange = (v: string) => {
    onChange(field.uppercase ? v.toUpperCase() : v);
  };

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium text-muted-foreground">
        {field.label}
        {field.optional && <span className="ml-1 text-muted-foreground/50">(opcional)</span>}
      </Label>
      <Input
        type={field.type}
        value={value}
        placeholder={field.placeholder}
        onChange={e => handleChange(e.target.value)}
        className={cn(
          'h-9 text-sm bg-background/50',
          field.uppercase && 'uppercase placeholder:normal-case'
        )}
        data-testid={`input-field-${field.id}`}
      />
      {field.hint && (
        <p className="text-[11px] text-muted-foreground/70">{field.hint}</p>
      )}
    </div>
  );
}
