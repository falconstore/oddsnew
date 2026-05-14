import { startOfMonth, endOfMonth, endOfDay, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Procedure } from '@/types/procedures';

export const parseDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null;

  // Se está no formato ISO (YYYY-MM-DD)
  if (dateString.includes('-') && dateString.split('-')[0].length === 4) {
    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
  }

  // Se está no formato brasileiro (DD/MM/YYYY)
  if (dateString.includes('/')) {
    try {
      const [day, month, year] = dateString.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  return null;
};

export const formatProcedureDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = parseDate(dateString);
    if (!date) return '-';
    return format(date, 'dd MMM yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
};

export const getCountableProcedures = (procedures: Procedure[]): Procedure[] => {
  if (!procedures || !Array.isArray(procedures)) return [];
  return procedures.filter(proc =>
    proc.category !== 'Extra' && proc.category !== 'Ganhar Giros Gratis'
  );
};

export const getCurrentMonthProfit = (procedures: Procedure[], selectedMonth: Date): number => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));

  return getCountableProcedures(procedures)
    .filter(proc => {
      const procDate = proc.date ? parseDate(proc.date) : null;
      return procDate && !isNaN(procDate.getTime()) && procDate >= monthStart && procDate <= monthEnd;
    })
    .reduce((sum, proc) => sum + (proc.profit_loss || 0), 0);
};

export const getAverageDailyProfit = (procedures: Procedure[], selectedMonth: Date): number => {
  const monthStart = startOfMonth(selectedMonth);
  const today = new Date();
  
  const isCurrentMonth = selectedMonth.getMonth() === today.getMonth() && 
                        selectedMonth.getFullYear() === today.getFullYear();
  const monthEnd = isCurrentMonth ? endOfDay(today) : endOfDay(endOfMonth(selectedMonth));
  
  const totalDays = differenceInDays(monthEnd, monthStart) + 1;
  const monthProfit = getCurrentMonthProfit(procedures, selectedMonth);
  return totalDays > 0 ? monthProfit / totalDays : 0;
};

export const getAverageProceduresPerDay = (procedures: Procedure[], selectedMonth: Date): number => {
  const monthStart = startOfMonth(selectedMonth);
  const today = new Date();
  
  const isCurrentMonth = selectedMonth.getMonth() === today.getMonth() && 
                        selectedMonth.getFullYear() === today.getFullYear();
  const monthEnd = isCurrentMonth ? endOfDay(today) : endOfDay(endOfMonth(selectedMonth));
  
  const totalDays = differenceInDays(monthEnd, monthStart) + 1;

  const monthProcs = getCountableProcedures(procedures).filter(proc => {
    const procDate = parseDate(proc.date);
    return procDate && !isNaN(procDate.getTime()) && procDate >= monthStart && procDate <= monthEnd;
  });
  return totalDays > 0 ? Math.round(monthProcs.length / totalDays) : 0;
};

export const getTotalProceduresForMonth = (procedures: Procedure[], selectedMonth: Date): number => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));

  return getCountableProcedures(procedures).filter(proc => {
    const procDate = parseDate(proc.date);
    return procDate && !isNaN(procDate.getTime()) && procDate >= monthStart && procDate <= monthEnd;
  }).length;
};

export const getOpenProcedures = (procedures: Procedure[], selectedMonth: Date): number => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));
  
  return (procedures || []).filter(proc => {
    if (proc.category === 'Extra' || proc.category === 'Ganhar Giros Gratis') return false;
    
    const procDate = parseDate(proc.date);
    if (!procDate || isNaN(procDate.getTime())) return false;
    if (procDate < monthStart || procDate > monthEnd) return false;
    
    const cleanStatus = (proc.status || '').trim().toLowerCase();
    return cleanStatus === 'falta girar freebet' || cleanStatus === 'falta girar freeebet';
  }).length;
};

export const getOpenMatches = (procedures: Procedure[], selectedMonth: Date): number => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));
  
  return (procedures || []).filter(proc => {
    if (proc.category === 'Extra' || proc.category === 'Ganhar Giros Gratis') return false;
    
    const procDate = parseDate(proc.date);
    if (!procDate || isNaN(procDate.getTime())) return false;
    if (procDate < monthStart || procDate > monthEnd) return false;
    
    const cleanStatus = (proc.status || '').trim().toLowerCase();
    return cleanStatus === 'enviada partida em aberto';
  }).length;
};

