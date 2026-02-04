import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Send, Settings2, History, TrendingUp, DollarSign, Clock, Percent } from 'lucide-react';
import { useTelegramBotConfig, useUpdateTelegramConfig, useTelegramDGEnviados, useTelegramBotStats } from '@/hooks/useTelegramBot';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TelegramBot() {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.TELEGRAM_BOT);
  
  const { data: config, isLoading: configLoading } = useTelegramBotConfig();
  const { data: enviados, isLoading: enviadosLoading } = useTelegramDGEnviados(50);
  const { data: stats, isLoading: statsLoading } = useTelegramBotStats();
  const updateConfig = useUpdateTelegramConfig();
  
  const [localConfig, setLocalConfig] = useState<{
    roi_minimo: string;
    stake_base: string;
    horario_inicio: string;
    horario_fim: string;
  } | null>(null);
  
  // Sync local state with fetched config
  const effectiveConfig = localConfig || (config ? {
    roi_minimo: String(config.roi_minimo),
    stake_base: String(config.stake_base),
    horario_inicio: config.horario_inicio?.slice(0, 5) || '06:00',
    horario_fim: config.horario_fim?.slice(0, 5) || '23:00',
  } : null);
  
  const handleToggleEnabled = () => {
    if (!config) return;
    updateConfig.mutate({ enabled: !config.enabled });
  };
  
  const handleSaveConfig = () => {
    if (!effectiveConfig) return;
    updateConfig.mutate({
      roi_minimo: parseFloat(effectiveConfig.roi_minimo),
      stake_base: parseFloat(effectiveConfig.stake_base),
      horario_inicio: effectiveConfig.horario_inicio,
      horario_fim: effectiveConfig.horario_fim,
    });
  };
  
  const formatDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              Bot Telegram - Duplo Green
            </h1>
            <p className="text-muted-foreground">
              Alertas automáticos de oportunidades de Duplo Green
            </p>
          </div>
          
          {config && canEdit && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {config.enabled ? 'Ativo' : 'Desativado'}
              </span>
              <Switch
                checked={config.enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={updateConfig.isPending}
              />
            </div>
          )}
        </div>
        
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Enviados Hoje</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.enviadosHoje || 0}</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Enviados</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalEnviados || 0}</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ROI Médio</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats?.roiMedio ? `${stats.roiMedio >= 0 ? '+' : ''}${stats.roiMedio.toFixed(2)}%` : '0%'}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Lucro Potencial</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl font-bold ${(stats?.lucroTotalPotencial || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  R$ {(stats?.lucroTotalPotencial || 0).toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          {/* Configuration Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configurações
              </CardTitle>
              <CardDescription>
                Ajuste os parâmetros de detecção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : effectiveConfig ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="roi_minimo">ROI Mínimo (%)</Label>
                    <Input
                      id="roi_minimo"
                      type="number"
                      step="0.5"
                      value={effectiveConfig.roi_minimo}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...effectiveConfig,
                        ...prev,
                        roi_minimo: e.target.value
                      }))}
                      disabled={!canEdit}
                      placeholder="-5.0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Valores negativos indicam risco no empate
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="stake_base">Stake Base (R$)</Label>
                    <Input
                      id="stake_base"
                      type="number"
                      step="100"
                      value={effectiveConfig.stake_base}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...effectiveConfig,
                        ...prev,
                        stake_base: e.target.value
                      }))}
                      disabled={!canEdit}
                      placeholder="1000"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="horario_inicio">Início</Label>
                      <Input
                        id="horario_inicio"
                        type="time"
                        value={effectiveConfig.horario_inicio}
                        onChange={(e) => setLocalConfig(prev => ({
                          ...effectiveConfig,
                          ...prev,
                          horario_inicio: e.target.value
                        }))}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="horario_fim">Fim</Label>
                      <Input
                        id="horario_fim"
                        type="time"
                        value={effectiveConfig.horario_fim}
                        onChange={(e) => setLocalConfig(prev => ({
                          ...effectiveConfig,
                          ...prev,
                          horario_fim: e.target.value
                        }))}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                  
                  {canEdit && (
                    <Button 
                      onClick={handleSaveConfig}
                      disabled={updateConfig.isPending}
                      className="w-full"
                    >
                      {updateConfig.isPending ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
                  )}
                  
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        Atualizado: {config?.updated_at ? formatDateTime(config.updated_at) : '-'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Configuração não encontrada</p>
              )}
            </CardContent>
          </Card>
          
          {/* History Table */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Histórico de Envios
              </CardTitle>
              <CardDescription>
                Últimas oportunidades enviadas ao Telegram
              </CardDescription>
            </CardHeader>
            <CardContent>
              {enviadosLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : enviados && enviados.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partida</TableHead>
                        <TableHead>Liga</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                        <TableHead className="text-right">Retorno</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enviados.map((dg) => (
                        <TableRow key={dg.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{dg.team1}</span>
                              <span className="text-muted-foreground">vs {dg.team2}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{dg.competition}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={dg.roi >= 0 ? 'default' : 'secondary'}>
                              {dg.roi >= 0 ? '+' : ''}{dg.roi.toFixed(2)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-500">
                            R$ {dg.retorno_green.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(dg.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Send className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum DG enviado ainda</p>
                  <p className="text-sm">Ative o bot para começar a receber alertas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
