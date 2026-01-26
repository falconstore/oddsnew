import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Subscriber, SubscriberFormData, PLAN_OPTIONS, SITUATION_OPTIONS } from '@/types/subscriptions';
import { format } from 'date-fns';

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriber?: Subscriber | null;
  onSubmit: (data: SubscriberFormData) => void;
  isLoading?: boolean;
}

export function SubscriptionModal({
  open,
  onOpenChange,
  subscriber,
  onSubmit,
  isLoading = false,
}: SubscriptionModalProps) {
  const [formData, setFormData] = useState<SubscriberFormData>({
    full_name: '',
    telegram_link: '',
    amount_paid: 0,
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    plan: 'Mensal',
    situation: 'Ativo',
  });

  useEffect(() => {
    if (subscriber) {
      setFormData({
        full_name: subscriber.full_name,
        telegram_link: subscriber.telegram_link || '',
        amount_paid: subscriber.amount_paid,
        payment_date: subscriber.payment_date,
        plan: subscriber.plan,
        situation: subscriber.situation,
      });
    } else {
      setFormData({
        full_name: '',
        telegram_link: '',
        amount_paid: 0,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        plan: 'Mensal',
        situation: 'Ativo',
      });
    }
  }, [subscriber, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = <K extends keyof SubscriberFormData>(
    field: K,
    value: SubscriberFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {subscriber ? 'Editar Assinante' : 'Novo Assinante'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-xs">
              Nome Completo *
            </Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
              placeholder="Nome do assinante"
              className="h-9 text-sm"
              required
            />
          </div>

          {/* Link Telegram */}
          <div className="space-y-2">
            <Label htmlFor="telegram_link" className="text-xs">
              Link Telegram
            </Label>
            <Input
              id="telegram_link"
              value={formData.telegram_link}
              onChange={(e) => updateField('telegram_link', e.target.value)}
              placeholder="https://t.me/usuario"
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Valor Pago */}
            <div className="space-y-2">
              <Label htmlFor="amount_paid" className="text-xs">
                Valor Pago *
              </Label>
              <Input
                id="amount_paid"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount_paid}
                onChange={(e) => updateField('amount_paid', parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
                required
              />
            </div>

            {/* Data Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="payment_date" className="text-xs">
                Data Pagamento *
              </Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => updateField('payment_date', e.target.value)}
                className="h-9 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Plano */}
            <div className="space-y-2">
              <Label className="text-xs">Plano *</Label>
              <Select
                value={formData.plan}
                onValueChange={(value) => updateField('plan', value)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Situação */}
            <div className="space-y-2">
              <Label className="text-xs">Situação *</Label>
              <Select
                value={formData.situation}
                onValueChange={(value) => updateField('situation', value)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUATION_OPTIONS.map((situation) => (
                    <SelectItem key={situation} value={situation}>
                      {situation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : subscriber ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
