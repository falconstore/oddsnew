import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, Bot, RefreshCw, ChevronDown, ChevronUp,
  Plus, Trash2, ShieldCheck, AlertTriangle, XCircle, Pencil, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/Sidebar';
import { parseMessage, type ParseResult } from '@/lib/botParser';

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
function fmtTime(t: string): string { return t || 'HH:MM'; }
function fmtVal(v: string): string { return v || '0,00'; }

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

interface CustomTemplate {
  id: string;
  name: string;
  text: string;
  savedAt: string;
}

const CUSTOM_TEMPLATES_KEY = 'bsk_custom_templates';

function loadCustomTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: CustomTemplate[]) {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}

// ─────────────────────────────────────────
// Definição dos 5 templates built-in
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
        `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
        ``,
        `UTILIZAREMOS O JOGO ENTRE:`,
        `${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataPartida)} ÀS ${fmtTime(f.horaPartida)}`,
        ``,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, CHAME O SUPORTE`,
        ``,
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
      { id: 'obsRecompensa', label: 'Observação da Recompensa (opcional)', placeholder: 'Ex: A CADA GOL DO SANTOS', type: 'text', uppercase: true, hint: 'Aparece após "EM FREEBET". Deixe vazio se não houver condição especial.' },
    ],
    generate: (f) => {
      const partidas = [`${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataP1)} ÀS ${fmtTime(f.horaP1)}`];
      if (f.timeC && f.timeD && f.dataP2 && f.horaP2) {
        partidas.push(`${f.timeC.toUpperCase()} X ${f.timeD.toUpperCase()} - ${fmtDate(f.dataP2)} ÀS ${fmtTime(f.horaP2)}`);
      }
      const recompensa = `🟡 RECOMPENSA: 🎁 ${fmtVal(f.freebetValor)} EM FREEBET${f.obsRecompensa ? ` - ${f.obsRecompensa.toUpperCase()}` : ''}`;
      return [
        `🟢 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE A PROMOÇÃO DA ${(f.casa || 'CASA').toUpperCase()} - ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
        ``,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        ...partidas,
        ``,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA`,
        ``,
        recompensa,
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
      { id: 'obsRecompensa', label: 'Observação da Recompensa (opcional)', placeholder: 'Ex: A CADA GOL DO SANTOS', type: 'text', uppercase: true, hint: 'Aparece após "EM FREEBET". Deixe vazio se não houver condição especial.' },
    ],
    generate: (f) => {
      const partidas = [`${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataP1)} ÀS ${fmtTime(f.horaP1)}`];
      if (f.timeC && f.timeD && f.dataP2 && f.horaP2) {
        partidas.push(`${f.timeC.toUpperCase()} X ${f.timeD.toUpperCase()} - ${fmtDate(f.dataP2)} ÀS ${fmtTime(f.horaP2)}`);
      }
      const recompensa = `🟡 RECOMPENSA: 🎁 ${fmtVal(f.freebetValor)} EM FREEBET${f.obsRecompensa ? ` - ${f.obsRecompensa.toUpperCase()}` : ''}`;
      return [
        `🟢 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE À MISSÃO ${(f.missao || 'NOME DA MISSÃO').toUpperCase()} 🔥`,
        `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
        ``,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        ...partidas,
        ``,
        `🟥 atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA`,
        ``,
        recompensa,
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
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betesporte', type: 'text', uppercase: true, hint: 'A casa aparece na linha 2 ("DA BETESPORTE") — não precisa de linha CASA: separada neste tipo.' },
      { id: 'timeA', label: 'Time A', placeholder: 'Ex: Corinthians', type: 'text', uppercase: true },
      { id: 'timeB', label: 'Time B', placeholder: 'Ex: Vasco', type: 'text', uppercase: true },
      { id: 'dataPartida', label: 'Data da Partida', placeholder: '', type: 'date', default: todayISO },
      { id: 'horaPartida', label: 'Horário da Partida', placeholder: '19:00', type: 'time', default: () => '19:00' },
      { id: 'valorDG', label: 'Objetivo Duplo Green (ex: 210,00)', placeholder: '210,00', type: 'text' },
    ],
    generate: (f) => [
      `🔵 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      `🟢 PROCEDIMENTO REFERENTE A SUPERODD DA ${(f.casa || 'CASA').toUpperCase()} 🔥`,
      ``,
      `UTILIZAREMOS O JOGO ENTRE:`,
      `${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataPartida)} ÀS ${fmtTime(f.horaPartida)}`,
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE CALCULADORA 🧮`,
      ``,
      `🟡 OBJETIVO DUPLO GREEN - 💵 ${fmtVal(f.valorDG)}`,
      `😍 chance de duplo green 😍`,
    ].join('\n'),
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
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      `🟢 PROCEDIMENTO REFERENTE À PROMOÇÃO ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
      `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
      ``,
      `UTILIZAREMOS A PARTIDA ENTRE:`,
      `${(f.timeA || 'TIME A').toUpperCase()} X ${(f.timeB || 'TIME B').toUpperCase()} - ${fmtDate(f.dataPartida)} ÀS ${fmtTime(f.horaPartida)}`,
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA 👆`,
      ``,
      `🟡 LUCRO: 💵 ${fmtVal(f.lucroMin)} À ${fmtVal(f.lucroMax)} 💵`,
      `😍 chance de duplo green 😍`,
    ].join('\n'),
  },
];

