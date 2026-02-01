import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, Copy, Check, TrendingUp, Clock, Trophy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/freebetUtils';
import type { FreebetOpportunity } from '@/types/freebet';

interface FreebetCardProps {
  opportunity: FreebetOpportunity;
}

function OddRow({
  label,
  bookmaker,
  odd,
  stake,
  link,
  variant,
  isFreebet = false,
}: {
  label: string;
  bookmaker: string;
  odd: number;
  stake: number;
  link: string | null;
  variant: 'pa' | 'so';
  isFreebet?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    if (link) {
      navigator.clipboard.writeText(link);
      toast.success('Link copiado!');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  
  return (
    <div className={cn(
      "flex items-center justify-between gap-2 p-2 rounded-lg",
      variant === 'so' ? "bg-amber-500/10" : "bg-emerald-500/10"
    )}>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[9px] px-1 py-0",
              variant === 'so' ? "border-amber-500 text-amber-500" : "border-emerald-500 text-emerald-500"
            )}
          >
            {variant === 'so' ? 'SO' : 'PA'}
          </Badge>
          {isFreebet && (
            <Badge className="text-[9px] px-1 py-0 bg-primary/80">
              FREEBET
            </Badge>
          )}
        </div>
        <span className="text-sm font-medium truncate">{bookmaker}</span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className={cn(
            "font-mono font-bold",
            variant === 'so' ? "text-amber-500" : "text-emerald-500"
          )}>
            {odd.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatBRL(stake)}
          </div>
        </div>
        
        {link && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => window.open(link, '_blank')}
              title="Abrir site"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", copied && "bg-success/20")}
              onClick={handleCopy}
              title="Copiar link"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FreebetCard({ opportunity }: FreebetCardProps) {
  const { match, roi, totalToInvest, guaranteedProfit } = opportunity;
  
  const matchDate = new Date(match.match_date);
  const formattedDate = format(matchDate, "HH:mm - dd/MM", { locale: ptBR });
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2 space-y-2">
        {/* League and Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Trophy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {match.league_name}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3.5 w-3.5" />
            {formattedDate}
          </div>
        </div>
        
        {/* Teams */}
        <div className="flex items-center gap-2">
          {match.home_team_logo && (
            <img 
              src={match.home_team_logo} 
              alt="" 
              className="h-6 w-6 object-contain"
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
          )}
          <span className="font-semibold text-sm truncate">{match.home_team}</span>
          <span className="text-muted-foreground text-sm">vs</span>
          <span className="font-semibold text-sm truncate">{match.away_team}</span>
          {match.away_team_logo && (
            <img 
              src={match.away_team_logo} 
              alt="" 
              className="h-6 w-6 object-contain"
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
          )}
        </div>
        
        {/* ROI Badge */}
        <div className="flex items-center gap-2">
          <Badge 
            className={cn(
              "text-sm font-bold px-2 py-0.5",
              roi >= 100 ? "bg-purple-600" : roi >= 50 ? "bg-emerald-600" : "bg-blue-600"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5 mr-1" />
            {roi.toFixed(1)}% ROI
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-2">
        {/* Summary */}
        <div className="flex justify-between text-sm border-b pb-2">
          <div>
            <span className="text-muted-foreground">Total investido:</span>
            <span className="ml-1 font-semibold">{formatBRL(totalToInvest)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Lucro:</span>
            <span className="ml-1 font-bold text-success">{formatBRL(guaranteedProfit)}</span>
          </div>
        </div>
        
        {/* Odds Rows */}
        <div className="space-y-2">
          <OddRow
            label="Casa (1)"
            bookmaker={opportunity.homeBookmaker}
            odd={opportunity.homeOdd}
            stake={opportunity.homeStake}
            link={opportunity.homeLink}
            variant="pa"
          />
          
          <OddRow
            label="Empate (X)"
            bookmaker={opportunity.drawBookmaker}
            odd={opportunity.drawOdd}
            stake={opportunity.drawStake}
            link={opportunity.drawLink}
            variant="so"
            isFreebet
          />
          
          <OddRow
            label="Fora (2)"
            bookmaker={opportunity.awayBookmaker}
            odd={opportunity.awayOdd}
            stake={opportunity.awayStake}
            link={opportunity.awayLink}
            variant="pa"
          />
        </div>
      </CardContent>
    </Card>
  );
}
