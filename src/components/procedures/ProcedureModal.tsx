import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X, Star, FileText, Calendar, Building2, Tag, TrendingUp, Link, Hash, Ticket, Zap } from 'lucide-react';
import { TagManager } from './TagManager';
import { Procedure, ProcedureFormData, PROCEDURE_CATEGORIES, PROCEDURE_STATUSES } from '@/types/procedures';
import { useCreateProcedure, useUpdateProcedure, useProcedures } from '@/hooks/useProcedures';
import { getAllTags } from '@/lib/procedureUtils';
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
  is_favorite: false
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

  // Include current value if it's not in the bookmakers list (backward compatibility)
  const platformOptions = formData.platform && !activeBookmakerNames.includes(formData.platform)
    ? [formData.platform, ...activeBookmakerNames]
    : activeBookmakerNames;

  const availableTags = getAllTags(allProcedures);

  useEffect(() => {
    if (procedure) {
      setFormData({
        date: procedure.date || '',
        procedure_number: procedure.procedure_number || '',
        platform: procedure.platform || '',
        promotion_name: procedure.promotion_name || '',
        category: procedure.category || 'Promoção',
        status: procedure.status || 'Enviado',
        freebet_reference: procedure.freebet_reference || '',
        freebet_value: procedure.freebet_value?.toString() || '',
        profit_loss: procedure.profit_loss?.toString() || '',
        telegram_link: procedure.telegram_link || '',
        dp: procedure.dp || false,
        tags: procedure.tags || [],
        is_favorite: procedure.is_favorite || false
      });
    } else {
      setFormData(emptyForm);
    }
  }, [procedure]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      date: formData.date,
      procedure_number: formData.procedure_number,
      platform: formData.platform,
      promotion_name: formData.promotion_name || null,
      category: formData.category,
      status: formData.status,
      freebet_reference: formData.freebet_reference || null,
      freebet_value: formData.freebet_value ? parseFloat(formData.freebet_value) : null,
      profit_loss: parseFloat(formData.profit_loss) || 0,
      telegram_link: formData.telegram_link || null,
      dp: formData.dp,
      tags: formData.tags,
      is_favorite: formData.is_favorite,
      created_by: null
    };
    try {
      if (procedure) {
        await updateProcedure.mutateAsync({ id: procedure.id, ...dataToSubmit });
      } else {
        await createProcedure.mutateAsync(dataToSubmit);
      }
      onClose();
    } catch {
      // handled in hooks
    }
  };

  const showFreebetFields = formData.category === 'Promoção' || formData.category === 'Freebet';
  const isLoading = createProcedure.isPending || updateProcedure.isPending;
  const isEditing = !!procedure;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
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
                className={`h-9 w-9 rounded-xl transition-all ${formData.is_favorite ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20' : 'text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10'}`}
              >
                <Star className={`w-4.5 h-4.5 ${formData.is_favorite ? 'fill-yellow-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                disabled={isLoading}
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
                    className="bg-white/5 border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20 h-9 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel icon={Hash} label="Nº Procedimento" required />
                  <Input
                    value={formData.procedure_number}
                    onChange={(e) => setFormData({ ...formData, procedure_number: e.target.value })}
                    required
                    placeholder="Ex: 1234"
                    className="bg-white/5 border-white/10 focus:border-cyan-500/50 h-9 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel icon={Building2} label="Plataforma" required />
                  <Select
                    value={formData.platform}
                    onValueChange={(v) => setFormData({ ...formData, platform: v })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-cyan-500/50 h-9 text-sm">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                    placeholder="Nome da promoção..."
                    className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel icon={Tag} label="Categoria" required />
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm">
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
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDURE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section: Freebet (conditional) */}
            {showFreebetFields && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-purple-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-purple-400">Freebet</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel icon={Ticket} label="Referência Freebet" />
                    <Input
                      value={formData.freebet_reference}
                      onChange={(e) => setFormData({ ...formData, freebet_reference: e.target.value })}
                      placeholder="Referência..."
                      className="bg-purple-500/5 border-purple-500/20 focus:border-purple-500/50 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <FieldLabel icon={Ticket} label="Valor Freebet" />
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.freebet_value}
                      onChange={(e) => setFormData({ ...formData, freebet_value: e.target.value })}
                      placeholder="0.00"
                      className="bg-purple-500/5 border-purple-500/20 focus:border-purple-500/50 h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section: Resultado */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Resultado</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <FieldLabel icon={TrendingUp} label="Lucro/Prejuízo" required />
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.profit_loss}
                    onChange={(e) => setFormData({ ...formData, profit_loss: e.target.value })}
                    required
                    placeholder="0.00"
                    className="bg-emerald-500/5 border-emerald-500/20 focus:border-emerald-500/50 h-9 text-sm font-mono"
                  />
                </div>
                <div>
                  <FieldLabel icon={Link} label="Link Telegram" />
                  <Input
                    value={formData.telegram_link}
                    onChange={(e) => setFormData({ ...formData, telegram_link: e.target.value })}
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
              className="border-white/10 hover:bg-white/5 text-sm h-9"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="procedure-form"
              disabled={isLoading}
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
