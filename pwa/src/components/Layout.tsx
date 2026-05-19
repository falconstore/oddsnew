import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, ListChecks, User } from 'lucide-react'
import { motion } from 'framer-motion'

const NAV = [
  { to: '/',          label: 'Início',       icon: LayoutDashboard },
  { to: '/sinais',    label: 'Sinais',       icon: ListChecks },
  { to: '/perfil',    label: 'Perfil',       icon: User },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="app-shell flex flex-col" style={{ height: '100dvh' }}>
      <main className="flex-1 overflow-hidden relative page-transition">
        {children}
      </main>

      <nav className="bottom-nav relative z-20 flex items-center justify-around px-2 pt-3"
           style={{ background: 'rgba(11,17,32,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to}
              className="flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-all relative"
              style={{ minWidth: 64 }}>
              {active && (
                <motion.div layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'rgba(30,222,107,0.1)' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
              )}
              <Icon size={20} style={{ color: active ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }} />
              <span className="text-[10px] font-semibold tracking-wide"
                    style={{ color: active ? 'hsl(145 80% 48%)' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
