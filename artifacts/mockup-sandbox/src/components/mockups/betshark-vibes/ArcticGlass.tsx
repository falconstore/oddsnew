import React from "react";
import { 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  CreditCard, 
  Send, 
  Users, 
  Settings, 
  LogOut, 
  Activity, 
  DollarSign, 
  Bot,
  Plus,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Server
} from "lucide-react";

export function ArcticGlass() {
  return (
    <div className="flex h-screen w-full bg-[#0d1117] text-[#f1f5f9] font-['Inter',sans-serif] overflow-hidden selection:bg-[#3b82f6]/30">
      
      {/* Sidebar */}
      <aside className="w-[240px] h-full bg-[#0d1117] border-r border-[#21262d] flex flex-col flex-shrink-0">
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-[#21262d]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a] flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              <Zap className="w-4 h-4 text-white fill-white/20" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-[15px] tracking-tight text-[#f1f5f9]">BetShark</span>
              <span className="text-[10px] font-bold bg-[#1d4ed8]/20 text-[#60a5fa] px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-6 px-3 overflow-y-auto">
          <div className="space-y-1">
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
            <NavItem icon={<FileText size={18} />} label="Procedimentos" />
            <NavItem icon={<TrendingUp size={18} />} label="Betbra Affiliate" />
            <NavItem icon={<CreditCard size={18} />} label="Assinaturas" />
            <NavItem icon={<Send size={18} />} label="Bot Telegram" />
            <NavItem icon={<Users size={18} />} label="Cadastros" />
            <NavItem icon={<Settings size={18} />} label="Configurações" />
          </div>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-[#21262d]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#161b22] transition-colors cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-[#21262d] flex items-center justify-center text-xs font-medium text-[#f1f5f9]">
              JD
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-[#f1f5f9] truncate">João Doe</p>
              <p className="text-xs text-[#64748b] truncate">joao@betshark.pro</p>
            </div>
            <LogOut size={16} className="text-[#64748b] group-hover:text-[#f1f5f9] transition-colors" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto bg-[#0d1117]">
        <div className="max-w-6xl mx-auto p-8 lg:p-10 space-y-8">
          
          {/* Header */}
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-[#f1f5f9] tracking-tight">Dashboard</h1>
            <p className="text-sm text-[#64748b]">Bem-vindo ao painel de controle administrativo.</p>
          </header>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard 
              title="Procedimentos" 
              value="247" 
              change="+12% este mês" 
              icon={<Activity size={20} />} 
              positive
            />
            <StatCard 
              title="Assinaturas" 
              value="89" 
              change="+3% este mês" 
              icon={<CreditCard size={20} />} 
              positive
            />
            <StatCard 
              title="NGR Mensal" 
              value="R$ 14.320" 
              change="+8% este mês" 
              icon={<DollarSign size={20} />} 
              positive
            />
            <StatCard 
              title="Bot Telegram" 
              value="Ativo" 
              change="Online" 
              icon={<Bot size={20} />} 
              positive
            />
          </div>

          {/* Activity Table */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[#21262d] flex items-center justify-between">
              <h2 className="text-[15px] font-medium text-[#f1f5f9]">Atividade Recente</h2>
              <button className="text-sm text-[#60a5fa] hover:text-[#3b82f6] transition-colors font-medium flex items-center gap-1.5">
                Ver todos <ArrowRight size={14} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-[#64748b] uppercase bg-[#21262d]/50">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">ID</th>
                    <th className="px-5 py-3.5 font-medium">Usuário</th>
                    <th className="px-5 py-3.5 font-medium">Ação</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 font-medium text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d]">
                  <TableRow id="#PROC-092" user="marcos.silva" action="Atualização de Odd" status="Concluído" date="Hoje, 14:32" />
                  <TableRow id="#PROC-091" user="system" action="Sincronização Betbra" status="Concluído" date="Hoje, 14:00" altBg />
                  <TableRow id="#PROC-090" user="ana.costa" action="Nova Assinatura Pro" status="Pendente" date="Hoje, 11:15" />
                  <TableRow id="#PROC-089" user="bot_telegram" action="Alerta de Arbitragem" status="Concluído" date="Ontem, 22:45" altBg />
                  <TableRow id="#PROC-088" user="carlos.edu" action="Cancelamento" status="Falha" date="Ontem, 16:20" />
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Links Rápidos */}
            <div className="lg:col-span-2 bg-[#161b22] border border-[#21262d] rounded-xl p-6">
              <h2 className="text-[15px] font-medium text-[#f1f5f9] mb-5">Links Rápidos</h2>
              <div className="grid grid-cols-2 gap-4">
                <QuickLink icon={<Plus size={18} />} label="Novo Procedimento" desc="Criar entrada manual" />
                <QuickLink icon={<Users size={18} />} label="Gerenciar Usuários" desc="Controle de acessos" />
                <QuickLink icon={<TrendingUp size={18} />} label="Relatório Betbra" desc="Análise de afiliados" />
                <QuickLink icon={<Settings size={18} />} label="Configurar Bot" desc="Ajustar alertas do Telegram" />
              </div>
            </div>

            {/* System Status */}
            <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-6">
              <h2 className="text-[15px] font-medium text-[#f1f5f9] mb-5">Status do Sistema</h2>
              <div className="space-y-4">
                <StatusRow label="API Principal" status="Operacional" />
                <StatusRow label="Scraper Betbra" status="Operacional" />
                <StatusRow label="Bot Telegram" status="Operacional" />
                <StatusRow label="Banco de Dados" status="Operacional" />
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}

// Subcomponents

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <a href="#" className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200
      ${active 
        ? "bg-[#1d4ed8]/15 text-[#60a5fa] border-l-2 border-[#3b82f6]" 
        : "text-[#6b7280] hover:text-[#94a3b8] hover:bg-[#161b22] border-l-2 border-transparent"
      }
    `}>
      <span className={`${active ? "text-[#3b82f6]" : "text-[#64748b]"}`}>{icon}</span>
      {label}
    </a>
  );
}

function StatCard({ title, value, change, icon, positive }: { title: string, value: string, change: string, icon: React.ReactNode, positive: boolean }) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 hover:border-[#30363d] transition-colors">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-[#64748b]">{title}</h3>
        <div className="text-[#3b82f6] bg-[#3b82f6]/10 p-2 rounded-lg">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-semibold text-[#f1f5f9] tracking-tight">{value}</p>
        <p className={`text-xs mt-1.5 font-medium ${positive ? "text-emerald-400" : "text-rose-400"}`}>
          {change}
        </p>
      </div>
    </div>
  );
}

function TableRow({ id, user, action, status, date, altBg = false }: { id: string, user: string, action: string, status: string, date: string, altBg?: boolean }) {
  return (
    <tr className={`group hover:bg-[#1c2128] transition-colors ${altBg ? 'bg-[#0d1117]' : 'bg-[#161b22]'}`}>
      <td className="px-5 py-4 whitespace-nowrap text-[#64748b] font-medium">{id}</td>
      <td className="px-5 py-4 whitespace-nowrap text-[#f1f5f9] flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-[#21262d] flex items-center justify-center text-[10px] text-[#8b949e]">
          {user.charAt(0).toUpperCase()}
        </div>
        {user}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-[#94a3b8]">{action}</td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border
          ${status === 'Concluído' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 
            status === 'Pendente' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 
            'bg-rose-400/10 text-rose-400 border-rose-400/20'}
        `}>
          {status}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-right text-[#64748b]">{date}</td>
    </tr>
  );
}

function QuickLink({ icon, label, desc }: { icon: React.ReactNode, label: string, desc: string }) {
  return (
    <button className="flex items-start gap-3 p-4 rounded-lg border border-[#21262d] bg-[#0d1117] hover:border-[#30363d] hover:bg-[#161b22] transition-all text-left group">
      <div className="text-[#64748b] group-hover:text-[#3b82f6] transition-colors mt-0.5">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-medium text-[#f1f5f9] group-hover:text-white transition-colors">{label}</h4>
        <p className="text-xs text-[#64748b] mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

function StatusRow({ label, status }: { label: string, status: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#21262d] last:border-0 last:pb-0">
      <div className="flex items-center gap-2.5">
        <Server size={14} className="text-[#64748b]" />
        <span className="text-sm text-[#94a3b8]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#f1f5f9]">{status}</span>
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)] relative">
           <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20"></div>
        </div>
      </div>
    </div>
  );
}
