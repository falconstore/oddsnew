import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Gift } from 'lucide-react';

interface FreebetConfigProps {
  freebetValue: number;
  onFreebetValueChange: (value: number) => void;
  opportunitiesCount: number;
}

export function FreebetConfig({
  freebetValue,
  onFreebetValueChange,
  opportunitiesCount,
}: FreebetConfigProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <span className="font-semibold text-lg">Extração Freebet</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Label htmlFor="freebet-value" className="text-sm text-muted-foreground whitespace-nowrap">
          Valor da Freebet:
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            R$
          </span>
          <Input
            id="freebet-value"
            type="number"
            min={1}
            step={1}
            value={freebetValue}
            onChange={(e) => onFreebetValueChange(Number(e.target.value) || 10)}
            className="w-24 pl-9"
          />
        </div>
      </div>
      
      <div className="flex-1" />
      
      <Badge variant="secondary" className="text-sm px-3 py-1">
        {opportunitiesCount} oportunidade{opportunitiesCount !== 1 ? 's' : ''}
      </Badge>
    </div>
  );
}