export const getBestPlatform = (procedures: Procedure[], selectedMonth: Date) => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));
  const monthProcs = getCountableProcedures(procedures).filter(proc => {
    const procDate = parseDate(proc.date);
    return procDate && procDate >= monthStart && procDate <= monthEnd;
  });

  const platformStats: Record<string, { profit: number; count: number }> = {};
  monthProcs.forEach(proc => {
    if (proc.platform) {
      if (!platformStats[proc.platform]) {
        platformStats[proc.platform] = { profit: 0, count: 0 };
      }
      platformStats[proc.platform].profit += proc.profit_loss || 0;
      platformStats[proc.platform].count += 1;
    }
  });

  let bestPlatform = { name: '-', profit: 0, count: 0 };
  Object.entries(platformStats).forEach(([platform, stats]) => {
    if (stats.profit > bestPlatform.profit) {
      bestPlatform = { name: platform, profit: stats.profit, count: stats.count };
    }
  });

  return bestPlatform;
};

export const getDayWithMostProfit = (procedures: Procedure[], selectedMonth: Date) => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));
  const monthProcs = getCountableProcedures(procedures).filter(proc => {
    const procDate = parseDate(proc.date);
    return procDate && procDate >= monthStart && procDate <= monthEnd;
  });

  const dailyProfits: Record<string, number> = {};
  monthProcs.forEach(proc => {
    const procDate = parseDate(proc.date);
    if (procDate) {
      const dateKey = format(procDate, 'dd/MM', { locale: ptBR });
      dailyProfits[dateKey] = (dailyProfits[dateKey] || 0) + (proc.profit_loss || 0);
    }
  });

  let bestDay = { date: '-', profit: 0 };
  Object.entries(dailyProfits).forEach(([date, profit]) => {
    if (profit > bestDay.profit) {
      bestDay = { date, profit };
    }
  });

  return bestDay;
};

export const getDayWithMostProcedures = (procedures: Procedure[], selectedMonth: Date) => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));
  const monthProcs = getCountableProcedures(procedures).filter(proc => {
    const procDate = parseDate(proc.date);
    return procDate && procDate >= monthStart && procDate <= monthEnd;
  });

  const dailyCounts: Record<string, number> = {};
  monthProcs.forEach(proc => {
    const procDate = parseDate(proc.date);
    if (procDate) {
      const dateKey = format(procDate, 'dd/MM', { locale: ptBR });
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  });

  let bestDay = { date: '-', count: 0 };
  Object.entries(dailyCounts).forEach(([date, count]) => {
    if (count > bestDay.count) {
      bestDay = { date, count };
    }
  });

  return bestDay;
};

export const getMountainChartData = (procedures: Procedure[], selectedMonth: Date) => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));

  const monthProcs = getCountableProcedures(procedures)
    .filter(proc => {
      const procDate = proc.date ? parseDate(proc.date) : null;
      return procDate && !isNaN(procDate.getTime()) && procDate >= monthStart && procDate <= monthEnd;
    })
    .sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      if (!dateA || !dateB || isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
      return dateA.getTime() - dateB.getTime();
    });

  let balance = 1000;
  const data = [{ date: 'Início', balance: 1000 }];

  monthProcs.forEach(proc => {
    const procDate = parseDate(proc.date);
    if (procDate && !isNaN(procDate.getTime())) {
      balance += proc.profit_loss || 0;
      data.push({
        date: format(procDate, 'dd/MM', { locale: ptBR }),
        balance: balance
      });
    }
  });

  return data;
};

// lucro_efetivo: usa duplo_green_lucro para DG confirmado, senão profit_loss
const getLucroEfetivo = (proc: Procedure): number => {
  if (proc.duplo_green_confirmado && proc.duplo_green_lucro != null) return Number(proc.duplo_green_lucro);
  return Number(proc.profit_loss ?? 0);
};

