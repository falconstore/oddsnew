import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Send, Settings2, History, TrendingUp, DollarSign, Clock, Percent, Activity } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  useTelegramBotConfig,
  useUpdateTelegramConfig,
  useTelegramDGEnviados,
  useTelegramBotStats,
} from "@/hooks/useTelegramBot";
import { useAuth } from "@/contexts/AuthContext";
import { PAGE_KEYS } from "@/types/auth";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  const effectiveConfig =
    localConfig ||
    (config
      ? {
          roi_minimo: String(config.roi_minimo),
          stake_base: String(config.stake_base),
          horario_inicio: config.horario_inicio?.slice(0, 5) || "06:00",
          horario_fim: config.horario_fim?.slice(0, 5) || "23:00",
        }
      : null);

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

  const statCards = [
    {
      title: "Enviados Hoje",
      icon: Send,
      value: stats?.enviadosHoje || 0,
      color: "stat-green",
      iconColor: "text-primary",
    },
    {
      title: "Total Enviados",
      icon: History,
      value: stats?.totalEnviados || 0,
      color: "stat-green",
      iconColor: "text-muted-foreground",
    },
    {
      title: "ROI Médio",
      icon: Percent,
      value: stats?.roiMedio ? `${stats.roiMedio >= 0 ? "+" : ""}${stats.roiMedio.toFixed(2)}%` : "0%",
      color: "stat-amber",
      iconColor: "text-warning",
    },
    {
      title: "Lucro Potencial",
      icon: DollarSign,
      value: `R$ ${(stats?.lucroTotalPotencial || 0).toFixed(2)}`,
      color: (stats?.lucroTotalPotencial || 0) >= 0 ? "stat-green" : "stat-green",
      iconColor: (stats?.lucroTotalPotencial || 0) >= 0 ? "text-primary" : "text-destructive",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          eyebrow="BOT"
          title="Bot Telegram"
          subtitle="Alertas automáticos de Duplo Green"
          icon={Bot}
          actions={config && canEdit ? (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/40 dark:bg-white/[0.03] border border-border/50">
              <div className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'}`} />
              <span className="text-sm font-medium">{config.enabled ? "Ativo" : "Desativado"}</span>
              <Switch
                checked={config.enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={updateConfig.isPending}
              />
            </div>
          ) : undefined}
        />

        {/* Stats Cards */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {statCards.map((stat, i) => (
            <Card
              key={stat.title}
              className={`border animate-fade-in-up card-hover ${stat.color}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className="w-8 h-8 rounded-lg bg-background/50 dark:bg-white/[0.05] flex items-center justify-center">
                  <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold font-mono">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Config Card */}
          <Card className="md:col-span-1 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Configurações
              </CardTitle>
              <CardDescription>Ajuste os parâmetros de detecção</CardDescription>
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
                    <Label htmlFor="roi_minimo" className="text-xs font-medium">ROI Mínimo (%)</Label>
                    <Input
                      id="roi_minimo"
                      type="number"
                      step="0.5"
                      value={effectiveConfig.roi_minimo}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...effectiveConfig,
                          ...prev,
                          roi_minimo: e.target.value,
                        }))
                      }
                      disabled={!canEdit}
                      placeholder="-5.0"
                      className="bg-muted/30 dark:bg-white/[0.03]"
                    />
                    <p className="text-xs text-muted-foreground">Valores negativos indicam risco no empate</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stake_base" className="text-xs font-medium">Stake Base (R$)</Label>
                    <Input
                      id="stake_base"
                      type="number"
                      step="100"
                      value={effectiveConfig.stake_base}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...effectiveConfig,
                          ...prev,
                          stake_base: e.target.value,
                        }))
                      }
                      disabled={!canEdit}
                      placeholder="1000"
                      className="bg-muted/30 dark:bg-white/[0.03]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="horario_inicio" className="text-xs font-medium">Início</Label>
                      <Input
                        id="horario_inicio"
                        type="time"
                        value={effectiveConfig.horario_inicio}
                        onChange={(e) =>
                          setLocalConfig((prev) => ({
                            ...effectiveConfig,
                            ...prev,
                            horario_inicio: e.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        className="bg-muted/30 dark:bg-white/[0.03]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="horario_fim" className="text-xs font-medium">Fim</Label>
                      <Input
                        id="horario_fim"
                        type="time"
                        value={effectiveConfig.horario_fim}
                        onChange={(e) =>
                          setLocalConfig((prev) => ({
                            ...effectiveConfig,
                            ...prev,
                            horario_fim: e.target.value,
                          }))
                        }
                        disabled={!canEdit}
                        className="bg-muted/30 dark:bg-white/[0.03]"
                      />
                    </div>
                  </div>

                  {canEdit && (
                    <Button
                      onClick={handleSaveConfig}
                      disabled={updateConfig.isPending}
                      className="w-full"
                    >
                      {updateConfig.isPending ? "Salvando..." : "Salvar Configurações"}
                    </Button>
                  )}

                  <div className="pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Atualizado: {config?.updated_at ? formatDateTime(config.updated_at) : "-"}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Configuração não encontrada</p>
              )}
            </CardContent>
          </Card>

          {/* History Card */}
          <Card className="md:col-span-2 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Histórico de Envios
              </CardTitle>
              <CardDescription>Últimas oportunidades enviadas ao Telegram</CardDescription>
            </CardHeader>
            <CardContent>
              {enviadosLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : enviados && enviados.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {enviados.map((dg) => {
                    const investimento = (dg.stake_casa || 0) + (dg.stake_empate || 0) + (dg.stake_fora || 0);
                    const lucro = (dg.retorno_green || 0) - investimento;
                    const isPositive = lucro >= 0;
                    return (
                      <div
                        key={dg.id}
                        className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                          isPositive
                            ? 'border-primary/20 bg-primary/5 dark:bg-primary/[0.03]'
                            : 'border-destructive/20 bg-destructive/5 dark:bg-destructive/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-sm truncate">{dg.team1}</span>
                            <span className="text-muted-foreground text-xs font-medium">vs</span>
                            <span className="font-semibold text-sm truncate">{dg.team2}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-[10px] border-border/50">
                              {dg.competition}
                            </Badge>
                            <Badge
                              className={`text-[10px] ${
                                dg.roi >= 0
                                  ? 'bg-primary/20 text-primary border-primary/30'
                                  : 'bg-destructive/20 text-destructive border-destructive/30'
                              }`}
                              variant="outline"
                            >
                              ROI {dg.roi >= 0 ? "+" : ""}{dg.roi.toFixed(2)}%
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-primary/10 dark:bg-primary/[0.08] rounded-lg p-2">
                            <div className="text-muted-foreground text-[10px]">Casa (PA)</div>
                            <div className="font-mono font-bold text-primary">{dg.casa_odd?.toFixed(2) || "-"}</div>
                            <div className="text-muted-foreground text-[10px] truncate">{dg.casa_bookmaker || "-"}</div>
                            <div className="text-muted-foreground text-[10px]">R$ {(dg.stake_casa || 0).toFixed(2)}</div>
                          </div>
                          <div className="bg-warning/10 rounded-lg p-2">
                            <div className="text-muted-foreground text-[10px]">Empate (SO)</div>
                            <div className="font-mono font-bold text-warning">{dg.empate_odd?.toFixed(2) || "-"}</div>
                            <div className="text-muted-foreground text-[10px] truncate">{dg.empate_bookmaker || "-"}</div>
                            <div className="text-muted-foreground text-[10px]">R$ {(dg.stake_empate || 0).toFixed(2)}</div>
                          </div>
                          <div className="bg-primary/10 dark:bg-primary/[0.08] rounded-lg p-2">
                            <div className="text-muted-foreground text-[10px]">Fora (PA)</div>
                            <div className="font-mono font-bold text-primary">{dg.fora_odd?.toFixed(2) || "-"}</div>
                            <div className="text-muted-foreground text-[10px] truncate">{dg.fora_bookmaker || "-"}</div>
                            <div className="text-muted-foreground text-[10px]">R$ {(dg.stake_fora || 0).toFixed(2)}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30 gap-2">
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-muted-foreground">
                              Investido: <span className="font-semibold text-foreground">R$ {investimento.toFixed(2)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Retorno: <span className="font-bold text-primary">R$ {(dg.retorno_green || 0).toFixed(2)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Lucro: <span className={`font-bold ${isPositive ? "text-primary" : "text-destructive"}`}>
                                R$ {lucro.toFixed(2)}
                              </span>
                            </span>
                          </div>
                          <span className="text-muted-foreground shrink-0 text-[10px]">{formatDateTime(dg.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                    <Send className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="font-medium text-muted-foreground">Nenhum DG enviado ainda</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Ative o bot para começar a receber alertas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
