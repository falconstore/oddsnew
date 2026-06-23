import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DisplayProfitLoss } from '@/lib/procedureUtils';

interface Props {
  dpl: DisplayProfitLoss;
  /** valor "líquido" a usar no demonstrativo (effective ou previsto, conforme onde foi exibido) */
  liquid: number;
  /** valor "máximo" final exibido (effective ou previsto) */
  total: number;
  isPrevisto?: boolean;
  children: ReactNode;
}

const fmt = (n: number) => `R$ ${n.toFixed(2)}`;
const fmtSigned = (n: number) => `${n >= 0 ? '+' : ''}R$ ${n.toFixed(2)}`;

export function LucroMaximoTooltip({ dpl, liquid, total, isPrevisto, children }: Props) {
  if (!dpl.isGross) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[320px] p-3 bg-background border-white/10">
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-foreground border-b border-white/10 pb-1.5">
            {isPrevisto ? 'Demonstrativo do lucro previsto' : 'Demonstrativo do lucro máximo'}
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Líquido recebido</span>
            <span className={`font-mono font-medium ${liquid >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {fmtSigned(liquid)}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground">+ Déficit das FBs origem:</div>
            <div className="space-y-1 pl-2 border-l border-white/10">
              {dpl.origins.map((o) => (
                <div key={o.id} className="flex justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-foreground font-medium truncate">
                      #{o.procedure_number ?? '—'}{o.platform ? ` · ${o.platform}` : ''}
                    </span>
                    {o.promotion_name && (
                      <span className="text-muted-foreground/70 text-[10px] truncate">{o.promotion_name}</span>
                    )}
                  </div>
                  <span className="font-mono font-medium text-primary whitespace-nowrap">
                    {o.deficitAbs > 0 ? `+${fmt(o.deficitAbs)}` : fmt(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-4 pt-1.5 border-t border-white/10">
            <span className="font-semibold text-foreground">
              = Lucro {isPrevisto ? 'previsto ' : ''}máximo
            </span>
            <span className={`font-mono font-bold ${total >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {fmtSigned(total)}
            </span>
          </div>

          <div className="text-[10px] text-muted-foreground/60 pt-1">
            O líquido é o que o bot escreveu; o sistema soma os déficits das origens pra mostrar o lucro bruto da operação.
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