export const getDailyProfitData = (procedures: Procedure[], selectedMonth: Date) => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfDay(endOfMonth(selectedMonth));
  const dailyData: Record<string, { profit: number; count: number; fbCount: number; fbTotal: number; dgCount: number }> = {};

  getCountableProcedures(procedures)
    .filter(proc => {
      const procDate = proc.date ? parseDate(proc.date) : null;
      return procDate && !isNaN(procDate.getTime()) && procDate >= monthStart && procDate <= monthEnd;
    })
    .forEach(proc => {
      const procDate = parseDate(proc.date);
      if (procDate && !isNaN(procDate.getTime())) {
        const dateKey = format(procDate, 'dd/MM', { locale: ptBR });
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { profit: 0, count: 0, fbCount: 0, fbTotal: 0, dgCount: 0 };
        }
        dailyData[dateKey].profit += getLucroEfetivo(proc);
        dailyData[dateKey].count += 1;
        // Freebets ganhas no dia (resultado_freebet_ganha > 0)
        const fbGanha = proc.resultado_freebet_ganha ?? 0;
        if (fbGanha > 0) {
          dailyData[dateKey].fbCount += 1;
          dailyData[dateKey].fbTotal += fbGanha;
        }
        // Duplo Green confirmado
        if (proc.duplo_green_confirmado) {
          dailyData[dateKey].dgCount += 1;
        }
      }
    });

  return Object.entries(dailyData)
    .map(([date, data]) => ({ date, profit: data.profit, count: data.count, fbCount: data.fbCount, fbTotal: data.fbTotal, dgCount: data.dgCount }))
    .sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      const currentYear = selectedMonth.getFullYear();
      const dateA = new Date(currentYear, parseInt(monthA) - 1, parseInt(dayA));
      const dateB = new Date(currentYear, parseInt(monthB) - 1, parseInt(dayB));
      return dateA.getTime() - dateB.getTime();
    });
};

/**
 * Para QUEIMAR_FB: o "lucro máximo" exibido na coluna L/P é o valor armazenado
 * (líquido) + soma dos déficits absolutos das FBs origem vinculadas.
 *
 * Origens vêm de `freebet_reference_ids` (multi) com fallback no `freebet_reference_id` singular.
 * O déficit de cada origem é lido em ordem: resultado_lucro → profit_loss → lucro_prejuizo_previsto.
 *
 * Para outros tipos, retorna o valor armazenado tal qual (sem soma).
 *
 * @returns { effective, previsto, deficitSum, isGross }
 *   - effective: valor a exibir quando profit_loss está preenchido (gross para QUEIMAR_FB)
 *   - previsto:  valor a exibir como "previsto" (~) quando profit_loss=0 (gross para QUEIMAR_FB)
 *   - deficitSum: soma absoluta dos déficits das origens (0 se não-QUEIMAR_FB ou sem origens)
 *   - isGross:   true se aplicamos a soma (QUEIMAR_FB com pelo menos uma origem encontrada)
 */
export interface DisplayProfitLossOriginItem {
  id: string;
  procedure_number: string | null;
  promotion_name: string | null;
  platform: string | null;
  partida_descricao: string | null;
  deficit: number;        // valor negativo original (ex: -37.92)
  deficitAbs: number;     // valor positivo somado (ex: 37.92)
  source: 'resultado_lucro' | 'profit_loss' | 'lucro_prejuizo_previsto' | 'none';
}

export interface DisplayProfitLoss {
  effective: number;
  previsto: number;
  liquidEffective: number;   // valor líquido armazenado em profit_loss
  liquidPrevisto: number;    // valor líquido armazenado em lucro_prejuizo_previsto
  deficitSum: number;
  isGross: boolean;
  origins: DisplayProfitLossOriginItem[]; // origens encontradas (com déficit ou não)
}