// ─────────────────────────────────────────
// ValidationBadge — resultado de validação
// ─────────────────────────────────────────

function ValidationBadge({ result }: { result: ParseResult | null }) {
  if (!result) return null;
  if (result.ok === false) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        Bot não vai registrar
      </div>
    );
  }
  if (result.ok === 'partial') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Bot registra (incompleto)
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      Bot vai registrar ✓
    </div>
  );
}

// ─────────────────────────────────────────
// ValidationPanel — detalhes da validação
// ─────────────────────────────────────────

function ValidationPanel({ result, text }: { result: ParseResult | null; text: string }) {
  if (!text.trim()) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Bot className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground/60">Cole o template acima para ver se o bot consegue ler</p>
      </div>
    );
  }

  if (!result) return null;

  if (result.ok === false) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
          <XCircle className="h-4 w-4" />
          Bot não consegue registrar
        </div>
        <p className="text-xs text-muted-foreground">O template não foi reconhecido. Verifique:</p>
        <ul className="space-y-1">
          {result.missingFields.map(f => (
            <li key={f} className="flex items-start gap-1.5 text-xs text-red-400/80">
              <span className="mt-0.5 shrink-0">•</span>{f}
            </li>
          ))}
        </ul>
        <div className="mt-1 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Dica:</p>
          A 1ª linha deve ter <span className="font-mono text-primary">🟢 PROCEDIMENTO NNN - DD/MM/AAAA</span>
        </div>
      </div>
    );
  }

  const data = result.data;
  const isPartial = result.ok === 'partial';
  const missing = isPartial ? (data as { missingFields: string[] }).missingFields : [];

  const tipoLabel: Record<string, string> = {
    SEM_FB: 'Sem Freebet',
    GANHAR_FB: 'Ganhar Freebet',
    QUEIMAR_FB: 'Queimar Freebet',
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={cn(
        'flex items-center gap-2 text-sm font-semibold',
        isPartial ? 'text-amber-400' : 'text-emerald-400',
      )}>
        {isPartial ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {isPartial ? 'Bot registra (com flag INCOMPLETO)' : 'Bot vai registrar normalmente'}
      </div>

      {/* Campos detectados */}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">Nº Proc:</span>
        <span className="font-mono text-foreground font-medium">{data.procedure_number}</span>
        <span className="text-muted-foreground">Categoria:</span>
        <span className="text-foreground">{data.category}</span>
        <span className="text-muted-foreground">Tipo:</span>
        <span className="text-foreground">{tipoLabel[data.tipo] ?? data.tipo}</span>
        {data.platform && <>
          <span className="text-muted-foreground">Plataforma:</span>
          <span className="text-foreground">{data.platform}</span>
        </>}
        {data.partida_descricao && <>
          <span className="text-muted-foreground">Evento:</span>
          <span className="text-foreground">{data.partida_descricao}</span>
        </>}
        {data.horario_partida && <>
          <span className="text-muted-foreground">Horário:</span>
          <span className="text-foreground">{data.horario_partida}</span>
        </>}
        {data.lucro_prejuizo_previsto != null && <>
          <span className="text-muted-foreground">Lucro prev.:</span>
          <span className="text-emerald-400 font-medium">R$ {data.lucro_prejuizo_previsto.toFixed(2).replace('.', ',')}</span>
        </>}
        {data.freebet_valor_previsto != null && <>
          <span className="text-muted-foreground">Freebet:</span>
          <span className="text-cyan-400 font-medium">R$ {data.freebet_valor_previsto.toFixed(2).replace('.', ',')}</span>
        </>}
        {data.dp && <>
          <span className="text-muted-foreground">Duplo Green:</span>
          <span className="text-primary font-medium">✓ DP detectado</span>
        </>}
      </div>

      {/* Campos faltando */}
      {missing.length > 0 && (
        <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <p className="text-xs font-medium text-amber-400 mb-1.5">Campos faltando:</p>
          <ul className="space-y-0.5">
            {missing.map(f => (
              <li key={f} className="flex items-start gap-1.5 text-xs text-amber-400/70">
                <span className="mt-0.5 shrink-0">•</span>{f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Modal de criação de template personalizado
// ─────────────────────────────────────────

function CreateTemplateModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (t: CustomTemplate) => void;
}) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');

  const validation = useMemo<ParseResult | null>(() => {
    if (!text.trim()) return null;
    return parseMessage(text);
  }, [text]);

  const canSave = name.trim().length > 0 && validation !== null && validation.ok !== false;

  function handleSave() {
    if (!canSave) return;
    onSave({
      id: `custom_${Date.now()}`,
      name: name.trim(),
      text: text.trim(),
      savedAt: new Date().toISOString(),
    });
    setName('');
    setText('');
    onClose();
  }

  function handleClose() {
    setName('');
    setText('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            Criar Template Personalizado
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cole um exemplo real do template. O bot vai validar se consegue registrá-lo antes de salvar.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border/50 p-5 pt-4 gap-y-4">
          {/* Coluna esquerda — editor */}
          <div className="flex flex-col gap-3 md:pr-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Nome do template *</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Superodd Simples"
                className="mt-1 h-9 text-sm bg-background/50"
                data-testid="input-custom-template-name"
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-medium text-muted-foreground">Texto do template *</Label>
                {validation && <ValidationBadge result={validation} />}
              </div>
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`Cole aqui um exemplo real do template que será enviado no Telegram.\n\nEx:\n🟢 PROCEDIMENTO 130 - 08/05/2026\n🟢 PROCEDIMENTO REFERENTE A SUPERODD DA BETESPORTE 🔥\n\nUTILIZAREMOS O JOGO ENTRE:\nLIVERPOOL X CHELSEA - 09/05/2026 ÀS 08:30\n\n🟡 OBJETIVO DUPLO GREEN - 💵 210,00\n😍 chance de duplo green 😍`}
                className="font-mono text-xs resize-none bg-background/50 min-h-[240px]"
                data-testid="textarea-custom-template-text"
              />
            </div>
          </div>

          {/* Coluna direita — resultado da validação */}
          <div className="flex flex-col gap-3 md:pl-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Resultado da validação
            </p>
            <div className="flex-1 bg-muted/20 border border-border/40 rounded-xl p-4 min-h-[240px]">
              <ValidationPanel result={validation} text={text} />
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 pb-5 pt-3 border-t border-border/40 flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose} data-testid="btn-cancel-custom-template">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'gap-1.5',
              canSave
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'opacity-40 cursor-not-allowed',
            )}
            data-testid="btn-save-custom-template"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {validation?.ok === false
              ? 'Bot não consegue ler — corrija'
              : !name.trim()
              ? 'Informe um nome'
              : 'Salvar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────

export default function BotTemplates() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeCustomId, setActiveCustomId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  // For custom template editing before copy
  const [customEditText, setCustomEditText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
  }, []);

  const template = TEMPLATES[activeIdx];

  useEffect(() => {
    if (activeCustomId) return;
    const defaults: Record<string, string> = {};
    template.fields.forEach(f => {
      defaults[f.id] = f.default ? f.default() : '';
    });
    setFields(defaults);
    setShowOptional(false);
    setCopied(false);
  }, [activeIdx, activeCustomId]);

  // When switching to a custom template, pre-fill edit text
  useEffect(() => {
    if (!activeCustomId) return;
    const ct = customTemplates.find(t => t.id === activeCustomId);
    if (ct) setCustomEditText(ct.text);
    setCopied(false);
  }, [activeCustomId, customTemplates]);

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

  function selectBuiltin(idx: number) {
    setActiveIdx(idx);
    setActiveCustomId(null);
  }

  function selectCustom(id: string) {
    setActiveCustomId(id);
  }

  const preview = activeCustomId ? customEditText : template.generate(fields);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
    } catch {
      const el = document.createElement('textarea');
      el.value = preview;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  function handleSaveCustom(t: CustomTemplate) {
    const updated = [...customTemplates, t];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setActiveCustomId(t.id);
  }

  function handleDeleteCustom(id: string) {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    if (activeCustomId === id) {
      setActiveCustomId(null);
    }
    setDeleteConfirmId(null);
  }

  const requiredFields = template.fields.filter(f => !f.optional);
  const optionalFields = template.fields.filter(f => f.optional);

  // Validation for active custom template live text
  const customValidation = useMemo<ParseResult | null>(() => {
    if (!activeCustomId || !customEditText.trim()) return null;
    return parseMessage(customEditText);
  }, [activeCustomId, customEditText]);

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
        <div className="flex gap-2 flex-wrap items-center" data-testid="template-tabs">
          {/* Built-in tabs */}
          {TEMPLATES.map((t, i) => (
            <button
              key={t.id}
              data-testid={`tab-template-${t.id}`}
              onClick={() => selectBuiltin(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-200',
                !activeCustomId && i === activeIdx
                  ? t.color + ' shadow-sm'
                  : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground bg-card/50',
              )}
            >
              <span className={cn(
                'w-2 h-2 rounded-full shrink-0',
                !activeCustomId && i === activeIdx ? t.dotColor : 'bg-muted-foreground/30',
              )} />
              {t.shortName}
            </button>
          ))}

          {/* Separator */}
          {customTemplates.length > 0 && (
            <span className="w-px h-6 bg-border/50 mx-1" />
          )}

          {/* Custom template tabs */}
          {customTemplates.map(ct => (
            <div key={ct.id} className="flex items-center gap-0.5">
              <button
                data-testid={`tab-custom-${ct.id}`}
                onClick={() => selectCustom(ct.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-l-xl text-sm font-medium border border-r-0 transition-all duration-200',
                  activeCustomId === ct.id
                    ? 'bg-slate-500/15 text-slate-300 border-slate-500/30 shadow-sm'
                    : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground bg-card/50',
                )}
              >
                <Pencil className="h-3 w-3 shrink-0" />
                {ct.name}
              </button>
              <button
                onClick={() => setDeleteConfirmId(ct.id)}
                className={cn(
                  'flex items-center justify-center px-1.5 py-2 rounded-r-xl text-sm border transition-all duration-200',
                  activeCustomId === ct.id
                    ? 'bg-slate-500/15 text-slate-400 border-slate-500/30 hover:text-red-400 hover:bg-red-500/10'
                    : 'border-border/50 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 bg-card/50',
                )}
                data-testid={`btn-delete-custom-${ct.id}`}
                title="Excluir template"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Add new template button */}
          <button
            onClick={() => setCreateModalOpen(true)}
            data-testid="btn-new-custom-template"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-dashed border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo
          </button>
        </div>

        {/* Delete confirm */}
        <AnimatePresence>
          {deleteConfirmId && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
            >
              <Trash2 className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-foreground flex-1">
                Excluir <strong>"{customTemplates.find(t => t.id === deleteConfirmId)?.name}"</strong>? Esta ação não pode ser desfeita.
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteConfirmId(null)}
                className="text-muted-foreground h-7 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => handleDeleteCustom(deleteConfirmId)}
                className="h-7 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
              >
                Excluir
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Description */}
        <motion.div
          key={activeCustomId ?? template.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-muted-foreground bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5"
        >
          {activeCustomId ? (
            <>
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5 text-slate-400" />
                {customTemplates.find(t => t.id === activeCustomId)?.name}
              </span>
              {' — '}Template personalizado. Edite o texto à vontade antes de copiar.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{template.name}</span>
              {' — '}{template.description}
            </>
          )}
        </motion.div>

        {/* Main grid */}
        <AnimatePresence mode="wait">
          {activeCustomId ? (
            /* ── Custom template panel ── */
            <motion.div
              key={`custom-${activeCustomId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
            >
              {/* Editor */}
              <div className="flex flex-col gap-4 bg-card border border-border rounded-2xl p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Edite antes de copiar</p>
                  <div className="flex items-center gap-2">
                    {customValidation && <ValidationBadge result={customValidation} />}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const ct = customTemplates.find(t => t.id === activeCustomId);
                        if (ct) setCustomEditText(ct.text);
                      }}
                      className="h-7 text-xs text-muted-foreground gap-1.5"
                      data-testid="btn-reset-custom"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Restaurar
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={customEditText}
                  onChange={e => setCustomEditText(e.target.value)}
                  className="font-mono text-xs resize-none bg-background/50 min-h-[280px]"
                  data-testid="textarea-custom-edit"
                />

                {/* Validation detail */}
                {customValidation && (
                  <div className="border-t border-border/40 pt-3">
                    <ValidationPanel result={customValidation} text={customEditText} />
                  </div>
                )}
              </div>

              {/* Preview + copy */}
              <div className="flex flex-col gap-3 bg-card border border-border rounded-2xl p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Preview — copie e envie no Telegram</p>
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                    <Pencil className="h-2.5 w-2.5 mr-1" />
                    Personalizado
                  </Badge>
                </div>

                <div
                  className="bg-muted/20 border border-border/50 rounded-xl p-4 font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap min-h-[200px] select-all"
                  data-testid="template-preview"
                >
                  {customEditText || <span className="text-muted-foreground/40">O texto aparece aqui...</span>}
                </div>

                <Button
                  onClick={handleCopy}
                  disabled={!customEditText.trim()}
                  className={cn(
                    'w-full h-11 font-semibold gap-2 transition-all duration-300',
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg',
                  )}
                  data-testid="btn-copy-template"
                >
                  {copied ? (
                    <><Check className="h-4 w-4" />Copiado! Cole direto no Telegram</>
                  ) : (
                    <><Copy className="h-4 w-4" />Copiar Template</>
                  )}
                </Button>

                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  O bot confirma em até 3 segundos com <span className="text-emerald-400 font-medium">✅ Procedimento registrado</span>
                </p>
              </div>
            </motion.div>
          ) : (
            /* ── Built-in template panel ── */
            <motion.div
              key={template.id + '-grid'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
            >
              {/* Form */}
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

                <div className="flex flex-col gap-3">
                  {requiredFields.map(f => (
                    <FieldInput key={f.id} field={f} value={fields[f.id] ?? ''} onChange={v => setField(f.id, v)} />
                  ))}
                </div>

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

              {/* Preview */}
              <div className="flex flex-col gap-3 bg-card border border-border rounded-2xl p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Preview — copie e envie no Telegram</p>
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                    {template.emoji} {template.shortName}
                  </Badge>
                </div>

                <div
                  className="bg-muted/20 border border-border/50 rounded-xl p-4 font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap min-h-[200px] select-all"
                  data-testid="template-preview"
                >
                  {preview}
                </div>

                <Button
                  onClick={handleCopy}
                  className={cn(
                    'w-full h-11 font-semibold gap-2 transition-all duration-300',
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg',
                  )}
                  data-testid="btn-copy-template"
                >
                  {copied ? (
                    <><Check className="h-4 w-4" />Copiado! Cole direto no Telegram</>
                  ) : (
                    <><Copy className="h-4 w-4" />Copiar Template</>
                  )}
                </Button>

                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  O bot confirma em até 3 segundos com <span className="text-emerald-400 font-medium">✅ Procedimento registrado</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick rules */}
        <div className="bg-muted/20 border border-border/40 rounded-2xl p-4 md:p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Regras que o bot verifica</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ['🟢 ou 🔵 + PROCEDIMENTO N - DD/MM/AAAA', 'Primeira linha obrigatória'],
              ['CASA: NomeDaCasa ou DA NOMECASA', 'Identificação da casa de apostas'],
              ['Time A X Time B - DD/MM/AAAA ÀS HH:MM', 'Formato exato da partida'],
              ['LUCRO: 💵 X,XX ou OBJETIVO DUPLO GREEN - 💵 X,XX', 'Valor de lucro previsto'],
              ['X,XX EM FREEBET', 'Obrigatório para templates de Freebet'],
              ['REFERENTE ÀS FREEBETS DO PROCEDIMENTO N', 'Obrigatório para Queimar FB'],
            ].map(([rule, desc]) => (
              <div key={rule} className="flex gap-2 text-xs">
                <span className="font-mono text-primary/80 leading-relaxed shrink-0">{rule}</span>
                <span className="text-muted-foreground">— {desc}</span>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Modal criar template */}
      <CreateTemplateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleSaveCustom}
      />
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
          field.uppercase && 'uppercase placeholder:normal-case',
        )}
        data-testid={`input-field-${field.id}`}
      />
      {field.hint && (
        <p className="text-[11px] text-muted-foreground/70">{field.hint}</p>
      )}
    </div>
  );
}
