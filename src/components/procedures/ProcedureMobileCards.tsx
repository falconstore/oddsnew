import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Pencil, Trash2, ExternalLink, Tag } from 'lucide-react';
import { Procedure } from '@/types/procedures';
import { formatProcedureDate, translateCategory } from '@/lib/procedureUtils';

interface ProcedureMobileCardsProps {
  procedures: Procedure[];
  onEdit: (proc: Procedure) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (proc: Procedure) => void;
}

export function ProcedureMobileCards({ 
  procedures, 
  onEdit, 
  onDelete, 
  onToggleFavorite 
}: ProcedureMobileCardsProps) {
  const getStatusClasses = (status: string) => {
    if (status === 'Concluído' || status === 'Lucro Direto') {
      return 'bg-success/20 text-success';
    }
    if (
      status === 'Enviada partida em Aberto' ||
      status === 'Freebet Pendente' ||
      status === 'Falta Girar Freebet' ||
      status === 'Falta Girar Freeebet'
    ) {
      return 'bg-amber-500/20 text-amber-400';
    }
    return 'bg-primary/20 text-primary';
  };

  return (
    <div className="lg:hidden space-y-4">
      {procedures.map((proc) => (
        <div key={proc.id} className="bg-card rounded-xl p-4 border border-border">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-start gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleFavorite(proc)}
                className={`p-1 ${proc.is_favorite ? 'text-yellow-400' : 'text-muted-foreground'}`}
              >
                <Star className={`w-5 h-5 ${proc.is_favorite ? 'fill-yellow-400' : ''}`} />
              </Button>
              <div>
                <h3 className="text-sm font-semibold">{proc.procedure_number}</h3>
                <p className="text-xs text-muted-foreground mt-1">{proc.platform}</p>
                <Badge variant="outline" className="border-primary/30 text-primary text-xs mt-2">
                  {translateCategory(proc.category)}
                </Badge>
              </div>
            </div>
            {proc.telegram_link && (
              <a href={proc.telegram_link} target="_blank" rel="noopener noreferrer" className="text-primary">
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>
              <span>{formatProcedureDate(proc.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Promoção:</span>
              <span className="truncate ml-2">{proc.promotion_name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status:</span>
              <Badge className={`text-xs ${getStatusClasses(proc.status)}`}>
                {proc.status}
              </Badge>
            </div>
            {proc.freebet_value && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Freebet:</span>
                <span className="text-purple-400 font-semibold">R$ {proc.freebet_value.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">DP:</span>
              {proc.dp ? (
                <Badge className="bg-success/20 text-success text-xs">✓ Sim</Badge>
              ) : (
                <span className="text-muted-foreground">Não</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lucro/Prejuízo:</span>
              <span className={`font-semibold ${proc.profit_loss >= 0 ? 'text-success' : 'text-destructive'}`}>
                R$ {proc.profit_loss?.toFixed(2)}
              </span>
            </div>
            {proc.tags && proc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {proc.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(proc)}
              className="flex-1"
            >
              <Pencil className="w-4 h-4 mr-1" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(proc.id)}
              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remover
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
