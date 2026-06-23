import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { Search, Users, AlertTriangle } from 'lucide-react';
import { supabaseProcedures, isProceduresSupabaseConfigured } from '@/lib/supabaseProcedures';
import { UserDetailModal } from './UserDetailModal';
import { cn } from '@/lib/utils';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ALL = 'todos';

interface UserRow {
  email: string;
  nome: string | null;
  compras: number;
  renovacoes: number;
  novas: number;
  valor_total: number;
  ultimo_produto: string | null;
  modalidade: string | null;
  primeira_compra: string | null;
  ultima_compra: string | null;
  expira_em: string | null;
  tem_pendente?: boolean;
}

type SortKey = 'valor_total' | 'renovacoes' | 'compras' | 'expira_em';
type Situacao = 'todos' | 'ativo' | 'expirado' | 'pendente';

// Situação pela data de expiração (+ pendente). Considera o produto filtrado
// quando a fonte é a view por produto.
function situacaoDe(u: UserRow): Exclude<Situacao, 'todos'> {
  if (u.tem_pendente) return 'pendente';
  if (u.expira_em && new Date(u.expira_em).getTime() >= Date.now()) return 'ativo';
  return 'expirado';
}

// produto = 'todos' → view geral por usuário; senão → view por usuário×produto filtrada.
function useUsers(produto: string) {
  return useQuery({
    queryKey: ['lastlink_users', produto],
    queryFn: async (): Promise<UserRow[]> => {
      if (!isProceduresSupabaseConfigured()) return [];
      const all: UserRow[] = [];
      let from = 0; const PAGE = 1000;
      for (;;) {
        let query = produto === ALL
          ? supabaseProcedures.from('lastlink_by_user').select('*')
          : supabaseProcedures.from('lastlink_by_user_product').select('*').eq('produto', produto);
        query = query.order('valor_total', { ascending: false }).range(from, from + PAGE - 1);
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        // normaliza: a view por produto não tem 'ultimo_produto', usa 'produto'
        all.push(...data.map((d: any) => ({ ...d, ultimo_produto: d.ultimo_produto ?? d.produto ?? null })) as UserRow[]);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
    staleTime: 30000,
  });
}

// Lista de produtos pro seletor (vem da view por produto, independente do filtro)
function useProdutos() {
  return useQuery({
    queryKey: ['lastlink_produtos_lista'],
    queryFn: async (): Promise<string[]> => {
      if (!isProceduresSupabaseConfigured()) return [];
      const { data, error } = await supabaseProcedures.from('lastlink_by_product').select('produto');
      if (error) throw error;
      return (data ?? []).map((r: any) => r.produto);
    },
    staleTime: 60000,
  });
}

export function UserRenewalsReport() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('valor_total');
  const [produto, setProduto] = useState<string>(ALL);
  const [situacao, setSituacao] = useState<Situacao>('todos');
  const [soUsedRenov, setSoRenov] = useState(false);
  const [openUser, setOpenUser] = useState<{ email: string; nome: string | null } | null>(null);

  const { data: users = [], isLoading } = useUsers(produto);
  const { data: produtos = [] } = useProdutos();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let rows = users;
    if (term) rows = rows.filter((u) => u.email?.toLowerCase().includes(term) || u.nome?.toLowerCase().includes(term));
    if (situacao !== 'todos') rows = rows.filter((u) => situacaoDe(u) === situacao);
    if (soUsedRenov) rows = rows.filter((u) => u.renovacoes > 0);
    return [...rows].sort((a, b) => {
      if (sort === 'expira_em') {
        const ta = a.expira_em ? new Date(a.expira_em).getTime() : Infinity;
        const tb = b.expira_em ? new Date(b.expira_em).getTime() : Infinity;
        return ta - tb;
      }
      return (b[sort] as number) - (a[sort] as number);
    });
  }, [users, q, situacao, soUsedRenov, sort]);

  // Contadores por situação (sobre o conjunto do produto atual, ignorando busca)
  const counts = useMemo(() => {
    const c = { ativo: 0, expirado: 0, pendente: 0 };
    for (const u of users) c[situacaoDe(u)]++;
    return c;
  }, [users]);

  const shown = filtered.slice(0, 200);

  return (
    <div className="panel-bracket p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="telemetry-label text-primary flex items-center gap-1.5">
          <Users className="w-3 h-3" /> [ RENOVAÇÕES POR USUÁRIO ]
        </p>
        <p className="telemetry-label text-muted-foreground/50">
          {isLoading ? 'CARREGANDO…' : `${filtered.length} USUÁRIOS`}
        </p>
      </div>

      {/* Filtros linha 1: busca + produto + ordenação */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar email ou nome…"
            className="w-full h-9 pl-8 pr-3 text-sm bg-background border border-border focus:border-primary outline-none" />
        </div>
        <select value={produto} onChange={(e) => { setProduto(e.target.value); }}
          className="h-9 px-2 text-sm bg-background border border-border outline-none w-full sm:w-auto">
          <option value={ALL}>Todos os produtos</option>
          {produtos.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 px-2 text-sm bg-background border border-border outline-none w-full sm:w-auto">
          <option value="valor_total">Ordenar: maior valor</option>
          <option value="renovacoes">Ordenar: mais renovações</option>
          <option value="compras">Ordenar: mais compras</option>
          <option value="expira_em">Ordenar: expira primeiro</option>
        </select>
      </div>

      {/* Filtros linha 2: situação (chips clicáveis) */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="telemetry-label text-muted-foreground/60 mr-1">SITUAÇÃO:</span>
        <SitChip label="Todos" active={situacao === 'todos'} onClick={() => setSituacao('todos')} />
        <SitChip label={`Ativos (${counts.ativo})`} tone="ok" active={situacao === 'ativo'} onClick={() => setSituacao('ativo')} />
        <SitChip label={`Expirados (${counts.expirado})`} tone="bad" active={situacao === 'expirado'} onClick={() => setSituacao('expirado')} />
        <SitChip label={`Pendentes (${counts.pendente})`} tone="warn" active={situacao === 'pendente'} onClick={() => setSituacao('pendente')} />
        <button onClick={() => setSoRenov((v) => !v)}
          className={cn('h-7 px-3 text-xs border transition-colors ml-auto',
            soUsedRenov ? 'bg-primary/15 text-primary border-primary/40' : 'bg-card text-muted-foreground border-border hover:border-primary/30')}>
          só com renovação
        </button>
      </div>

      {produto === ALL && situacao !== 'todos' && (
        <p className="text-[10px] text-muted-foreground/50 mb-2">
          Situação calculada pela assinatura geral mais recente. Selecione um produto pra ver a situação por produto.
        </p>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-border text-left">
              {['Usuário', 'Produto / Modalidade', 'Situação', 'Compras', 'Renov.', 'Valor total', 'Cliente há', 'Expira'].map((h, i) => (
                <th key={h} className={cn('telemetry-label text-muted-foreground py-2 px-2', (i === 3 || i === 4 || i === 5) && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const ltvDias = u.primeira_compra ? differenceInDays(new Date(), new Date(u.primeira_compra)) : null;
              const expira = u.expira_em ? new Date(u.expira_em) : null;
              const sit = situacaoDe(u);
              return (
                <tr key={u.email} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-2 max-w-[220px]">
                    <button type="button" onClick={() => setOpenUser({ email: u.email, nome: u.nome })} className="text-left group" title="Ver histórico completo">
                      <p className="text-foreground truncate group-hover:text-primary transition-colors underline-offset-2 group-hover:underline">{u.nome || u.email}</p>
                      {u.nome && <p className="text-[10px] text-muted-foreground/60 truncate">{u.email}</p>}
                    </button>
                  </td>
                  <td className="py-2 px-2">
                    <p className="text-foreground/90 truncate max-w-[200px]">{u.ultimo_produto || '—'}</p>
                    <p className="telemetry-label text-muted-foreground/50">{(u.modalidade || '').replace('Assinatura ', '') || '—'}</p>
                  </td>
                  <td className="py-2 px-2">
                    <SitBadge sit={sit} />
                  </td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums">{u.compras}</td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-primary">{u.renovacoes}</td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-primary">{money(Number(u.valor_total))}</td>
                  <td className="py-2 px-2 font-mono text-muted-foreground tabular-nums">{ltvDias != null ? `${ltvDias}d` : '—'}</td>
                  <td className="py-2 px-2 font-mono tabular-nums">
                    {expira ? <span className={cn(sit === 'expirado' ? 'text-destructive' : 'text-muted-foreground/80')}>{format(expira, 'dd/MM/yy')}</span> : '—'}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && !isLoading && (
              <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > shown.length && (
        <p className="telemetry-label text-muted-foreground/50 text-center mt-3">
          MOSTRANDO {shown.length} DE {filtered.length} — REFINE A BUSCA PRA VER MAIS
        </p>
      )}

      <UserDetailModal email={openUser?.email ?? null} nome={openUser?.nome ?? null} onClose={() => setOpenUser(null)} />
    </div>
  );
}

function SitChip({ label, active, onClick, tone }: { label: string; active: boolean; onClick: () => void; tone?: 'ok' | 'bad' | 'warn' }) {
  const toneActive = tone === 'ok' ? 'bg-primary/15 text-primary border-primary/40'
    : tone === 'bad' ? 'bg-destructive/15 text-destructive border-destructive/40'
    : tone === 'warn' ? 'bg-warning/15 text-warning border-warning/40'
    : 'bg-primary/15 text-primary border-primary/40';
  return (
    <button onClick={onClick}
      className={cn('h-7 px-3 text-xs border transition-colors',
        active ? toneActive : 'bg-card text-muted-foreground border-border hover:border-primary/30')}>
      {label}
    </button>
  );
}

function SitBadge({ sit }: { sit: 'ativo' | 'expirado' | 'pendente' }) {
  const map = {
    ativo: { txt: '● Ativo', cls: 'text-primary border-primary/40' },
    expirado: { txt: '○ Expirado', cls: 'text-muted-foreground border-border' },
    pendente: { txt: '◐ Pendente', cls: 'text-warning border-warning/40' },
  }[sit];
  return <span className={cn('text-[10px] px-2 py-0.5 border whitespace-nowrap', map.cls)}>{map.txt}</span>;
}