export const getDisplayProfitLoss = (
  proc: Procedure,
  byId?: Map<string, Procedure>
): DisplayProfitLoss => {
  const storedEffective = Number(proc.profit_loss ?? 0);
  const storedPrevisto = Number(proc.lucro_prejuizo_previsto ?? 0);
  const empty: DisplayProfitLoss = {
    effective: storedEffective,
    previsto: storedPrevisto,
    liquidEffective: storedEffective,
    liquidPrevisto: storedPrevisto,
    deficitSum: 0,
    isGross: false,
    origins: [],
  };

  if (proc.tipo !== 'QUEIMAR_FB' || !byId) return empty;

  const ids = new Set<string>();
  if (Array.isArray(proc.freebet_reference_ids)) {
    for (const id of proc.freebet_reference_ids) if (id) ids.add(id);
  }
  if (proc.freebet_reference_id) ids.add(proc.freebet_reference_id);

  if (ids.size === 0) return empty;

  let deficitSum = 0;
  const origins: DisplayProfitLossOriginItem[] = [];
  for (const id of ids) {
    const origin = byId.get(id);
    if (!origin) continue;
    let deficit = 0;
    let source: DisplayProfitLossOriginItem['source'] = 'none';
    if (origin.resultado_lucro != null) {
      deficit = Number(origin.resultado_lucro);
      source = 'resultado_lucro';
    } else if (origin.profit_loss != null && Number(origin.profit_loss) !== 0) {
      deficit = Number(origin.profit_loss);
      source = 'profit_loss';
    } else if (origin.lucro_prejuizo_previsto != null) {
      deficit = Number(origin.lucro_prejuizo_previsto);
      source = 'lucro_prejuizo_previsto';
    }
    const deficitAbs = deficit < 0 ? Math.abs(deficit) : 0;
    origins.push({
      id: origin.id,
      procedure_number: origin.procedure_number,
      promotion_name: origin.promotion_name,
      platform: origin.platform,
      partida_descricao: origin.partida_descricao,
      deficit,
      deficitAbs,
      source,
    });
    deficitSum += deficitAbs;
  }

  if (origins.length === 0 || deficitSum === 0) {
    return { ...empty, origins };
  }

  return {
    effective: storedEffective + deficitSum,
    previsto: storedPrevisto + deficitSum,
    liquidEffective: storedEffective,
    liquidPrevisto: storedPrevisto,
    deficitSum,
    isGross: true,
    origins,
  };
};

export const translateCategory = (category: string): string => {
  const translations: Record<string, string> = {
    'Promotion': 'Promoção',
    'Cashback': 'Cashback',
    'Freebet': 'Freebet',
    'Superodd': 'Superodd',
    'Extra': 'Extra',
    'Ganhar Giros Gratis': 'Ganhar Giros Gratis'
  };
  return translations[category] || category;
};

export const getAllPlatforms = (procedures: Procedure[]): string[] => {
  if (!procedures || !Array.isArray(procedures)) return [];
  const platforms = [...new Set(procedures.map(proc => proc.platform).filter(Boolean))];
  return platforms.sort();
};

export const getAllStatuses = (procedures: Procedure[]): string[] => {
  if (!procedures || !Array.isArray(procedures)) return [];
  const statuses = [...new Set(procedures.map(proc => proc.status).filter(Boolean))];
  return statuses.sort();
};

export const getAllTags = (procedures: Procedure[]): string[] => {
  if (!procedures || !Array.isArray(procedures)) return [];
  const tags = [...new Set(procedures.flatMap(proc => proc.tags || []).filter(Boolean))];
  return tags.sort();
};

export const generateMonthOptions = () => {
  const options = [];
  const currentDate = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    options.push({
      value: date.toISOString(),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    });
  }
  return options;
};

export const capitalizeMonth = (monthStr: string): string => {
  return monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
};

export interface DailyStats {
  totalOperacoes: number;
  totalFreebets: number;
  totalFreebetsValor: number;
  totalSemFb: number;
  lucroBruto: number;
  operacoesEncerradas: number;
  operacoesAbertas: number;
  date: string; // YYYY-MM-DD
}

export const getDailyStats = (procedures: Procedure[], date?: Date): DailyStats => {
  const ref = date ?? new Date();
  const today = format(ref, 'yyyy-MM-dd');

  const todayProcs = getCountableProcedures(procedures).filter(p => {
    const d = p.date ? parseDate(p.date) : null;
    return d && format(d, 'yyyy-MM-dd') === today;
  });

  const fbProcs = todayProcs.filter(p => p.tipo === 'GANHAR_FB' || p.tipo === 'QUEIMAR_FB');
  const totalFreebets = fbProcs.length;
  const totalFreebetsValor = fbProcs.reduce((s, p) => s + (Number(p.freebet_value) || 0), 0);
  const totalSemFb = todayProcs.filter(p => p.tipo === 'SEM_FB').length;
  const lucroBruto = todayProcs.reduce((s, p) => s + (p.profit_loss || 0), 0);
  const operacoesEncerradas = todayProcs.filter(p => p.profit_loss !== 0).length;

  return {
    totalOperacoes: todayProcs.length,
    totalFreebets,
    totalFreebetsValor,
    totalSemFb,
    lucroBruto,
    operacoesEncerradas,
    operacoesAbertas: todayProcs.length - operacoesEncerradas,
    date: today,
  };
};
