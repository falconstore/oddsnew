import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X, Star, FileText, Calendar, Building2, Tag, TrendingUp, Link, Hash, Ticket, Zap, Trophy, Clock, Activity, Shield } from 'lucide-react';
import { TagManager } from './TagManager';
import { EventoAutocomplete } from './EventoAutocomplete';
import { OrigemFreebetAutocomplete } from './OrigemFreebetAutocomplete';
import {
  Procedure,
  ProcedureFormData,
  ProcedureType,
  PROCEDURE_CATEGORIES,
  PROCEDURE_STATUSES,
  PROCEDURE_TYPES,
  PROCEDURE_SPORTS,
} from '@/types/procedures';
import { useCreateProcedure, useUpdateProcedure, useProcedures } from '@/hooks/useProcedures';
import { getAllTags, getAllPlatforms } from '@/lib/procedureUtils';
import { useBookmakers } from '@/hooks/useOddsData';

interface ProcedureModalProps {
  procedure: Procedure | null;
  onClose: () => void;
}

const emptyForm: ProcedureFormData = {
  date: '',
  procedure_number: '',
  platform: '',
  promotion_name: '',
  category: 'Promoção',
  status: 'Enviado',
  freebet_reference: '',
  freebet_value: '',
  profit_loss: '',
  telegram_link: '',
  dp: false,
  tags: [],
  is_favorite: false,
  data_partida: '',
  horario_partida: '',
  partida_descricao: '',
  tipo: 'SEM_FB',
  // Paridade FULL FreeBet Pro
  kickoff_at: null,
  fixture_id: null,
  esporte: 'futebol',
  cenario_b_cash: '',
  freebet_reference_id: null,
};

function FieldLabel({ icon: Icon, label, required }: { icon: typeof FileText; label: string; required?: boolean }) {
  return (
    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
      <Icon className="w-3 h-3" />
      {label}
      {required && <span className="text-primary">*</span>}
    </Label>
  );
}

