import { Smartphone } from 'lucide-react'

export function MobileOnly({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center"
           style={{ background: '#0b1120' }}>
        <div className="text-center px-8 max-w-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
               style={{ background: 'rgba(30,222,107,0.1)', border: '1px solid rgba(30,222,107,0.3)' }}>
            <Smartphone size={28} style={{ color: 'hsl(145 80% 48%)' }} />
          </div>
          <h2 className="text-xl font-bold mb-3 text-white">Acesse pelo celular</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            O Shark Green App foi projetado para dispositivos móveis.<br />
            Abra no seu celular para a melhor experiência.
          </p>
          <div className="mt-6 px-4 py-2 rounded-full text-sm font-semibold inline-block"
               style={{ background: 'rgba(30,222,107,0.15)', color: 'hsl(145 80% 48%)', border: '1px solid rgba(30,222,107,0.3)' }}>
            app.sharkgreen.com.br
          </div>
        </div>
      </div>
      <div className="md:hidden">{children}</div>
    </>
  )
}
