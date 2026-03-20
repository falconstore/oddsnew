import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  CreditCard, 
  Bot, 
  Building2, 
  Settings,
  LogOut,
  Zap,
  Activity,
  AlertTriangle,
  TerminalSquare
} from 'lucide-react';

export function NeonNoir() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700;800&display=swap');
        
        .font-sans { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        /* Custom scrollbar for terminal vibe */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #060608; }
        ::-webkit-scrollbar-thumb { background: #00e67640; border-radius: 0px; }
        ::-webkit-scrollbar-thumb:hover { background: #00e67680; }
        
        .scanline-bg {
          background-color: #060608;
          background-image: repeating-linear-gradient(0deg, rgba(0,255,120,0.015) 0px, rgba(0,255,120,0.015) 1px, transparent 1px, transparent 4px);
        }
        
        .neon-border {
          border: 1px solid rgba(0, 230, 118, 0.2);
        }
        
        .neon-text-glow {
          text-shadow: 0 0 8px rgba(0, 230, 118, 0.4);
        }
        
        .cyan-text-glow {
          text-shadow: 0 0 8px rgba(0, 229, 255, 0.4);
        }
      `}</style>
      
      <div className="min-h-screen flex flex-col font-sans text-[#88c9a0] scanline-bg overflow-hidden selection:bg-[#00e676]/30 selection:text-white">
        
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[240px] shrink-0 bg-[#070a07] border-r border-[#00e676]/20 flex flex-col z-10">
            {/* Logo */}
            <div className="h-16 flex flex-col justify-center px-6 border-b border-[#00e676]/20 bg-[#060608]/50">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#00e676]" fill="#00e676" />
                <span className="font-mono font-bold text-[#00e676] tracking-wider text-lg neon-text-glow">BETSHARK</span>
              </div>
              <span className="font-mono text-[10px] tracking-widest text-[#00e676]/70 ml-7 mt-0.5">PRO</span>
            </div>
            
            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
              {[
                { icon: LayoutDashboard, label: 'Dashboard', active: true },
                { icon: FileText, label: 'Procedimentos' },
                { icon: TrendingUp, label: 'Betbra Affiliate' },
                { icon: CreditCard, label: 'Assinaturas' },
                { icon: Bot, label: 'Bot Telegram' },
                { icon: Building2, label: 'Cadastros' },
                { icon: Settings, label: 'Configurações' },
              ].map((item, i) => (
                <button
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors ${
                    item.active 
                      ? 'bg-[#00e676]/10 text-[#00e676] border-l-2 border-[#00e676]' 
                      : 'text-[#4a7a58] hover:text-[#00e676]/80 hover:bg-[#00e676]/5 border-l-2 border-transparent'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${item.active ? 'text-[#00e676]' : 'text-[#4a7a58]'}`} />
                  {item.label}
                </button>
              ))}
            </nav>
            
            {/* User */}
            <div className="p-4 border-t border-[#00e676]/20 bg-[#060608]/50">
              <div className="flex items-center justify-between p-2 rounded bg-[#0a0e0a] neon-border">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-6 h-6 rounded-sm bg-[#00e676]/20 flex items-center justify-center border border-[#00e676]/40">
                    <TerminalSquare className="w-3.5 h-3.5 text-[#00e676]" />
                  </div>
                  <span className="font-mono text-[10px] text-[#88c9a0] truncate">admin@email.com</span>
                </div>
                <button className="text-[#4a7a58] hover:text-[#00e5ff] transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-8 border-b border-[#00e676]/20 bg-[#060608]/80 backdrop-blur-sm sticky top-0 z-10">
              <div>
                <h1 className="font-mono text-xl font-bold text-[#00e676] tracking-tight flex items-center gap-2">
                  <span className="text-[#00e676]/50">&gt;</span> DASHBOARD
                  <span className="w-2 h-5 bg-[#00e676] animate-pulse inline-block ml-1"></span>
                </h1>
                <p className="font-mono text-[10px] text-[#4a7a58] uppercase tracking-wider">System Overview / Performance Metrics</p>
              </div>
              
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-[#00e5ff] bg-[#00e5ff]/10 px-2 py-1 border border-[#00e5ff]/20 rounded-sm">
                  <Activity className="w-3.5 h-3.5" />
                  <span>SYS_OPTIMAL</span>
                </div>
                <div className="text-[#4a7a58]">
                  {new Date().toISOString().split('T')[0]}
                </div>
              </div>
            </header>
            
            <div className="p-8 flex-1 flex flex-col gap-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Procedimentos', value: '247', icon: FileText, color: '#00e676' },
                  { label: 'Assinaturas', value: '89', icon: CreditCard, color: '#00e676' },
                  { label: 'NGR Mensal', value: 'R$ 14.320', icon: TrendingUp, color: '#00e676' },
                  { label: 'Bot Status', value: 'ATIVO', icon: Bot, color: '#00e676' },
                ].map((stat, i) => (
                  <div key={i} className="bg-[#0a0e0a] p-4 neon-border relative group">
                    {/* Decorative corners */}
                    <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-[#00e676]/50"></div>
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-[#00e676]/50"></div>
                    <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-[#00e676]/50"></div>
                    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-[#00e676]/50"></div>
                    
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-sans text-xs uppercase tracking-wider text-[#88c9a0]">{stat.label}</span>
                      <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                    </div>
                    <div>
                      <span className="font-mono text-[28px] font-bold text-[#f0fff4]">{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                {/* Alertas Urgentes */}
                <div className="bg-[#0a0e0a] neon-border flex flex-col relative">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#00e676] to-transparent opacity-50"></div>
                  <div className="p-4 border-b border-[#00e676]/20 flex items-center justify-between">
                    <h2 className="font-mono text-sm font-bold text-[#f0fff4] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Alertas Urgentes
                    </h2>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    {[
                      { id: 'PROC-001', type: 'SAQUE', status: 'CRÍTICO', color: 'text-red-500', bg: 'bg-red-500', border: 'border-red-500', time: '10m', user: 'joao.silva' },
                      { id: 'PROC-089', type: 'VERIFICAÇÃO', status: 'ATRASO', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500', time: '45m', user: 'maria.o' },
                      { id: 'PROC-112', type: 'DEPÓSITO', status: 'ATENÇÃO', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500', time: '1h', user: 'pedro.bet' },
                    ].map((alert, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border border-[#00e676]/10 bg-[#060608] hover:border-[#00e676]/30 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${alert.bg} animate-pulse`}></div>
                          <div>
                            <div className="font-mono text-xs text-[#f0fff4]">{alert.id} <span className="text-[#4a7a58] text-[10px]">[{alert.type}]</span></div>
                            <div className="font-mono text-[10px] text-[#4a7a58] mt-1">usr: {alert.user}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-[9px] px-1.5 py-0.5 border ${alert.border}/50 ${alert.color}`}>{alert.status}</span>
                          <span className="font-mono text-[10px] text-[#4a7a58] w-6 text-right">{alert.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Performance */}
                <div className="bg-[#0a0e0a] neon-border flex flex-col relative">
                  <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-[#00e5ff] to-transparent opacity-50"></div>
                  <div className="p-4 border-b border-[#00e676]/20 flex items-center justify-between">
                    <h2 className="font-mono text-sm font-bold text-[#f0fff4] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#00e5ff]" />
                      Performance
                    </h2>
                  </div>
                  <div className="p-4 flex flex-col justify-between flex-1 gap-4">
                    {[
                      { label: 'Taxa de Conversão', value: '14.2%', target: '12.0%', bar: 75, color: '#00e676' },
                      { label: 'Tempo Médio Resposta', value: '1.2s', target: '2.0s', bar: 90, color: '#00e5ff' },
                      { label: 'Sucesso Bot Telegram', value: '98.5%', target: '95.0%', bar: 98, color: '#00e676' },
                      { label: 'Retenção 7D', value: '64.3%', target: '60.0%', bar: 65, color: '#00e5ff' },
                      { label: 'Procedimentos / Hora', value: '42', target: '35', bar: 85, color: '#00e676' },
                    ].map((metric, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-end">
                          <span className="font-sans text-xs text-[#88c9a0]">{metric.label}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-sm text-[#f0fff4]">{metric.value}</span>
                          </div>
                        </div>
                        <div className="w-full h-1 bg-[#060608] border border-[#00e676]/20 overflow-hidden">
                          <div 
                            className="h-full" 
                            style={{ 
                              width: \`\${metric.bar}%\`, 
                              backgroundColor: metric.color,
                              boxShadow: \`0 0 5px \${metric.color}\` 
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
          </main>
        </div>
        
        {/* Terminal Bottom Bar */}
        <footer className="h-7 bg-[#00e676] text-[#060608] font-mono text-[10px] flex items-center justify-between px-4 shrink-0 font-bold z-20">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">● CONECTADO</span>
            <span className="opacity-50">|</span>
            <span>● TEMPO REAL</span>
            <span className="opacity-50">|</span>
            <span>● 47ms</span>
          </div>
          <div className="flex items-center gap-4">
            <span>MEM: 24%</span>
            <span>CPU: 12%</span>
          </div>
        </footer>
        
      </div>
    </>
  );
}