export function ProcedureModal({ procedure, onClose }: ProcedureModalProps) {
  const { data: allProcedures = [] } = useProcedures();
  const { data: bookmakers = [] } = useBookmakers();
  const createProcedure = useCreateProcedure();
  const updateProcedure = useUpdateProcedure();

  const [formData, setFormData] = useState<ProcedureFormData>(emptyForm);

  const activeBookmakerNames = bookmakers
    .filter(b => b.status === 'active')
    .sort((a, b) => a.priority - b.priority)
    .map(b => b.name);

  const procedurePlatforms = getAllPlatforms(allProcedures);
  const extraPlatforms = procedurePlatforms.filter(
    p => !activeBookmakerNames.some(n => n.toLowerCase() === p.toLowerCase())
  );

  const allKnownPlatforms = [...activeBookmakerNames, ...extraPlatforms];
  const hasLegacyPlatform = !!formData.platform && !allKnownPlatforms.some(
    n => n.toLowerCase() === formData.platform.toLowerCase()
  );
  const platformOptions: { value: string; label: string }[] = [
    ...(hasLegacyPlatform ? [{ value: formData.platform, label: `${formData.platform} (valor salvo)` }] : []),
    ...activeBookmakerNames.map(n => ({ value: n, label: n })),
    ...extraPlatforms.map(n => ({ value: n, label: n })),
  ];

  const availableTags = getAllTags(allProcedures);

  // Próximo Nº livre (paridade FreeBet Pro §8.2)
  const suggestedNextNumber = useMemo(() => {
    const nums = allProcedures
      .map(p => parseInt(p.procedure_number, 10))
      .filter(n => !isNaN(n));
    return nums.length ? String(Math.max(...nums) + 1) : '1';
  }, [allProcedures]);

  useEffect(() => {
    if (procedure) {
      // Backfill UX: dados pré-migration não tinham `tipo` setado (default 'SEM_FB' no DB).
      // Inferimos pela presença de freebet_value/reference pra não esconder esses campos
      // no modal (e evitar limpá-los silenciosamente ao salvar).
      const hasLegacyFB = !procedure.tipo || procedure.tipo === 'SEM_FB';
      const fbVal = procedure.freebet_valor_previsto ?? procedure.freebet_value;
      const inferredTipo = hasLegacyFB && ((fbVal && fbVal > 0) || procedure.freebet_reference)
        ? 'GANHAR_FB'
        : (procedure.tipo || 'SEM_FB');

      setFormData({
        date: procedure.date || '',
        procedure_number: procedure.procedure_number || '',
        platform: procedure.platform || '',
        promotion_name: procedure.promotion_name || '',
        category: procedure.category || 'Promoção',
        status: procedure.status || 'Enviado',
        freebet_reference: procedure.freebet_reference || '',
        freebet_value: fbVal?.toString() || '',
        profit_loss: (procedure.lucro_prejuizo_previsto ?? procedure.profit_loss)?.toString() || '',
        telegram_link: procedure.telegram_link || '',
        dp: procedure.dp || false,
        tags: procedure.tags || [],
        is_favorite: procedure.is_favorite || false,
        data_partida: procedure.data_partida || '',
        horario_partida: procedure.horario_partida ? procedure.horario_partida.slice(0, 5) : '',
        partida_descricao: procedure.partida_descricao || '',
        tipo: inferredTipo,
        // Paridade FULL
        kickoff_at: procedure.kickoff_at || null,
        fixture_id: procedure.fixture_id ?? null,
        esporte: procedure.esporte || 'futebol',
        cenario_b_cash: procedure.cenario_b_cash != null ? String(procedure.cenario_b_cash) : '',
        freebet_reference_id: procedure.freebet_reference_id || null,
      });
    } else {
      setFormData({ ...emptyForm, procedure_number: suggestedNextNumber, date: new Date().toISOString().slice(0, 10) });
    }
  }, [procedure, suggestedNextNumber]);

  const showFreebetFields = formData.tipo !== 'SEM_FB';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const previstoLucro = parseFloat(formData.profit_loss) || 0;
    const previstoFB = formData.freebet_value ? parseFloat(formData.freebet_value) : null;

    // Se o procedimento já foi conferido (resultado_lucro != null), o `profit_loss`
    // deve continuar refletindo o REALIZADO (resultado_lucro), não o previsto. Sem isso,
    // editar a previsão depois de Conferir dessincronizava os KPIs/gráficos legados.
    const alreadyChecked = procedure?.resultado_lucro != null;
    const profitLossToWrite = alreadyChecked ? (procedure!.resultado_lucro as number) : previstoLucro;

    // Paridade FULL — sincroniza data_partida + horario_partida com kickoff_at em
    // America/Sao_Paulo (fonte de verdade visual). Importante: as colunas legadas
    // continuam sendo escritas pra não quebrar consultas/relatórios antigos.
    let data_partida = formData.data_partida || null;
    let horario_partida = formData.horario_partida || null;
    if (formData.kickoff_at) {
      const k = new Date(formData.kickoff_at);
      data_partida = k.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
      horario_partida = k.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    const cenarioBCash = formData.cenario_b_cash.trim() === ''
      ? null
      : (parseFloat(formData.cenario_b_cash) || 0);

    const dataToSubmit = {
      date: formData.date,
      procedure_number: formData.procedure_number,
      platform: formData.platform,
      promotion_name: formData.promotion_name || null,
      category: formData.category,
      status: formData.status,
      freebet_reference: showFreebetFields ? (formData.freebet_reference || null) : null,
      // Mantemos as colunas legadas espelhadas (gráficos/KPIs leem profit_loss/freebet_value)
      freebet_value: showFreebetFields ? previstoFB : null,
      profit_loss: profitLossToWrite,
      telegram_link: formData.telegram_link || null,
      dp: formData.dp,
      tags: formData.tags,
      is_favorite: formData.is_favorite,
      created_by: null,
      // Paridade FreeBet Pro
      data_partida,
      horario_partida,
      partida_descricao: formData.partida_descricao || null,
      tipo: formData.tipo,
      lucro_prejuizo_previsto: previstoLucro,
      freebet_valor_previsto: showFreebetFields ? previstoFB : null,
      // Paridade FULL FreeBet Pro
      kickoff_at: formData.kickoff_at || null,
      fixture_id: formData.fixture_id ?? null,
      esporte: formData.esporte || 'futebol',
      cenario_b_cash: cenarioBCash,
      // QUEIMAR_FB: preserva o vínculo UUID com a origem
      freebet_reference_id: formData.tipo === 'QUEIMAR_FB' ? formData.freebet_reference_id : null,
    };

    try {
      if (procedure) {
        await updateProcedure.mutateAsync({ id: procedure.id, ...dataToSubmit });
      } else {
        await createProcedure.mutateAsync(dataToSubmit as Omit<Procedure, 'id' | 'created_date' | 'updated_date'>);
      }
      onClose();
    } catch {
      /* handled in hooks */
    }
  };

  const isLoading = createProcedure.isPending || updateProcedure.isPending;
  const isEditing = !!procedure;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 animate-fade-in-up">
        {/* Header */}
        <div className="relative flex-shrink-0 bg-gradient-to-r from-cyan-500/10 via-primary/5 to-transparent border-b border-white/10 p-5">
          <div className="absolute inset-0 bg-gradient-to-b from-background/95 to-background/80" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-cyan-500/5 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <FileText className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  {isEditing ? 'Editar Procedimento' : 'Novo Procedimento'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEditing ? `Editando #${procedure?.procedure_number}` : 'Preencha os dados do procedimento'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData({ ...formData, is_favorite: !formData.is_favorite })}
                data-testid="button-toggle-favorite-modal"
                className={`h-9 w-9 rounded-xl transition-all ${formData.is_favorite ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20' : 'text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10'}`}
              >
                <Star className={`w-4.5 h-4.5 ${formData.is_favorite ? 'fill-yellow-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                disabled={isLoading}
                data-testid="button-close-modal"
                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10"
              >
                <X className="w-4.5 h-4.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-background/95 p-5">
          <form onSubmit={handleSubmit} id="procedure-form" className="space-y-5">
            {/* Section: Identificação */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Identificação</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <FieldLabel icon={Calendar} label="Data" required />
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    data-testid="input-date"
                    className="bg-white/5 border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20 h-9 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel icon={Hash} label="Nº Procedimento" required />
                  <Input
                    value={formData.procedure_number}
                    onChange={(e) => setFormData({ ...formData, procedure_number: e.target.value })}
                    required
                    data-testid="input-procedure-number"
                    placeholder={`Próximo livre: ${suggestedNextNumber}`}
                    className="bg-white/5 border-white/10 focus:border-cyan-500/50 h-9 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel icon={Building2} label="Plataforma" required />
                  <Select
                    value={formData.platform}
                    onValueChange={(v) => setFormData({ ...formData, platform: v })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-cyan-500/50 h-9 text-sm" data-testid="select-platform">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section: Jogo / Evento (paridade FULL FreeBet Pro doc 02 — autocomplete API-Football) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">Jogo / Evento</span>
                <span className="text-[10px] text-muted-foreground ml-2">(autocomplete via API-Football)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <FieldLabel icon={Trophy} label="Partida (busca ao vivo)" />
                  <EventoAutocomplete
                    partidaDescricao={formData.partida_descricao}
                    fixtureId={formData.fixture_id}
                    kickoffAt={formData.kickoff_at}
                    onChange={(p) => setFormData((f) => ({
                      ...f,
                      partida_descricao: p.partida_descricao,
                      fixture_id: p.fixture_id,
                      kickoff_at: p.kickoff_at,
                      esporte: p.esporte ?? f.esporte,
                    }))}
                    inputClassName="bg-amber-500/5 border-amber-500/20 focus:border-amber-500/50 h-9 text-sm pr-10"
                  />
                </div>
                <div>
                  <FieldLabel icon={Activity} label="Esporte" />
                  <Select value={formData.esporte} onValueChange={(v) => setFormData({ ...formData, esporte: v })}>
                    <SelectTrigger
                      className="bg-amber-500/5 border-amber-500/20 focus:border-amber-500/50 h-9 text-sm"
                      data-testid="select-esporte"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_SPORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <FieldLabel icon={Calendar} label="Data (manual fallback)" />
                  <Input
                    type="date"
                    value={formData.data_partida}
                    onChange={(e) => setFormData({ ...formData, data_partida: e.target.value, kickoff_at: null, fixture_id: null })}
                    data-testid="input-data-partida"
                    className="bg-amber-500/5 border-amber-500/20 focus:border-amber-500/50 h-9 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel icon={Clock} label="Horário (manual fallback)" />
                  <Input
                    type="time"
                    value={formData.horario_partida}
                    onChange={(e) => setFormData({ ...formData, horario_partida: e.target.value, kickoff_at: null, fixture_id: null })}
                    data-testid="input-horario-partida"
                    className="bg-amber-500/5 border-amber-500/20 focus:border-amber-500/50 h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Section: Promoção */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Promoção</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-1">
                  <FieldLabel icon={FileText} label="Nome da Promoção" />
                  <Input
                    value={formData.promotion_name}
                    onChange={(e) => setFormData({ ...formData, promotion_name: e.target.value })}
                    data-testid="input-promotion-name"
                    placeholder="Nome da promoção..."
                    className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel icon={Tag} label="Categoria" required />
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel icon={FileText} label="Status" required />
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section: Tipo de Freebet (paridade FreeBet Pro §8.2) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-purple-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-purple-400">Tipo de Freebet</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PROCEDURE_TYPES.map(({ value, label, description }) => {
                  const selected = formData.tipo === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, tipo: value as ProcedureType })}
                      data-testid={`button-tipo-${value.toLowerCase()}`}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selected
                          ? 'bg-purple-500/15 border-purple-500/50 text-purple-200'
                          : 'bg-white/[0.03] border-white/10 text-muted-foreground hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Ticket className="w-3.5 h-3.5" />
                        {label}
                      </div>
                      <p className="text-[11px] mt-1 opacity-80">{description}</p>
                    </button>
                  );
                })}
              </div>

              {showFreebetFields && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel icon={Ticket} label={formData.tipo === 'QUEIMAR_FB' ? 'Origem da Freebet' : 'Referência Freebet'} required={formData.tipo === 'QUEIMAR_FB'} />
                    {formData.tipo === 'QUEIMAR_FB' ? (
                      <OrigemFreebetAutocomplete
                        procedures={allProcedures}
                        currentId={procedure?.id ?? null}
                        refValue={formData.freebet_reference}
                        refId={formData.freebet_reference_id}
                        onChange={(next) => setFormData({
                          ...formData,
                          freebet_reference: next.freebet_reference,
                          freebet_reference_id: next.freebet_reference_id,
                        })}
                        inputClassName="bg-purple-500/5 border-purple-500/20 focus:border-purple-500/50 h-9 text-sm pr-8"
                      />
                    ) : (
                      <Input
                        value={formData.freebet_reference}
                        onChange={(e) => setFormData({ ...formData, freebet_reference: e.target.value })}
                        data-testid="input-freebet-reference"
                        placeholder="Referência..."
                        className="bg-purple-500/5 border-purple-500/20 focus:border-purple-500/50 h-9 text-sm"
                      />
                    )}
                  </div>
                  <div>
                    <FieldLabel icon={Ticket} label="Valor Freebet (previsto)" />
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.freebet_value}
                      onChange={(e) => setFormData({ ...formData, freebet_value: e.target.value })}
                      data-testid="input-freebet-value"
                      placeholder="0.00"
                      className="bg-purple-500/5 border-purple-500/20 focus:border-purple-500/50 h-9 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Cenário B (cash) — só faz sentido pra GANHAR_FB com hedge (paridade doc 01) */}
              {formData.tipo === 'GANHAR_FB' && (
                <div className="mt-3">
                  <FieldLabel icon={Shield} label="Cenário B — cash do hedge (opcional)" />
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cenario_b_cash}
                    onChange={(e) => setFormData({ ...formData, cenario_b_cash: e.target.value })}
                    data-testid="input-cenario-b-cash"
                    placeholder="Ex: 25.00 (lucro/prejuízo no cenário em que NÃO ganha a FB)"
                    className="bg-purple-500/5 border-purple-500/20 focus:border-purple-500/50 h-9 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Section: Previsão (resultado real entra no modal "Definir Resultados") */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Previsão</span>
                <span className="text-[10px] text-muted-foreground ml-2">(o resultado real é registrado pelo botão "Conferir")</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <FieldLabel icon={TrendingUp} label="Lucro/Prejuízo previsto" required />
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.profit_loss}
                    onChange={(e) => setFormData({ ...formData, profit_loss: e.target.value })}
                    required
                    data-testid="input-profit-loss"
                    placeholder="0.00"
                    className="bg-emerald-500/5 border-emerald-500/20 focus:border-emerald-500/50 h-9 text-sm font-mono"
                  />
                </div>
                <div>
                  <FieldLabel icon={Link} label="Link Telegram" />
                  <Input
                    value={formData.telegram_link}
                    onChange={(e) => setFormData({ ...formData, telegram_link: e.target.value })}
                    data-testid="input-telegram-link"
                    placeholder="https://t.me/..."
                    className="bg-white/5 border-white/10 focus:border-cyan-500/50 h-9 text-sm"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-3 h-9 px-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 w-full">
                    <Switch
                      id="dp"
                      checked={formData.dp}
                      onCheckedChange={(checked) => setFormData({ ...formData, dp: checked })}
                      data-testid="switch-dp"
                    />
                    <Label htmlFor="dp" className="text-sm cursor-pointer flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      Duplo Green (DP)
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Tags */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Tags</span>
              </div>
              <TagManager
                tags={formData.tags}
                onChange={(tags) => setFormData({ ...formData, tags })}
                availableTags={availableTags}
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-background/95 border-t border-white/10 px-5 py-4 flex items-center justify-between gap-3">
          <p className="text-[10px] text-muted-foreground">
            Campos com <span className="text-primary">*</span> são obrigatórios
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              data-testid="button-cancel-procedure"
              className="border-white/10 hover:bg-white/5 text-sm h-9"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="procedure-form"
              disabled={isLoading}
              data-testid="button-save-procedure"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/20 glow-primary h-9 text-sm px-6 font-semibold"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : (
                isEditing ? 'Atualizar' : 'Salvar'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
