import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  // not_found → paywall (sem lead no banco)
  // expired → passa, mas ProcedureRoute bloqueia as abas de procedimentos
  if (status === 'not_found') return <Navigate to="/paywall" replace />

  return <>{children}</>
}
