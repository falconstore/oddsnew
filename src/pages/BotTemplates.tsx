import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, Bot, RefreshCw, ChevronDown, ChevronUp,
  Plus, Trash2, ShieldCheck, AlertTriangle, XCircle, Pencil, X,
  Power, PowerOff, Loader2, LifeBuoy, ClipboardCheck, CheckCircle2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/Sidebar';
import { parseMessage, type ParseResult } from '@/lib/botParser';
import { EventoAutocomplete } from '@/components/procedures/EventoAutocomplete';
import { useProcedures } from '@/hooks/useProcedures';
import { getAllPlatforms } from '@/lib/procedureUtils';
import { PROCEDURE_CATEGORIES } from '@/types/procedures';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

function kickoffToDateStr(iso: string | null): string {
  if (!iso) return 'DD/MM/AAAA';
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
function kickoffToTimeStr(iso: string | null): string {
  if (!iso) return 'HH:MM';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

interface FieldConfig {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'date' | 'time' | 'evento' | 'select' | 'toggle' | 'freebet_select';
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
const CUSTOM_CATEGORIES_KEY = 'bsk_procedure_categories';

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

function loadCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomCategories(cats: string[]) {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(cats));
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
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 130', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'numRef', label: 'Freebet a Queimar', placeholder: '', type: 'freebet_select', hint: 'Selecione o procedimento GANHAR_FB cuja freebet será queimada aqui.' },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Bet365', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Flamengo x Palmeiras', type: 'evento' },
      { id: 'lucro', label: 'Lucro Previsto (ex: 17,00)', placeholder: '17,00', type: 'text' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Freebet' },
      { id: 'evento2', label: 'Partida 2', placeholder: 'Ex: Real Madrid x Barcelona', type: 'evento', optional: true },
    ],
    generate: (f) => {
      const refStr = f.numRef || '[NNN]';
      const linha2 = `🟢 PROCEDIMENTO REFERENTE ÀS FREEBETS — REF N° ${refStr} 🔥`;
      const partidas = [`${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`];
      if (f.evento2) {
        partidas.push(`${f.evento2} - ${f.evento2_data || 'DD/MM/AAAA'} ÀS ${f.evento2_hora || 'HH:MM'}`);
      }
      return [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        linha2,
        `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
        ``,
        `UTILIZAREMOS O JOGO ENTRE:`,
        ...partidas,
        ``,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, CHAME O SUPORTE`,
        ``,
        `🟡 LUCRO: 💵 ${fmtVal(f.lucro)} 💵`,
        `📋 CATEGORIA: ${f.categoria || 'Freebet'}`,
        ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
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
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 129', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Sportingbet', type: 'text', uppercase: true },
      { id: 'campanha', label: 'Nome da Campanha', placeholder: 'Ex: SUPER SEXTOU', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida 1', placeholder: 'Ex: RB Leipzig x St Pauli', type: 'evento' },
      { id: 'freebetValor', label: 'Valor da Freebet (ex: 25,00)', placeholder: '25,00', type: 'text' },
      { id: 'obsRecompensa', label: 'Observação da Recompensa (opcional)', placeholder: 'Ex: A CADA GOL DO SANTOS', type: 'text', uppercase: true, hint: 'Aparece após "EM FREEBET". Deixe vazio se não houver condição especial.' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Freebet' },
      { id: 'evento2', label: 'Partida 2', placeholder: 'Ex: Real Madrid x Barcelona', type: 'evento', optional: true },
    ],
    generate: (f) => {
      const partidas = [`${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`];
      if (f.evento2) {
        partidas.push(`${f.evento2} - ${f.evento2_data || 'DD/MM/AAAA'} ÀS ${f.evento2_hora || 'HH:MM'}`);
      }
      const recompensa = `🟡 RECOMPENSA: 🎁 ${fmtVal(f.freebetValor)} EM FREEBET${f.obsRecompensa ? ` - ${f.obsRecompensa.toUpperCase()}` : ''}`;
      return [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
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
        `📋 CATEGORIA: ${f.categoria || 'Freebet'}`,
        ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
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
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 115', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'missao', label: 'Nome da Missão', placeholder: 'Ex: LIGA DOS CAMPEÕES', type: 'text', uppercase: true },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betano', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida 1', placeholder: 'Ex: Bayern x PSG', type: 'evento' },
      { id: 'freebetValor', label: 'Valor da Freebet (ex: 50,00)', placeholder: '50,00', type: 'text' },
      { id: 'obsRecompensa', label: 'Observação da Recompensa (opcional)', placeholder: 'Ex: A CADA GOL DO SANTOS', type: 'text', uppercase: true, hint: 'Aparece após "EM FREEBET". Deixe vazio se não houver condição especial.' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Extra' },
      { id: 'evento2', label: 'Partida 2', placeholder: 'Ex: Real Madrid x Barcelona', type: 'evento', optional: true },
    ],
    generate: (f) => {
      const partidas = [`${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`];
      if (f.evento2) {
        partidas.push(`${f.evento2} - ${f.evento2_data || 'DD/MM/AAAA'} ÀS ${f.evento2_hora || 'HH:MM'}`);
      }
      const recompensa = `🟡 RECOMPENSA: 🎁 ${fmtVal(f.freebetValor)} EM FREEBET${f.obsRecompensa ? ` - ${f.obsRecompensa.toUpperCase()}` : ''}`;
      return [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
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
        `📋 CATEGORIA: ${f.categoria || 'Extra'}`,
        ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green para um lado 😍`] : []),
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
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 116', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betesporte', type: 'text', uppercase: true, hint: 'A casa aparece na linha 2 ("DA BETESPORTE") — não precisa de linha CASA: separada neste tipo.' },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Corinthians x Vasco', type: 'evento' },
      { id: 'valorDG', label: 'Objetivo Duplo Green (ex: 210,00)', placeholder: '210,00', type: 'text' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Superodd' },
    ],
    generate: (f) => [
      `🔵 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      `🟢 PROCEDIMENTO REFERENTE A SUPERODD DA ${(f.casa || 'CASA').toUpperCase()} 🔥`,
      ``,
      `UTILIZAREMOS O JOGO ENTRE:`,
      `${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`,
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE CALCULADORA 🧮`,
      ``,
      `🟡 OBJETIVO DUPLO GREEN - 💵 ${fmtVal(f.valorDG)}`,
      `📋 CATEGORIA: ${f.categoria || 'Superodd'}`,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
    ].join('\n'),
  },
  {
    id: 'aumento_25',
    name: 'Aumento 25%',
    shortName: 'Aumento 25%',
    description: 'Promoção de aumento de 25% da casa. Exige 1 CPF. Lucro em range mínimo–máximo.',
    color: 'bg-green-500/15 text-green-400 border-green-500/30',
    dotColor: 'bg-green-400',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 141', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: BET365', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Real Oviedo x Getafe', type: 'evento' },
      { id: 'lucroMin', label: 'Lucro Mínimo (ex: 17,63)', placeholder: '17,63', type: 'text' },
      { id: 'lucroMax', label: 'Lucro Máximo (ex: 248,00)', placeholder: '248,00', type: 'text' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Promoção' },
    ],
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      ``,
      `🟢 PROCEDIMENTO REFERENTE AO AUMENTO DE 25%🔥`,
      ``,
      `CASA: ${(f.casa || 'CASA').toUpperCase()}`,
      ``,
      `🚨SERÁ NECESSÁRIO 1 CPF NA ${(f.casa || 'CASA').toUpperCase()}🚨`,
      ``,
      `UTILIZAREMOS A PARTIDA ENTRE:`,
      ``,
      `${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`,
      ``,
      `🟥 Atenção : sempre confere data e horário da partida nos bilhetes também.`,
      `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmo da imagem .`,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA!`,
      ``,
      `🟡LUCRO: 💵 ${fmtVal(f.lucroMin)} A ${fmtVal(f.lucroMax)}💵`,
      ``,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green😍`] : []),
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
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 117', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'campanha', label: 'Nome da Promoção/Campanha', placeholder: 'Ex: SUPER ODDS WEEK', type: 'text', uppercase: true },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betfair', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: São Paulo x Santos', type: 'evento' },
      { id: 'lucroMin', label: 'Lucro Mínimo (ex: 3,25)', placeholder: '3,25', type: 'text' },
      { id: 'lucroMax', label: 'Lucro Máximo (ex: 3,75)', placeholder: '3,75', type: 'text' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Promoção' },
    ],
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      `🟢 PROCEDIMENTO REFERENTE À PROMOÇÃO ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
      `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
      ``,
      `UTILIZAREMOS A PARTIDA ENTRE:`,
      `${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`,
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA 👆`,
      ``,
      `🟡 LUCRO: 💵 ${fmtVal(f.lucroMin)} À ${fmtVal(f.lucroMax)} 💵`,
      `📋 CATEGORIA: ${f.categoria || 'Promoção'}`,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
    ].join('\n'),
  },
  {
    id: 'aposta_protegida',
    name: 'Aposta Protegida',
    shortName: 'Aposta Protegida',
    description: 'Promoção OU lucra cash OU ganha freebet (cenários excludentes). Opção 2 vai para observações.',
    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dotColor: 'bg-orange-400',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 138', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Sportingbet', type: 'text', uppercase: true },
      { id: 'campanha', label: 'Nome da Campanha', placeholder: 'Ex: APOSTA PROTEGIDA', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Bahia x Cruzeiro', type: 'evento' },
      { id: 'lucro1', label: 'Opção 1 — Lucro cash se ganhar (ex: 2,00)', placeholder: '2,00', type: 'text' },
      { id: 'free1', label: 'Opção 1 — Freebet se ganhar fora (ex: 10,00)', placeholder: '10,00', type: 'text' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Promoção' },
      { id: 'obs', label: 'Opção 2 (opcional) — vai para observações', placeholder: 'Ex: LUCRO DE 16,00 / FORA FREE DE 100,00', type: 'text', optional: true, hint: 'Se houver uma segunda opção de valor, registre aqui. Fica salvo no campo Observações do procedimento.' },
    ],
    generate: (f) => {
      const lines = [
        `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
        `🟢 PROCEDIMENTO REFERENTE A PROMOÇÃO DA ${(f.casa || 'CASA').toUpperCase()} - ${(f.campanha || 'CAMPANHA').toUpperCase()} COM APOSTA GRÁTIS 🔥`,
        `CASA: 🏠 ${(f.casa || 'CASA').toUpperCase()}`,
        ``,
        `UTILIZAREMOS A PARTIDA ENTRE:`,
        `${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`,
        ``,
        `🟥 Atenção: sempre confere data e horário da partida nos bilhetes também.`,
        `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE A CALCULADORA`,
        ``,
        `🟡 LUCRO: 💵 ${fmtVal(f.lucro1)}`,
        `🟡 RECOMPENSA: 🎁 ${fmtVal(f.free1)} EM FREEBET`,
      ];
      if (f.obs && f.obs.trim()) {
        lines.push(`📝 OBS: OPÇÃO 2 — ${f.obs.trim().toUpperCase()}`);
      }
      lines.push(`📋 CATEGORIA: ${f.categoria || 'Promoção'}`);
      if (f.incluirDG !== 'false') lines.push(`😍 chance de duplo green 😍`);
      return lines.join('\n');
    },
  },
  {
    id: 'superodd_bolsa',
    name: 'Superodd — Bolsa de Aposta',
    shortName: 'Bolsa',
    description: 'Super Odd via Bolsa de Aposta (Smarkets, Betfair Exchange etc). Lucro em range com "OU ANULA".',
    color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    dotColor: 'bg-cyan-400',
    emoji: '🟢',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 140', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'valorTotal', label: 'Valor total a utilizar (ex: 100,00)', placeholder: '100,00', type: 'text' },
      { id: 'lucroMin', label: 'Lucro mínimo (ex: 8,00)', placeholder: '8,00', type: 'text' },
      { id: 'lucroMax', label: 'Lucro máximo (ex: 20,00)', placeholder: '20,00', type: 'text', hint: 'O texto "OU ANULA" é adicionado automaticamente.' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Superodd' },
    ],
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      ``,
      `🟢 PROCEDIMENTO REFERENTE A SUPER ODD DA BOLSA 🦈🔥`,
      ``,
      `🟢PLATAFORMAS`,
      ``,
      `( BOLSA DE APOSTA ) - UTILIZARÁ AO TODO ( 💵 ${fmtVal(f.valorTotal)} )`,
      ``,
      `🟥 Atenção : sempre confere data e horário da partida nos bilhetes também.`,
      `🟥 Atenção: Sempre confira se os links dos bilhetes são os mesmos da imagem .`,
      ``,
      `🟡 LUCRO : 💵 ${fmtVal(f.lucroMin)} À ${fmtVal(f.lucroMax)} OU ANULA 💵`,
      `📋 CATEGORIA: ${f.categoria || 'Superodd'}`,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
    ].join('\n'),
  },
  {
    id: 'tentativa_dg',
    name: 'Tentativa Duplo Green',
    shortName: 'Tentativa DG',
    description: 'Procedimento cash sem freebet com objetivo de Duplo Green. Usa CASA: separado.',
    color: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    dotColor: 'bg-violet-400',
    emoji: '🟡',
    fields: [
      { id: 'isExtra', label: 'É EXTRA? (reenvio)', placeholder: '', type: 'toggle', default: () => 'false' },
      { id: 'incluirDG', label: 'Chance de Duplo Green', placeholder: '', type: 'toggle', default: () => 'true' },
      { id: 'num', label: 'Nº do Procedimento', placeholder: 'Ex: 139', type: 'text' },
      { id: 'dataProc', label: 'Data do Procedimento', placeholder: '', type: 'date', default: todayISO },
      { id: 'casa', label: 'Casa de Apostas', placeholder: 'Ex: Betano', type: 'text', uppercase: true },
      { id: 'evento1', label: 'Partida', placeholder: 'Ex: Manchester City x Brentford', type: 'evento' },
      { id: 'valorDG', label: 'Objetivo Duplo Green (ex: 706,64)', placeholder: '706,64', type: 'text' },
      { id: 'categoria', label: 'Categoria', placeholder: '', type: 'select', default: () => 'Superodd' },
    ],
    generate: (f) => [
      `🟢 PROCEDIMENTO ${f.isExtra === 'true' ? 'EXTRA ' : ''}${f.num || 'NNN'} - ${fmtDate(f.dataProc)}`,
      ``,
      `PROCEDIMENTO REFERENTE : TENTATIVA DUPLO GREEN`,
      ``,
      `CASA: ${(f.casa || 'CASA').toUpperCase()}`,
      ``,
      `UTILIZAREMOS O JOGO ENTRE:`,
      `${f.evento1 || 'TIME A X TIME B'} - ${f.evento1_data || 'DD/MM/AAAA'} ÀS ${f.evento1_hora || 'HH:MM'}`,
      ``,
      `🔴 CASO HAJA ALTERAÇÃO NAS ODDS, UTILIZE CALCULADORA 🎲`,
      ``,
      `🟡 OBJETIVO DUPLO GREEN - 🟩 ${fmtVal(f.valorDG)}`,
      `📋 CATEGORIA: ${f.categoria || 'Superodd'}`,
      ...(f.incluirDG !== 'false' ? [`😍 chance de duplo green 😍`] : []),
    ].join('\n'),
  },
];

// ─────────────────────────────────────────
// FreebetSelectField — seletor de FB disponíveis para queimar
// ─────────────────────────────────────────

interface FreebetOption {
  procedure_number: string;
  platform: string | null;
  freebet_value: number | null;
  freebet_valor_previsto: number | null;
  partida_descricao: string | null;
  date: string | null;
  promotion_name: string | null;
  freebet_creditada: string | null;
  status: string | null;
}

function FreebetSelectField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: freebets = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['available_freebets_to_burn'],
    queryFn: async (): Promise<FreebetOption[]> => {
      const { data, error } = await supabase
        .from('procedures')
        .select('procedure_number, platform, freebet_value, freebet_valor_previsto, partida_descricao, date, promotion_name, freebet_creditada, status')
        .eq('tipo', 'GANHAR_FB')
        .eq('archived', false)
        .order('created_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as FreebetOption[];
    },
    staleTime: 30_000,
  });

  const fmtCurrency = (v: number | null) =>
    v != null ? `R$ ${v.toFixed(2).replace('.', ',')}` : null;

  const fmtDateBR = (iso: string | null) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // Multi-select: value é string CSV ("145, 147"). Internamente trabalhamos com array.
  const selectedNums = useMemo(
    () => value.split(',').map(s => s.trim()).filter(Boolean),
    [value]
  );
  const selectedSet = useMemo(() => new Set(selectedNums), [selectedNums]);
  const selectedFbs = useMemo(
    () => selectedNums.map(n => freebets.find(fb => fb.procedure_number === n)).filter(Boolean) as FreebetOption[],
    [selectedNums, freebets]
  );

  function toggleSelection(num: string) {
    const next = selectedSet.has(num)
      ? selectedNums.filter(n => n !== num)
      : [...selectedNums, num];
    onChange(next.join(', '));
  }

  function removeSelection(num: string) {
    onChange(selectedNums.filter(n => n !== num).join(', '));
  }

  // Elegíveis = SIM/AGUARDANDO ou ainda não definida (NULL)
  const elegiveis = useMemo(
    () => freebets.filter(fb =>
      fb.freebet_creditada == null ||
      ['SIM', 'AGUARDANDO'].includes(fb.freebet_creditada)
    ),
    [freebets]
  );

  const visible = showAll ? freebets : elegiveis;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return visible;
    return visible.filter(fb =>
      fb.procedure_number.includes(q) ||
      (fb.platform ?? '').toLowerCase().includes(q) ||
      (fb.partida_descricao ?? '').toLowerCase().includes(q) ||
      (fb.promotion_name ?? '').toLowerCase().includes(q)
    );
  }, [visible, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    queryClient.invalidateQueries({ queryKey: ['available_freebets_to_burn'] });
    refetch();
  }

  if (isLoading) {
    return (
      <div className="h-9 flex items-center gap-2 px-3 rounded-md border border-border/50 bg-background/50 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando freebets...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {/* Trigger */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); setSearch(''); }}
          data-testid="select-freebet-ref"
          className={cn(
            'h-9 flex-1 min-w-0 flex items-center justify-between gap-2 px-3 rounded-md border text-sm transition-colors',
            'bg-background/50 border-border/50 hover:border-border',
            open && 'border-primary/50 ring-1 ring-primary/20',
          )}
        >
          {selectedFbs.length > 0 ? (
            <span className="truncate text-foreground">
              {selectedFbs.length === 1
                ? `#${selectedFbs[0].procedure_number} · ${selectedFbs[0].platform ?? '—'} · ${fmtCurrency(selectedFbs[0].freebet_value ?? selectedFbs[0].freebet_valor_previsto) ?? '—'}`
                : `${selectedFbs.length} freebets selecionadas: ${selectedNums.join(', ')}`}
            </span>
          ) : selectedNums.length > 0 ? (
            <span className="truncate text-amber-400">
              REF N° {selectedNums.join(', ')} <span className="text-muted-foreground/60">(não encontrado na lista)</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione a(s) freebet(s) a queimar...</span>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          title="Atualizar lista"
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-border/50 bg-background/50 hover:border-border hover:bg-muted/50 transition-colors"
          data-testid="btn-refresh-freebets"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="relative z-50"
          >
            <div className="absolute top-0 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
              {/* Search + filtro */}
              <div className="flex flex-col gap-2 px-3 py-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nº, casa ou jogo..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
                    data-testid="input-freebet-search"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={showAll}
                      onChange={e => setShowAll(e.target.checked)}
                      className="h-3 w-3 accent-primary"
                      data-testid="check-show-all-freebets"
                    />
                    Mostrar todas (incluir NÃO/queimadas)
                  </label>
                  <span className="text-muted-foreground/60">
                    {filtered.length} de {freebets.length}
                  </span>
                </div>
                {selectedNums.length > 0 && (
                  <p className="text-[11px] text-cyan-400">
                    Múltipla seleção ativa — clique nos itens para adicionar/remover
                  </p>
                )}
              </div>

              {/* List */}
              <div className="max-h-60 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-6 px-3">
                    {freebets.length === 0
                      ? 'Nenhuma freebet GANHAR_FB ativa encontrada.'
                      : showAll
                        ? 'Nenhum resultado pra essa busca.'
                        : 'Nenhuma freebet elegível. Marque "Mostrar todas" pra ver as queimadas/expiradas.'}
                  </div>
                ) : (
                  filtered.map(fb => {
                    const val = fmtCurrency(fb.freebet_value ?? fb.freebet_valor_previsto);
                    const dataBR = fmtDateBR(fb.date);
                    const isSelected = selectedSet.has(fb.procedure_number);
                    const credStatus = fb.freebet_creditada ?? 'PENDENTE';
                    const credBadgeColor =
                      credStatus === 'SIM' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                      credStatus === 'AGUARDANDO' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                      credStatus === 'NAO' ? 'bg-red-500/15 text-red-300 border-red-500/30' :
                      'bg-muted/30 text-muted-foreground border-border/50';
                    return (
                      <button
                        key={fb.procedure_number}
                        type="button"
                        onClick={() => toggleSelection(fb.procedure_number)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors border-b border-border/30 last:border-0',
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/50 text-foreground',
                        )}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            #{fb.procedure_number} · {fb.platform ?? '—'} · {val ?? '—'}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', credBadgeColor)}>
                            {credStatus}
                          </span>
                          {isSelected && <Check className="h-3 w-3 text-primary ml-auto" />}
                        </div>
                        {(fb.partida_descricao || dataBR) && (
                          <span className={cn('text-xs', isSelected ? 'text-primary/70' : 'text-muted-foreground')}>
                            {[fb.partida_descricao, dataBR].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedNums.length > 0 && (
                <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{selectedNums.length} selecionada(s)</span>
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="text-[11px] text-red-400 hover:text-red-300"
                  >
                    Limpar todas
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards das FBs selecionadas */}
      {selectedFbs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {selectedFbs.map(fb => (
            <div key={fb.procedure_number} className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-3 py-2 flex flex-col gap-0.5 relative">
              <button
                type="button"
                onClick={() => removeSelection(fb.procedure_number)}
                className="absolute top-1.5 right-1.5 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remover seleção"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-2 text-xs flex-wrap pr-6">
                <span className="text-muted-foreground">Proc:</span>
                <span className="font-mono font-medium text-foreground">#{fb.procedure_number}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-cyan-400 font-medium">{fmtCurrency(fb.freebet_value ?? fb.freebet_valor_previsto) ?? '—'}</span>
                {fb.platform && <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-foreground">{fb.platform}</span>
                </>}
              </div>
              {fb.partida_descricao && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Jogo:</span>
                  <span className="text-foreground">{fb.partida_descricao}</span>
                  {fb.date && <span className="text-muted-foreground">{fmtDateBR(fb.date)}</span>}
                </div>
              )}
            </div>
          ))}
          {selectedFbs.length > 1 && (
            <p className="text-[11px] text-amber-400/90 px-1">
              ⚠ Vínculo automático será feito apenas com a 1ª (#{selectedFbs[0].procedure_number}). Os demais nºs aparecerão no texto da mensagem.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
    ASR: 'Aposta Sem Risco',
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
        {data.tags && data.tags.length > 0 && <>
          <span className="text-muted-foreground">Tags:</span>
          <span className="flex flex-wrap gap-1">
            {data.tags.map(t => (
              <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                {t}
              </span>
            ))}
          </span>
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
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeCustomId, setActiveCustomId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [eventoData, setEventoData] = useState<Record<string, { partida_descricao: string; fixture_id: number | null; kickoff_at: string | null }>>({});
  const [copied, setCopied] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [customEditText, setCustomEditText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [addingCategoryFor, setAddingCategoryFor] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // ── Bot enabled toggle ────────────────────────────────────
  const { data: botSettings, isLoading: botLoading } = useQuery({
    queryKey: ['system_settings_bot'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('bot_enabled')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data as { bot_enabled: boolean } | null;
    },
    staleTime: 30_000,
  });

  const botEnabled = botSettings?.bot_enabled ?? true;

  const toggleBot = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ bot_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: (_data, enabled) => {
      queryClient.setQueryData(['system_settings_bot'], { bot_enabled: enabled });
    },
  });

  useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
    setCustomCategories(loadCustomCategories());
  }, []);

  const template = TEMPLATES[activeIdx];

  useEffect(() => {
    if (activeCustomId) return;
    const defaults: Record<string, string> = {};
    template.fields.forEach(f => {
      defaults[f.id] = f.default ? f.default() : '';
    });
    setFields(defaults);
    setEventoData({});
    setShowOptional(false);
    setCopied(false);
  }, [activeIdx, activeCustomId]);

  useEffect(() => {
    if (!activeCustomId) return;
    const ct = customTemplates.find(t => t.id === activeCustomId);
    if (ct) setCustomEditText(ct.text);
    setCopied(false);
  }, [activeCustomId, customTemplates]);

  const setField = useCallback((id: string, value: string) => {
    setFields(prev => ({ ...prev, [id]: value }));
  }, []);

  const setEventoField = useCallback((id: string, partial: { partida_descricao: string; fixture_id: number | null; kickoff_at: string | null }) => {
    setEventoData(prev => ({ ...prev, [id]: partial }));
  }, []);

  const resetFields = useCallback(() => {
    const defaults: Record<string, string> = {};
    template.fields.forEach(f => {
      defaults[f.id] = f.default ? f.default() : '';
    });
    setFields(defaults);
    setEventoData({});
  }, [template]);

  // Build enriched fields: inject evento1/evento1_data/evento1_hora etc.
  const enrichedFields = useMemo(() => {
    const merged: Record<string, string> = { ...fields };
    for (const [id, ev] of Object.entries(eventoData)) {
      merged[id] = ev.partida_descricao;
      merged[`${id}_data`] = kickoffToDateStr(ev.kickoff_at);
      merged[`${id}_hora`] = kickoffToTimeStr(ev.kickoff_at);
    }
    return merged;
  }, [fields, eventoData]);

  function selectBuiltin(idx: number) {
    setActiveIdx(idx);
    setActiveCustomId(null);
  }

  function selectCustom(id: string) {
    setActiveCustomId(id);
  }

  const preview = activeCustomId ? customEditText : template.generate(enrichedFields);

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

  const allCategories = useMemo(
    () => [...PROCEDURE_CATEGORIES, ...customCategories],
    [customCategories],
  );

  function handleAddCategory(fieldId: string) {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const updated = allCategories.includes(trimmed)
      ? customCategories
      : [...customCategories, trimmed];
    if (!allCategories.includes(trimmed)) {
      setCustomCategories(updated);
      saveCustomCategories(updated);
    }
    setField(fieldId, trimmed);
    setAddingCategoryFor(null);
    setNewCategoryName('');
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
        <div className="flex items-start justify-between gap-3 pt-10 md:pt-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">Templates do Bot</h1>
              <p className="text-sm text-muted-foreground">Preencha e copie o procedimento pronto para enviar no Telegram</p>
            </div>
          </div>

          {/* Toggle ligar/desligar bot — visível para admins */}
          {isAdmin && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button
                onClick={() => toggleBot.mutate(!botEnabled)}
                disabled={botLoading || toggleBot.isPending}
                data-testid="btn-toggle-bot"
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200',
                  botEnabled
                    ? 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/25'
                    : 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25',
                  (botLoading || toggleBot.isPending) && 'opacity-60 cursor-not-allowed',
                )}
              >
                {botLoading || toggleBot.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : botEnabled ? (
                  <Power className="h-4 w-4" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
                Bot {botEnabled ? 'Ligado' : 'Desligado'}
              </button>
              <span className={cn(
                'text-[11px] font-medium',
                botEnabled ? 'text-primary/70' : 'text-red-400/70',
              )}>
                {botEnabled ? 'Registrando procedimentos' : 'Ignorando mensagens'}
              </span>
            </div>
          )}
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
                  {requiredFields.map(f =>
                    f.type === 'evento' ? (
                      <div key={f.id} className="flex flex-col gap-1">
                        <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                        <EventoAutocomplete
                          partidaDescricao={eventoData[f.id]?.partida_descricao ?? ''}
                          fixtureId={eventoData[f.id]?.fixture_id ?? null}
                          kickoffAt={eventoData[f.id]?.kickoff_at ?? null}
                          onChange={partial => setEventoField(f.id, partial)}
                          inputClassName="h-9 text-sm bg-background/50"
                        />
                      </div>
                    ) : f.type === 'select' ? (
                      <div key={f.id} className="flex flex-col gap-1">
                        <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                        <Select
                          value={fields[f.id] ?? ''}
                          onValueChange={v => {
                            if (v === '__add_new__') {
                              setAddingCategoryFor(f.id);
                              setNewCategoryName('');
                            } else {
                              setField(f.id, v);
                              setAddingCategoryFor(null);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm bg-background/50" data-testid={`select-${f.id}`}>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allCategories.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                            <SelectItem value="__add_new__" className="text-primary font-medium">
                              ➕ Adicionar nova...
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {addingCategoryFor === f.id && (
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={newCategoryName}
                              onChange={e => setNewCategoryName(e.target.value)}
                              placeholder="Nome da nova categoria..."
                              className="h-8 text-sm bg-background/50 flex-1"
                              onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(f.id); }}
                              autoFocus
                              data-testid="input-new-category"
                            />
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() => handleAddCategory(f.id)}
                              data-testid="btn-confirm-new-category"
                            >
                              Adicionar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => setAddingCategoryFor(null)}
                              data-testid="btn-cancel-new-category"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : f.type === 'freebet_select' ? (
                      <div key={f.id} className="flex flex-col gap-1">
                        <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                        <FreebetSelectField
                          value={fields[f.id] ?? ''}
                          onChange={v => setField(f.id, v)}
                        />
                        {f.hint && (
                          <p className="text-[11px] text-muted-foreground/60">{f.hint}</p>
                        )}
                      </div>
                    ) : (
                      <FieldInput key={f.id} field={f} value={fields[f.id] ?? ''} onChange={v => setField(f.id, v)} />
                    )
                  )}
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
                        animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: 'hidden' }}
                        className="flex flex-col gap-3 mt-3"
                      >
                        {optionalFields.map(f =>
                          f.type === 'evento' ? (
                            <div key={f.id} className="flex flex-col gap-1">
                              <Label className="text-xs font-medium text-muted-foreground">
                                {f.label}
                                <span className="ml-1 text-muted-foreground/50">(opcional)</span>
                              </Label>
                              <EventoAutocomplete
                                partidaDescricao={eventoData[f.id]?.partida_descricao ?? ''}
                                fixtureId={eventoData[f.id]?.fixture_id ?? null}
                                kickoffAt={eventoData[f.id]?.kickoff_at ?? null}
                                onChange={partial => setEventoField(f.id, partial)}
                                inputClassName="h-9 text-sm bg-background/50"
                              />
                            </div>
                          ) : f.type === 'select' ? (
                            <div key={f.id} className="flex flex-col gap-1">
                              <Label className="text-xs font-medium text-muted-foreground">
                                {f.label}
                                <span className="ml-1 text-muted-foreground/50">(opcional)</span>
                              </Label>
                              <Select
                                value={fields[f.id] ?? ''}
                                onValueChange={v => {
                                  if (v === '__add_new__') {
                                    setAddingCategoryFor(f.id);
                                    setNewCategoryName('');
                                  } else {
                                    setField(f.id, v);
                                    setAddingCategoryFor(null);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-9 text-sm bg-background/50" data-testid={`select-${f.id}`}>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {allCategories.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                  <SelectItem value="__add_new__" className="text-primary font-medium">
                                    ➕ Adicionar nova...
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {addingCategoryFor === f.id && (
                                <div className="flex gap-2 mt-1">
                                  <Input
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="Nome da nova categoria..."
                                    className="h-8 text-sm bg-background/50 flex-1"
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(f.id); }}
                                    autoFocus
                                    data-testid="input-new-category"
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => handleAddCategory(f.id)}
                                    data-testid="btn-confirm-new-category"
                                  >
                                    Adicionar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2"
                                    onClick={() => setAddingCategoryFor(null)}
                                    data-testid="btn-cancel-new-category"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <FieldInput key={f.id} field={f} value={fields[f.id] ?? ''} onChange={v => setField(f.id, v)} />
                          )
                        )}
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

        {/* Contingência */}
        <RegistrarPorTexto />

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
// RegistrarPorTexto — contingência quando o bot não registrou
// ─────────────────────────────────────────

function RegistrarPorTexto() {
  const [expanded, setExpanded] = useState(false);
  const [rawText, setRawText] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Normaliza o texto: garante emoji 🟢 no início (exigido pelo parser).
  // O gerente pode colar o texto direto do canal mesmo sem emoji.
  const normalizedText = useMemo(() => {
    const t = rawText.trim();
    if (!t) return '';
    return /^\s*[🟢🔵]/u.test(t) ? t : `🟢 ${t}`;
  }, [rawText]);

  const wasNormalized = rawText.trim().length > 0 && !/^\s*[🟢🔵]/u.test(rawText.trim());

  const parsed = useMemo<ParseResult | null>(() => {
    if (!normalizedText) return null;
    return parseMessage(normalizedText);
  }, [normalizedText]);

  const canRegister = parsed !== null && parsed.ok !== false && state !== 'loading';

  async function handleRegister() {
    if (!parsed || parsed.ok === false) return;
    setState('loading');
    const data = parsed.data;
    const payload: Record<string, unknown> = {
      procedure_number: data.procedure_number,
      external_id: data.external_id,
      promotion_name: data.titulo || undefined,
      date: data.date,
      created_date: data.date,
      platform: data.platform ?? '—',
      category: data.category,
      status: data.tipo === 'ASR' ? 'Aposta Sem Risco' : 'Enviada Partida em Aberto',
      tipo: data.tipo,
      partida_descricao: data.partida_descricao,
      kickoff_at: data.kickoff_at,
      data_partida: data.data_partida,
      horario_partida: data.horario_partida,
      lucro_prejuizo_previsto: data.lucro_prejuizo_previsto,
      freebet_valor_previsto: data.freebet_valor_previsto,
      freebet_value: data.freebet_valor_previsto,
      profit_loss: 0,
      dp: data.dp,
      tags: data.tags ?? [],
      is_favorite: false,
      archived: false,
      tachado: false,
      reenviado_count: 0,
      duplo_green_confirmado: false,
      esporte: 'futebol',
      observacoes: data.observacoes ?? undefined,
      bot_needs_review: true,
      bot_raw_message: normalizedText,
      bot_missing_fields: parsed.ok === 'partial'
        ? (parsed.data as { missingFields: string[] }).missingFields
        : null,
    };
    const { error } = await supabase.from('procedures').insert(payload);
    if (error) {
      setState('error');
      const isDup = error.code === '23505' || /duplicate key|procedures_external_id_key/i.test(error.message);
      if (isDup) {
        setErrorMsg(
          `Já existe um procedimento Nº ${data.procedure_number} cadastrado em ${data.date.split('-').reverse().join('/')}. ` +
          `Verifique no painel "Procedimentos" (talvez esteja com status "Concluído" ou em outra aba) — ` +
          `não é possível criar duas vezes o mesmo número na mesma data.`
        );
      } else {
        setErrorMsg(error.message);
      }
    } else {
      setState('success');
      setRawText('');
    }
  }

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-4 md:p-5 hover:bg-amber-500/5 transition-colors text-left"
        data-testid="btn-toggle-contingencia"
      >
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
          <LifeBuoy className="h-4 w-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-400">Contingência — Bot não registrou?</p>
          <p className="text-xs text-muted-foreground">Cole o texto da mensagem para registrar manualmente</p>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-amber-500/15 p-4 md:p-5 flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Use quando o bot perdeu uma mensagem (editada rapidamente, bot offline, webhook atrasado, etc).
                Cole o texto exato do canal e clique em <strong className="text-foreground">Registrar</strong>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Textarea */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Texto da mensagem do Telegram *
                    </Label>
                    {wasNormalized && (
                      <span className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                        🟢 adicionado automaticamente
                      </span>
                    )}
                  </div>
                  <Textarea
                    value={rawText}
                    onChange={e => { setRawText(e.target.value); setState('idle'); setErrorMsg(''); }}
                    placeholder={'Cole aqui o texto completo da mensagem do canal.\n\nNão precisa adicionar 🟢 — o sistema adiciona automaticamente se faltar.\n\nEx:\nPROCEDIMENTO 192 - 13/05/2026\nPROCEDIMENTO REFERENTE : TENTATIVA DUPLO GREEN\nCASA: SPORTY\n\nManchester City x Crystal Palace - 13/05/2026 ÀS 16:00\n\n🟡 OBJETIVO DUPLO GREEN - 🟩 134,00\n🟧 CATEGORIA: Superodd\n😍 chance de duplo green 😍'}
                    className="font-mono text-xs resize-none bg-background/50 min-h-[220px]"
                    data-testid="textarea-registrar-por-texto"
                  />
                </div>

                {/* Parse preview */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Campos detectados</p>
                  <div className="flex-1 bg-muted/20 border border-border/40 rounded-xl p-4 min-h-[220px]">
                    {!rawText.trim() ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center h-full">
                        <Bot className="h-8 w-8 text-muted-foreground/20" />
                        <p className="text-xs text-muted-foreground/50 italic">Cole o texto para ver o parse...</p>
                      </div>
                    ) : (
                      <ValidationPanel result={parsed} text={normalizedText} />
                    )}
                  </div>
                </div>
              </div>

              {/* Feedback states */}
              <AnimatePresence mode="wait">
                {state === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <p className="text-sm text-emerald-400 font-medium">Procedimento registrado com sucesso!</p>
                  </motion.div>
                )}
                {state === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"
                  >
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    <p className="text-sm text-red-400">{errorMsg || 'Erro ao registrar o procedimento.'}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-end gap-3">
                <Button
                  size="sm"
                  onClick={handleRegister}
                  disabled={!canRegister}
                  className={cn(
                    'gap-1.5',
                    canRegister
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                      : 'opacity-40 cursor-not-allowed bg-muted/20 text-muted-foreground border border-border/40',
                  )}
                  data-testid="btn-registrar-por-texto"
                >
                  {state === 'loading' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : state === 'success' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <ClipboardCheck className="h-3.5 w-3.5" />
                  )}
                  {state === 'loading' ? 'Registrando...' : state === 'success' ? 'Registrado!' : 'Registrar Procedimento'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  // Autocomplete pra campo "Casa de Apostas": sugere casas já usadas
  // no sistema (procedimentos existentes), evitando erro de digitação.
  // react-query dedupa a query entre instâncias, sem custo extra.
  const isCasaField = field.id === 'casa';
  const { data: procedures = [] } = useProcedures();
  const platformSuggestions = useMemo(
    () => (isCasaField ? getAllPlatforms(procedures) : []),
    [isCasaField, procedures],
  );
  const datalistId = isCasaField ? `casas-datalist-${field.id}` : undefined;

  const handleChange = (v: string) => {
    onChange(field.uppercase ? v.toUpperCase() : v);
  };

  if (field.type === 'toggle') {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <Label className="text-xs font-medium text-muted-foreground cursor-pointer" htmlFor={`toggle-${field.id}`}>
          {field.label}
        </Label>
        <Switch
          id={`toggle-${field.id}`}
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          data-testid={`toggle-field-${field.id}`}
        />
      </div>
    );
  }

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
        list={datalistId}
        className={cn(
          'h-9 text-sm bg-background/50',
          field.uppercase && 'uppercase placeholder:normal-case',
        )}
        data-testid={`input-field-${field.id}`}
      />
      {isCasaField && datalistId && (
        <datalist id={datalistId}>
          {platformSuggestions.map(p => (
            <option key={p} value={p} />
          ))}
        </datalist>
      )}
      {field.hint && (
        <p className="text-[11px] text-muted-foreground/70">{field.hint}</p>
      )}
    </div>
  );
}
