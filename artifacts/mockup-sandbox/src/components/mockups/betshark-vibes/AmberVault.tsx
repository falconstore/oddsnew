import React from "react";
import {
  LayoutDashboard,
  ClipboardList,
  LineChart,
  Users,
  Bot,
  Settings,
  Database,
  Zap,
  TrendingUp,
  AlertCircle,
  Clock,
  Award,
  ChevronRight,
  ChevronUp,
  ChevronDown
} from "lucide-react";

export function AmberVault() {
  const noiseTexture = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

  return (
    <div className="flex h-screen w-full bg-[#0c0a07] text-[#fef3c7] font-sans overflow-hidden relative">
      {/* Texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay"
        style={{ backgroundImage: noiseTexture }}
      />

      {/* Sidebar */}
      <div className="w-[240px] flex-shrink-0 border-r border-[#2a2218] bg-[#0c0a07] flex flex-col relative z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#f59e0b]/40 via-[#f59e0b] to-[#f59e0b]/40" />

        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#141008] border border-[#2a2218] flex items-center justify-center text-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.2)]">
            <Zap size={18} fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-wide text-[#f59e0b]">BetShark</span>
            <span className="text-[10px] font-bold tracking-widest text-[#f59e0b]/70 mt-[-2px]">PRO</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { icon: LayoutDashboard, label: "Dashboard", active: true },
            { icon: ClipboardList, label: "Procedimentos" },
            { icon: LineChart, label: "Betbra Affiliate" },
            { icon: Users, label: "Assinaturas" },
            { icon: Bot, label: "Bot Telegram" },
            { icon: Database, label: "Cadastros" },
            { icon: Settings, label: "Configurações" },
          ].map((item, i) => (
            <button
              key={i}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-200 group ${
                item.active 
                  ? "bg-[#f59e0b]/10 text-[#f59e0b] font-medium" 
                  : "text-[#78716c] hover:text-[#fcd34d] hover:bg-[#141008]"
              }`}
            >
              {item.active && (
                <div className="absolute left-0 w-[3px] h-8 bg-[#f59e0b] rounded-r shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              )}
              <item.icon 
                size={18} 
                className={`${item.active ? "text-[#f59e0b]" : "text-[#78716c] group-hover:text-[#fcd34d]"}`} 
                fill={item.active ? "currentColor" : "none"}
                fillOpacity={0.2}
              />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#2a2218] mt-auto">
          <div className="flex items-center gap-3 p-2 rounded hover:bg-[#141008] transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full border-2 border-[#f59e0b] p-0.5 relative">
              <img 
                src="https://i.pravatar.cc/150?u=admin" 
                alt="User" 
                className="w-full h-full rounded-full object-cover grayscale opacity-80"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#0c0a07] rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-[#f59e0b] rounded-full shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#fef3c7]">Admin User</span>
              <span className="text-xs text-[#78716c]">Administrator</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-0">
        <header className="px-8 py-6 flex items-center justify-between border-b border-[#2a2218]/50 bg-[#0c0a07]/80 backdrop-blur-md z-10 sticky top-0">
          <div>
            <h1 className="text-2xl font-semibold text-[#f59e0b] tracking-tight">Painel de Controle</h1>
            <p className="text-sm text-[#78716c] mt-1">Sexta-feira, 24 de Maio • 14:32 BRT</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded border border-[#2a2218] bg-[#141008] flex items-center justify-center text-[#78716c] hover:text-[#f59e0b] hover:border-[#f59e0b]/50 transition-all shadow-inner">
              <Zap size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: "Lucro Mensal", value: "R$ 14.320", sub: "+R$ 2.100 vs ontem", subColor: "text-[#fb923c]", icon: TrendingUp },
              { label: "Procedimentos", value: "247", sub: "3 urgentes", subColor: "text-[#f43f5e]", icon: ClipboardList },
              { label: "Assinantes Ativos", value: "89", sub: "2 vencendo", subColor: "text-[#fb923c]", icon: Users },
              { label: "Bot DGs Hoje", value: "12", sub: "ROI +4.2%", subColor: "text-[#fb923c]", icon: Bot },
            ].map((stat, i) => (
              <div key={i} className="bg-[#141008] border border-[#2a2218] rounded-lg p-5 relative overflow-hidden group hover:border-[#f59e0b]/30 transition-colors shadow-lg shadow-black/40">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#f59e0b]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#f59e0b]/5 rounded-full blur-2xl group-hover:bg-[#f59e0b]/10 transition-colors" />
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <span className="text-sm font-medium text-[#78716c] tracking-wide">{stat.label}</span>
                  <div className="w-8 h-8 rounded bg-[#0c0a07] border border-[#2a2218] flex items-center justify-center text-[#f59e0b]">
                    <stat.icon size={16} fill="currentColor" fillOpacity={0.1} />
                  </div>
                </div>
                
                <div className="relative z-10">
                  <div className="text-3xl text-[#fef3c7] tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
                    {stat.value}
                  </div>
                  <div className={`text-xs mt-2 font-medium ${stat.subColor} flex items-center gap-1`}>
                    {stat.subColor.includes('f43f5e') ? <AlertCircle size={12} /> : <ChevronUp size={12} />}
                    {stat.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Wide Card: Table */}
          <div className="bg-[#141008] border border-[#2a2218] rounded-lg overflow-hidden shadow-xl shadow-black/50 relative">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#f59e0b]/30 to-transparent" />
            <div className="p-5 border-b border-[#2a2218] flex items-center justify-between">
              <h2 className="text-[#f59e0b] font-medium tracking-wide flex items-center gap-2">
                <Clock size={18} />
                Procedimentos Recentes
              </h2>
              <button className="text-xs text-[#78716c] hover:text-[#f59e0b] flex items-center gap-1 transition-colors">
                Ver todos <ChevronRight size={14} />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2a2218] text-xs uppercase tracking-wider text-[#78716c] bg-[#0c0a07]/50">
                    <th className="px-5 py-4 font-medium">Cliente</th>
                    <th className="px-5 py-4 font-medium">Tipo</th>
                    <th className="px-5 py-4 font-medium">Data</th>
                    <th className="px-5 py-4 font-medium">Valor</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-[#2a2218]/50">
                  {[
                    { client: "João Silva", type: "Saque Betano", date: "Hoje, 14:10", value: "R$ 1.500", status: "Concluído" },
                    { client: "Maria Oliveira", type: "Depósito Bet365", date: "Hoje, 11:45", value: "R$ 450", status: "Pendente" },
                    { client: "Carlos Santos", type: "Verificação", date: "Ontem, 16:30", value: "—", status: "Em Análise" },
                    { client: "Ana Costa", type: "Saque Pinnacle", date: "Ontem, 09:15", value: "R$ 3.200", status: "Concluído" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-[#0c0a07]/80 transition-colors group">
                      <td className="px-5 py-4 text-[#fef3c7] font-medium">{row.client}</td>
                      <td className="px-5 py-4 text-[#78716c]">{row.type}</td>
                      <td className="px-5 py-4 text-[#78716c]">{row.date}</td>
                      <td className="px-5 py-4 text-[#fef3c7]" style={{ fontFamily: 'Georgia, serif' }}>{row.value}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-[11px] rounded uppercase tracking-wider font-semibold border ${
                          row.status === 'Concluído' ? 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20' :
                          row.status === 'Pendente' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20' :
                          'bg-[#78716c]/10 text-[#78716c] border-[#78716c]/20'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Cards */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-[#141008] border border-[#2a2218] rounded-lg p-6 relative overflow-hidden group flex flex-col items-center justify-center text-center shadow-lg shadow-black/40">
              <div className="absolute inset-0 bg-gradient-to-b from-[#f59e0b]/5 to-transparent opacity-50" />
              <div className="w-16 h-16 rounded-full bg-[#0c0a07] border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)] relative z-10">
                <Award size={32} fill="currentColor" fillOpacity={0.2} />
              </div>
              <h3 className="text-[#78716c] text-sm font-medium tracking-wide uppercase mb-1 relative z-10">Plataforma do Mês</h3>
              <p className="text-xl font-bold text-[#fef3c7] relative z-10">Pinnacle</p>
              <div className="mt-4 px-3 py-1 rounded-full bg-[#fb923c]/10 border border-[#fb923c]/20 text-[#fb923c] text-xs font-medium flex items-center gap-1 relative z-10">
                <TrendingUp size={12} /> ROI Liderança
              </div>
            </div>

            <div className="col-span-2 bg-[#141008] border border-[#2a2218] rounded-lg p-6 shadow-lg shadow-black/40 relative">
              <h3 className="text-[#f59e0b] font-medium tracking-wide flex items-center gap-2 mb-6">
                <LineChart size={18} />
                Resumo Financeiro
              </h3>
              
              <div className="space-y-4">
                {[
                  { label: "Receita Operacional", value: "R$ 28.450", trend: "+12%", pos: true },
                  { label: "Custos Plataformas", value: "R$ 4.120", trend: "-2%", pos: true },
                  { label: "Taxas e Saques", value: "R$ 1.890", trend: "+5%", pos: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between pb-4 border-b border-[#2a2218]/50 last:border-0 last:pb-0">
                    <span className="text-[#78716c] text-sm">{item.label}</span>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-medium flex items-center gap-1 ${item.pos ? 'text-[#fb923c]' : 'text-[#f43f5e]'}`}>
                        {item.pos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {item.trend}
                      </span>
                      <span className="text-[#fef3c7] min-w-[100px] text-right" style={{ fontFamily: 'Georgia, serif' }}>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
