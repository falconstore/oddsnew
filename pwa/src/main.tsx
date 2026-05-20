import { StrictMode, Component, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          background: '#0b1120', color: '#fff', minHeight: '100vh',
          padding: '24px', fontFamily: 'monospace', fontSize: '13px',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ color: '#ff4444', fontSize: '16px', fontWeight: 'bold' }}>
            💥 App crash — copie isso e envie pro suporte:
          </div>
          <div style={{
            background: '#1a2235', padding: '12px', borderRadius: '8px',
            wordBreak: 'break-all', whiteSpace: 'pre-wrap',
          }}>
            {this.state.error.message}
          </div>
          <div style={{
            background: '#1a2235', padding: '12px', borderRadius: '8px',
            wordBreak: 'break-all', whiteSpace: 'pre-wrap', fontSize: '11px',
            color: '#aaa',
          }}>
            {this.state.error.stack?.slice(0, 600)}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'hsl(145 80% 48%)', color: '#000', border: 'none',
              padding: '12px 24px', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '14px', marginTop: '8px',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
