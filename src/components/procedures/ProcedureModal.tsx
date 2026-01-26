import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Star } from 'lucide-react';
import { TagManager } from './TagManager';
import { Procedure, ProcedureFormData, PROCEDURE_CATEGORIES, PROCEDURE_STATUSES } from '@/types/procedures';
import { useCreateProcedure, useUpdateProcedure, useProcedures } from '@/hooks/useProcedures';
import { getAllPlatforms, getAllTags } from '@/lib/procedureUtils';

interface ProcedureModalProps {
  procedure: Procedure | null;
  onClose: () => void;
}

export function ProcedureModal({ procedure, onClose }: ProcedureModalProps) {
  const { data: allProcedures = [] } = useProcedures();
  const createProcedure = useCreateProcedure();
  const updateProcedure = useUpdateProcedure();
  
  const [formData, setFormData] = useState<ProcedureFormData>({
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
  });

  const platforms = getAllPlatforms(allProcedures);
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
      setFormData({
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
      });
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
      // Error handled in hooks
    }
  };

  const showFreebetFields = formData.category === 'Promoção' || formData.category === 'Freebet';
  const isLoading = createProcedure.isPending || updateProcedure.isPending;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 border-b border-border">
          <div className="flex items-center gap-3">
            <CardTitle>
              {procedure ? 'Editar Procedimento' : 'Novo Procedimento'}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFormData({...formData, is_favorite: !formData.is_favorite})}
              className={formData.is_favorite ? 'text-yellow-400' : 'text-muted-foreground'}
            >
              <Star className={`w-5 h-5 ${formData.is_favorite ? 'fill-yellow-400' : ''}`} />
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isLoading}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="procedure_number">Nº Procedimento *</Label>
                <Input
                  id="procedure_number"
                  value={formData.procedure_number}
                  onChange={(e) => setFormData({...formData, procedure_number: e.target.value})}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="platform">Plataforma *</Label>
                <Select 
                  value={formData.platform} 
                  onValueChange={(value) => setFormData({...formData, platform: value})}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((plat) => (
                      <SelectItem key={plat} value={plat}>
                        {plat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="promotion_name">Nome da Promoção</Label>
                <Input
                  id="promotion_name"
                  value={formData.promotion_name}
                  onChange={(e) => setFormData({...formData, promotion_name: e.target.value})}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCEDURE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCEDURE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showFreebetFields && (
                <>
                  <div>
                    <Label htmlFor="freebet_reference">Referência Freebet</Label>
                    <Input
                      id="freebet_reference"
                      value={formData.freebet_reference}
                      onChange={(e) => setFormData({...formData, freebet_reference: e.target.value})}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="freebet_value">Valor Freebet</Label>
                    <Input
                      id="freebet_value"
                      type="number"
                      step="0.01"
                      value={formData.freebet_value}
                      onChange={(e) => setFormData({...formData, freebet_value: e.target.value})}
                      className="mt-2"
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="profit_loss">Lucro/Prejuízo *</Label>
                <Input
                  id="profit_loss"
                  type="number"
                  step="0.01"
                  value={formData.profit_loss}
                  onChange={(e) => setFormData({...formData, profit_loss: e.target.value})}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="telegram_link">Link Telegram</Label>
                <Input
                  id="telegram_link"
                  value={formData.telegram_link}
                  onChange={(e) => setFormData({...formData, telegram_link: e.target.value})}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center gap-2 pt-7">
                <Switch
                  id="dp"
                  checked={formData.dp}
                  onCheckedChange={(checked) => setFormData({...formData, dp: checked})}
                />
                <Label htmlFor="dp">Duplo Green (DP)</Label>
              </div>
            </div>

            <div className="col-span-full">
              <Label>Tags</Label>
              <div className="mt-2">
                <TagManager
                  tags={formData.tags}
                  onChange={(tags) => setFormData({...formData, tags})}
                  availableTags={availableTags}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? 'Salvando...' : procedure ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
