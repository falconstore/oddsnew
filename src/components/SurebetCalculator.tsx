import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator, DollarSign, TrendingUp } from 'lucide-react';

interface SurebetCalculatorProps {
  homeOdd: number;
  drawOdd: number | null;
  awayOdd: number;
  homeBookmaker?: string;
  drawBookmaker?: string;
  awayBookmaker?: string;
  isBasketball?: boolean;
}

export function SurebetCalculator({
  homeOdd,
  drawOdd,
  awayOdd,
  homeBookmaker,
  drawBookmaker,
  awayBookmaker,
  isBasketball = false,
}: SurebetCalculatorProps) {
  const [totalStake, setTotalStake] = useState<number>(100);

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

  if (!isArbitrage) {
    return null;
  }

  return (
    <Card className="border-2 border-green-500/50 bg-green-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" />
          Calculadora Surebet {isBasketball ? '(2-way)' : '(3-way)'}
          <Badge className="bg-green-500 text-white ml-auto">
            +{profitPercentage.toFixed(2)}% garantido
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Stake Input */}
        <div className="flex items-center gap-3">
          <Label htmlFor="stake" className="text-sm text-muted-foreground whitespace-nowrap">
            Valor total:
          </Label>
          <div className="relative flex-1 max-w-[150px]">
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="stake"
              type="number"
              value={totalStake}
              onChange={(e) => setTotalStake(Number(e.target.value) || 0)}
              className="pl-7"
              min={0}
            />
          </div>
        </div>

        {/* Stakes Distribution */}
        <div className={`grid gap-3 ${isBasketball ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">{isBasketball ? 'Time 1' : 'Casa (1)'}</div>
            <div className="font-bold text-lg">R$ {homeStake.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">@ {homeOdd.toFixed(2)}</div>
            {homeBookmaker && (
              <div className="text-xs text-primary mt-1 truncate">{homeBookmaker}</div>
            )}
          </div>
          {!isBasketball && drawOdd !== null && drawOdd > 0 && (
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Empate (X)</div>
              <div className="font-bold text-lg">R$ {drawStake.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">@ {drawOdd.toFixed(2)}</div>
              {drawBookmaker && (
                <div className="text-xs text-primary mt-1 truncate">{drawBookmaker}</div>
              )}
            </div>
          )}
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">{isBasketball ? 'Time 2' : 'Fora (2)'}</div>
            <div className="font-bold text-lg">R$ {awayStake.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">@ {awayOdd.toFixed(2)}</div>
            {awayBookmaker && (
              <div className="text-xs text-primary mt-1 truncate">{awayBookmaker}</div>
            )}
          </div>
        </div>

        {/* Profit Summary */}
        <div className="flex items-center justify-between rounded-lg bg-green-500/10 p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Lucro Garantido:</span>
          </div>
          <span className="font-bold text-lg text-green-500">
            R$ {guaranteedProfit.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
