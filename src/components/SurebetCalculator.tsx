import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Calculator,
  Copy,
  DollarSign,
  Link as LinkIcon,
  Share2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SurebetCalculatorProps {
  homeOdd: number;
  drawOdd: number | null;
  awayOdd: number;
  homeBookmaker?: string;
  drawBookmaker?: string;
  awayBookmaker?: string;
  isBasketball?: boolean;
  /** Metadata da partida pra alimentar o botão Compartilhar. */
  matchId?: string;
  homeTeam?: string;
  awayTeam?: string;
  leagueName?: string;
  matchDate?: Date | string | null;
}

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatBRL(value: number) {
  return brl.format(value);
}

function formatDateShort(date: Date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export function SurebetCalculator({
  homeOdd,
  drawOdd,
  awayOdd,
  homeBookmaker,
  drawBookmaker,
  awayBookmaker,
  isBasketball = false,
  matchId,
  homeTeam,
  awayTeam,
  leagueName,
  matchDate,
}: SurebetCalculatorProps) {
  const [totalStake, setTotalStake] = useState<number>(100);
  const [shareOpen, setShareOpen] = useState(false);
  const { toast } = useToast();

  // Calculate arbitrage (2-way for basketball, 3-way for football)
  const arbitrageValue = isBasketball || drawOdd === null || drawOdd === 0
    ? 1 / homeOdd + 1 / awayOdd
    : 1 / homeOdd + 1 / drawOdd + 1 / awayOdd;
  const isArbitrage = arbitrageValue < 1;
  const profitPercentage = isArbitrage ? ((1 - arbitrageValue) * 100) : 0;

  // Calculate optimal stakes
  const homeStake = isArbitrage ? (totalStake / (homeOdd * arbitrageValue)) : 0;
  const drawStake = isArbitrage && !isBasketball && drawOdd ? (totalStake / (drawOdd * arbitrageValue)) : 0;
  const awayStake = isArbitrage ? (totalStake / (awayOdd * arbitrageValue)) : 0;

  // Calculate guaranteed profit
  const guaranteedProfit = isArbitrage ? (totalStake / arbitrageValue) - totalStake : 0;

  // Cenário Duplo Green: melhor par de retornos (PA num lado + final em outro)
  const duploGreenValue = useMemo(() => {
    if (!isArbitrage) return 0;
    const homeReturn = homeStake * homeOdd;
    const awayReturn = awayStake * awayOdd;
    if (isBasketball || drawOdd === null || drawOdd === 0) {
      // 2-way: só existe um par possível, soma dos dois lados pagos
      return homeReturn + awayReturn - totalStake;
    }
    const drawReturn = drawStake * (drawOdd ?? 0);
    const pairs = [
      homeReturn + drawReturn,
      homeReturn + awayReturn,
      drawReturn + awayReturn,
    ];
    return Math.max(...pairs) - totalStake;
  }, [
    isArbitrage,
    isBasketball,
    homeStake,
    homeOdd,
    drawStake,
    drawOdd,
    awayStake,
    awayOdd,
    totalStake,
  ]);

  if (!isArbitrage) {
    return null;
  }

  const sportIcon = isBasketball ? '🏀' : '⚽';
  // Cabeçalho: futebol sempre "DUPLO GREEN – OPORTUNIDADE" (3-way + lógica
  // de PA recuperando perdas dá pra gerar duplo green); basquete é só
  // "OPORTUNIDADE" (2-way não tem PA recuperando outro lado).
  const headerLabel = isBasketball ? 'OPORTUNIDADE' : 'DUPLO GREEN – OPORTUNIDADE';
  // Retorno signed: positivo quando é arbitragem real (lucro), negativo
  // quando é uma posição de leve perda recuperável via PA.
  // Ex.: arb=1.0491 (perde) -> -4.68% ; arb=0.9746 (ganha) -> +2.61%.
  const custoPct = (1 / arbitrageValue - 1) * 100;
  const custoPer1k = custoPct * 10; // valor em R$ por 1k stake
  const matchUrl =
    matchId && typeof window !== 'undefined'
      ? `${window.location.origin}/match/${matchId}`
      : '';

  const matchDateObj = matchDate
    ? matchDate instanceof Date
      ? matchDate
      : new Date(matchDate)
    : null;

  function buildShareText() {
    const lines: string[] = [];
    lines.push(`⭐ ${headerLabel}`);
    lines.push('');
    if (homeTeam && awayTeam) {
      lines.push(`${sportIcon} ${homeTeam} x ${awayTeam}`);
    }
    if (leagueName) {
      lines.push(`🏆 ${leagueName}`);
    }
    if (matchDateObj && !isNaN(matchDateObj.getTime())) {
      lines.push(`📅 ${formatDateShort(matchDateObj)}`);
    }
    const sign = custoPct >= 0 ? '+' : '';
    const pctBR = custoPct.toFixed(2).replace('.', ',');
    const per1kBR = formatBRL(custoPer1k);
    lines.push(`💰 Custo: ${sign}${pctBR}% (${per1kBR} a cada 1k)`);
    lines.push('');
    lines.push('📊 Odds:');
    const homeLabel = isBasketball ? 'Time 1' : 'Casa';
    const awayLabel = isBasketball ? 'Time 2' : 'Fora';
    lines.push(
      `* ${homeLabel}: ${homeOdd.toFixed(2)}${homeBookmaker ? ` (${homeBookmaker})` : ''}`,
    );
    if (!isBasketball && drawOdd !== null && drawOdd > 0) {
      lines.push(
        `* Empate: ${drawOdd.toFixed(2)}${drawBookmaker ? ` (${drawBookmaker})` : ''}`,
      );
    }
    lines.push(
      `* ${awayLabel}: ${awayOdd.toFixed(2)}${awayBookmaker ? ` (${awayBookmaker})` : ''}`,
    );
    if (matchUrl) {
      lines.push('');
      lines.push(`> ${matchUrl}`);
    }
    return lines.join('\n');
  }

  async function copyToClipboard(value: string, label: string) {
    if (!value) {
      toast({
        title: 'Nada pra copiar',
        description: 'Os dados da partida ainda não estão disponíveis.',
        variant: 'destructive',
      });
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback antigo
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast({ title: `${label} copiado` });
      setShareOpen(false);
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Tente novamente ou copie manualmente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="border-2 border-green-500/50 bg-green-500/5">
      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm sm:text-base">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span>Calculadora Surebet {isBasketball ? '(2-way)' : '(3-way)'}</span>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Badge className="bg-green-500 text-white text-xs">
              +{profitPercentage.toFixed(2)}% garantido
            </Badge>
            <Popover open={shareOpen} onOpenChange={setShareOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full bg-green-500 px-3 text-xs font-semibold text-green-950 hover:bg-green-400"
                  data-testid="button-share"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Compartilhar
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-60 p-2"
                data-testid="popover-share"
              >
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Share2 className="h-3.5 w-3.5" />
                    Compartilhar
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => copyToClipboard(buildShareText(), 'Texto')}
                  className="mb-1 h-auto w-full justify-start gap-2.5 px-2 py-2 text-sm font-normal"
                  data-testid="button-copy-text"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-500 text-white">
                    <Copy className="h-3.5 w-3.5" />
                  </span>
                  Copiar texto
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => copyToClipboard(matchUrl, 'Link')}
                  disabled={!matchUrl}
                  className="h-auto w-full justify-start gap-2.5 px-2 py-2 text-sm font-normal"
                  data-testid="button-copy-link"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-500 text-white">
                    <LinkIcon className="h-3.5 w-3.5" />
                  </span>
                  Copiar Link
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
        {/* Total Stake Input */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <Label htmlFor="stake" className="text-sm text-muted-foreground whitespace-nowrap">
            Valor total:
          </Label>
          <div className="relative w-full sm:flex-1 sm:max-w-[150px]">
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="stake"
              type="number"
              value={totalStake}
              onChange={(e) => setTotalStake(Number(e.target.value) || 0)}
              className="pl-7 h-10 sm:h-9"
              min={0}
            />
          </div>
        </div>

        {/* Stakes Distribution */}
        <div className={`grid gap-2 sm:gap-3 ${isBasketball ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <div className="rounded-lg border bg-card p-2 sm:p-3 text-center">
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">{isBasketball ? 'Time 1' : 'Casa (1)'}</div>
            <div className="font-bold text-base sm:text-lg">R$ {homeStake.toFixed(2)}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">@ {homeOdd.toFixed(2)}</div>
            {homeBookmaker && (
              <div className="text-[10px] sm:text-xs text-primary mt-1 truncate">{homeBookmaker}</div>
            )}
          </div>
          {!isBasketball && drawOdd !== null && drawOdd > 0 && (
            <div className="rounded-lg border bg-card p-2 sm:p-3 text-center">
              <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">Empate (X)</div>
              <div className="font-bold text-base sm:text-lg">R$ {drawStake.toFixed(2)}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">@ {drawOdd.toFixed(2)}</div>
              {drawBookmaker && (
                <div className="text-[10px] sm:text-xs text-primary mt-1 truncate">{drawBookmaker}</div>
              )}
            </div>
          )}
          <div className="rounded-lg border bg-card p-2 sm:p-3 text-center">
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">{isBasketball ? 'Time 2' : 'Fora (2)'}</div>
            <div className="font-bold text-base sm:text-lg">R$ {awayStake.toFixed(2)}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">@ {awayOdd.toFixed(2)}</div>
            {awayBookmaker && (
              <div className="text-[10px] sm:text-xs text-primary mt-1 truncate">{awayBookmaker}</div>
            )}
          </div>
        </div>

        {/* Profit Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg bg-green-500/10 p-2 sm:p-3 gap-1 sm:gap-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs sm:text-sm font-medium">Lucro Garantido:</span>
          </div>
          <span className="font-bold text-base sm:text-lg text-green-500">
            R$ {guaranteedProfit.toFixed(2)}
          </span>
        </div>

        {/* Cenários Duplo Green (só faz sentido no fluxo 3-way de futebol) */}
        {!isBasketball && drawOdd !== null && drawOdd > 0 && (
          <div
            className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-950/60 to-green-950/30 p-3 sm:p-4"
            data-testid="card-duplo-green"
          >
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Zap className="h-4 w-4 text-green-400" />
              Cenários Duplo Green
            </div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Se um time abrir vantagem de 2 gols (Pagamento Antecipado) e
              depois empatar OU virar:
            </p>
            <div className="text-center">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Valor Duplo Green (investimento – 1 perda)
              </div>
              <div
                className="text-xl sm:text-2xl font-bold text-green-400 tabular-nums"
                data-testid="text-duplo-green-value"
              >
                {formatBRL(duploGreenValue)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
