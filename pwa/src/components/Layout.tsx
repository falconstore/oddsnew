import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { motion } from 'framer-motion'
import { useProceduresToday } from '@/hooks/useProcedures'
import { differenceInMinutes, isFuture, parseISO } from 'date-fns'

function useLiveCount() {
  const { data: procs = [] } = useProceduresToday()
  return procs.filter(p => {
    if (!p.kickoff_at || p.tachado || p.archived) return false
    const k = parseISO(p.kickoff_at)
    return !isFuture(k) && differenceInMinutes(new Date(), k) < 240
  }).length
}

// Inline soccer-ball SVG (simple pentagon pattern)
function SoccerIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="12,7.5 15.5,10 14.5,14 9.5,14 8.5,10" fill={color} stroke="none" opacity="0.6" />
      <line x1="12" y1="2" x2="12" y2="7.5" /><line x1="21.5" y1="8" x2="15.5" y2="10" />
      <line x1="18.5" y1="19" x2="14.5" y2="14" /><line x1="5.5" y1="19" x2="9.5" y2="14" />
      <line x1="2.5" y1="8" x2="8.5" y2="10" />
    </svg>
  )
}

// Pulsing live dot icon
function LiveIcon({ size = 20, color = '#ef4444' }: { size?: number; color?: string }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round">
        <path d="M2 12 C2 12 5 5 12 5 C19 5 22 12 22 12 C22 12 19 19 12 19 C5 19 2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
      </svg>
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" style={{ opacity: 0.9 }} />
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
    </div>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const liveCount = useLiveCount()

  const NAV = [
    { to: '/',             label: 'Início',        renderIcon: (active: boolean) => <LayoutDashboard size={20} style={{ color: active ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.4)' }} />, liveStyle: false },
    { to: '/ao-vivo',      label: 'Ao Vivo',       renderIcon: (active: boolean) => <LiveIcon size={20} color={active ? '#ef4444' : 'rgba(255,255,255,0.4)'} />, liveStyle: true },
    { to: '/procedimentos', label: 'Procedimentos', renderIcon: (active: boolean) => <SoccerIcon size={20} color={active ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.4)'} />, liveStyle: false },
  ]

  return (
    <div className="app-shell flex flex-col" style={{ height: '100dvh' }}>
      <main className="flex-1 overflow-hidden relative page-transition">
        {children}
      </main>

      <nav className="bottom-nav relative z-20 flex items-center justify-around px-2 pt-3"
           style={{ background: 'rgba(11,17,32,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {NAV.map(({ to, label, renderIcon, liveStyle }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          const activeBg = liveStyle ? 'rgba(239,68,68,0.1)' : 'rgba(30,222,107,0.1)'
          const activeColor = liveStyle ? '#ef4444' : 'hsl(145 80% 48%)'
          return (
            <NavLink key={to} to={to}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all relative"
              style={{ minWidth: 56 }}>
              {active && (
                <motion.div layoutId={`nav-pill-${liveStyle ? 'live' : 'std'}`}
                  className="absolute inset-0 rounded-xl"
                  style={{ background: activeBg }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
              )}
              <div className="relative">
                {renderIcon(active)}
                {/* Live badge on Ao Vivo tab when not active */}
                {liveStyle && !active && liveCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                    style={{ background: '#ef4444', color: 'white' }}>
                    {liveCount > 9 ? '9+' : liveCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold tracking-wide"
                    style={{ color: active ? activeColor : 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
