export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-glow"
         style={{ background: '#0b1120' }}>
      <div className="flex flex-col items-center gap-4">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Shark Green" className="w-16 h-16 rounded-2xl animate-pulse" />
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'hsl(145 80% 48%)', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
