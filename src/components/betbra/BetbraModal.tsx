import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { BetbraEntry, BetbraFormData } from '@/types/betbra';
import { useCreateBetbraEntry, useUpdateBetbraEntry } from '@/hooks/useBetbraData';

interface BetbraModalProps {
  entry: BetbraEntry | null;
  onClose: () => void;
}

export function BetbraModal({ entry, onClose }: BetbraModalProps) {
  const createEntry = useCreateBetbraEntry();
  const updateEntry = useUpdateBetbraEntry();
  
  const [formData, setFormData] = useState<BetbraFormData>({
    date: '',
    registros: '',
    numero_de_apostas: '',
    ngr: '',
    turnover: '',
    cpa: '',
  });

  useEffect(() => {
    if (entry) {
      setFormData({
        date: entry.date || '',
        registros: entry.registros?.toString() || '',
        numero_de_apostas: entry.numero_de_apostas?.toString() || '',
        ngr: entry.ngr?.toString() || '',
        turnover: entry.turnover?.toString() || '',
        cpa: entry.cpa?.toString() || '',
      });
    } else {
      setFormData({
        date: '',
        registros: '',
        numero_de_apostas: '',
        ngr: '',
        turnover: '',
        cpa: '',
      });
    }
  }, [entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dataToSubmit = {
      date: formData.date,
      registros: parseFloat(formData.registros) || 0,
      numero_de_apostas: parseFloat(formData.numero_de_apostas) || 0,
      ngr: parseFloat(formData.ngr) || 0,
      turnover: parseFloat(formData.turnover) || 0,
      cpa: parseFloat(formData.cpa) || 0,
      created_by: null,
    };

    try {
      if (entry) {
        await updateEntry.mutateAsync({ id: entry.id, ...dataToSubmit });
      } else {
        await createEntry.mutateAsync(dataToSubmit);
      }
      onClose();
    } catch {
      // Error handled in hooks
    }
  };

  const isLoading = createEntry.isPending || updateEntry.isPending;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 border-b border-border">
          <CardTitle>
            {entry ? 'Editar Registro' : 'Novo Registro'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isLoading}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="registros">Registros *</Label>
                <Input
                  id="registros"
                  type="number"
                  step="1"
                  value={formData.registros}
                  onChange={(e) => setFormData({ ...formData, registros: e.target.value })}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="numero_de_apostas">Nº de Apostas *</Label>
                <Input
                  id="numero_de_apostas"
                  type="number"
                  step="1"
                  value={formData.numero_de_apostas}
                  onChange={(e) => setFormData({ ...formData, numero_de_apostas: e.target.value })}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="ngr">NGR *</Label>
                <Input
                  id="ngr"
                  type="number"
                  step="0.01"
                  value={formData.ngr}
                  onChange={(e) => setFormData({ ...formData, ngr: e.target.value })}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="turnover">Turnover *</Label>
                <Input
                  id="turnover"
                  type="number"
                  step="0.01"
                  value={formData.turnover}
                  onChange={(e) => setFormData({ ...formData, turnover: e.target.value })}
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="cpa">CPA *</Label>
                <Input
                  id="cpa"
                  type="number"
                  step="1"
                  value={formData.cpa}
                  onChange={(e) => setFormData({ ...formData, cpa: e.target.value })}
                  required
                  className="mt-2"
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
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : entry ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
