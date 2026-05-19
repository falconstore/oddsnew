import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LoadingScreen } from '@/components/LoadingScreen'

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    // Supabase coloca o token no hash (#access_token=...) ou query (?code=...)
    // detectSessionInUrl: true no cliente processa automaticamente,
    // mas precisamos aguardar o evento SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/', { replace: true })
      } else if (event === 'TOKEN_REFRESHED' && session) {
        navigate('/', { replace: true })
      }
    })

    // Fallback: checar sessão já existente após breve delay
    const timer = setTimeout(async () => {
      const { data, error: err } = await supabase.auth.getSession()
      if (data.session) {
        navigate('/', { replace: true })
      } else {
        // Tentar extrair o token do hash da URL manualmente
        const hash = window.location.hash
        const params = new URLSearchParams(hash.replace('#', ''))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!setErr) {
            navigate('/', { replace: true })
          } else {
            setError('Link inválido ou expirado.')
          }
        } else {
          setError('Sessão não encontrada. Tente fazer login novamente.')
        }
      }
    }, 1500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [navigate])

  if (error) {
    return (
      <div className="app-shell flex flex-col items-center justify-center min-h-dvh px-6"
           style={{ background: '#0b1120' }}>
        <div className="glass p-6 text-center max-w-sm w-full">
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-sm text-white mb-4">{error}</p>
          <button onClick={() => navigate('/login', { replace: true })}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'hsl(145 80% 48%)', color: '#0b1120' }}>
            Voltar ao login
          </button>
        </div>
      </div>
    )
  }

  return <LoadingScreen />
}
