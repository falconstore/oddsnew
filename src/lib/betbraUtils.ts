import { BetbraEntry, BetbraStats } from '@/types/betbra';
import { startOfMonth, endOfMonth, format, parseISO, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Calculate CPA value based on tiers
export function calculateCpaValue(cpa: number): number {
  if (cpa >= 100) return cpa * 100;
  if (cpa >= 71) return cpa * 85;
  if (cpa >= 50) return cpa * 70;
  if (cpa >= 30) return cpa * 60;
  if (cpa >= 1) return cpa * 50;
  return 0;
}

// Calculate Revenue Share (NGR * 15% if NGR > 10k)
export function calculateRevenueShare(ngr: number): number {
  if (ngr > 10000) return ngr * 0.15;
  return 0;
}

// Calculate Turnover value
export function calculateTurnoverValue(turnover: number): number {
  return (turnover * 0.005) / 2;
}

// Calculate all stats for a set of entries
export function calculateBetbraStats(entries: BetbraEntry[]): BetbraStats {
  const cpaTotal = entries.reduce((sum, e) => sum + Number(e.cpa), 0);
  const totalNgr = entries.reduce((sum, e) => sum + Number(e.ngr), 0);
  const totalTurnover = entries.reduce((sum, e) => sum + Number(e.turnover), 0);

  const cpaValue = calculateCpaValue(cpaTotal);
  const revenueShare = calculateRevenueShare(totalNgr);
  const turnoverValue = calculateTurnoverValue(totalTurnover);
  const total = cpaValue + revenueShare + turnoverValue;

  return {
    cpaTotal,
    cpaValue,
    revenueShare,
    turnoverValue,
    total,
  };
}

// Filter entries by period
export function filterByPeriod(entries: BetbraEntry[], period: 'week' | 'month' | 'year', referenceDate: Date = new Date()): BetbraEntry[] {
  let start: Date;
  let end: Date;

  switch (period) {
    case 'week':
      start = startOfWeek(referenceDate, { weekStartsOn: 1 });
      end = endOfWeek(referenceDate, { weekStartsOn: 1 });
      break;
    case 'year':
      start = startOfYear(referenceDate);
      end = endOfYear(referenceDate);
      break;
    case 'month':
    default:
      start = startOfMonth(referenceDate);
      end = endOfMonth(referenceDate);
      break;
  }

  return entries.filter(entry => {
    const entryDate = parseISO(entry.date);
    return entryDate >= start && entryDate <= end;
  });
}

// Filter entries by selected month
export function filterByMonth(entries: BetbraEntry[], selectedMonth: Date): BetbraEntry[] {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  return entries.filter(entry => {
    const entryDate = parseISO(entry.date);
    return entryDate >= monthStart && entryDate <= monthEnd;
  });
}

// Get available months from entries
export function getAvailableMonths(entries: BetbraEntry[]): { value: string; label: string }[] {
  const months = new Set<string>();
  
  entries.forEach(entry => {
    const date = parseISO(entry.date);
    months.add(format(date, 'yyyy-MM'));
  });

  return Array.from(months)
    .sort((a, b) => b.localeCompare(a))
    .map(month => {
      const date = parseISO(`${month}-01`);
      return {
        value: date.toISOString(),
        label: capitalizeMonth(format(date, 'MMMM yyyy', { locale: ptBR })),
      };
    });
}

// Generate month options for selector
export function generateBetbraMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    options.push({
      value: date.toISOString(),
      label: capitalizeMonth(format(date, 'MMMM', { locale: ptBR })),
    });
  }

  return options;
}

// Capitalize month name
export function capitalizeMonth(month: string): string {
  return month.charAt(0).toUpperCase() + month.slice(1);
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Format date for display
export function formatBetbraDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'dd/MM/yyyy');
  } catch {
    return dateString;
  }
}

// Get chart data for daily turnover
export function getDailyTurnoverData(entries: BetbraEntry[], selectedMonth: Date) {
  const filtered = filterByMonth(entries, selectedMonth);
  
  return filtered
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(entry => ({
      date: format(parseISO(entry.date), 'dd/MM'),
      turnover: Number(entry.turnover),
    }));
}

// Get chart data for daily NGR
export function getDailyNgrData(entries: BetbraEntry[], selectedMonth: Date) {
  const filtered = filterByMonth(entries, selectedMonth);
  
  return filtered
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(entry => ({
      date: format(parseISO(entry.date), 'dd/MM'),
      ngr: Number(entry.ngr),
    }));
}

// Get accumulated NGR data
export function getAccumulatedNgrData(entries: BetbraEntry[], selectedMonth: Date) {
  const filtered = filterByMonth(entries, selectedMonth)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  let accumulated = 0;
  return filtered.map(entry => {
    accumulated += Number(entry.ngr);
    return {
      date: format(parseISO(entry.date), 'dd/MM'),
      ngr: accumulated,
    };
  });
}
