import logoPath from "@assets/logo_1778182494299.png";
import { ChevronRight } from "lucide-react";

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function TelegramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.820 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

const LINKS = [
  {
    id: 1,
    emoji: "🎁",
    title: "Grupo VIP 7 Dias — Teste Grátis",
    badge: { label: "GRÁTIS 7 DIAS", color: "green" },
    description: "Entre no grupo VIP sem pagar nada. Veja o sistema ao vivo por 7 dias.",
    href: "https://trial.sharkgreen.com.br",
  },
  {
    id: 2,
    emoji: "💎",
    title: "Combo Monitor + FreeBet Pro",
    badge: { label: "MELHOR VALOR", color: "yellow" },
    description: "Planilha profissional + Radar de Odds em um único ecossistema.",
    href: "https://freebetpro.com.br/paginadecadastro",
  },
  {
    id: 3,
    emoji: "🦈",
    title: "Grupo Grátis Shark",
    badge: { label: "GRÁTIS", color: "green" },
    description: "Acesse nosso grupo gratuito e comece a aprender.",
    href: "https://t.me/+f0kXcUaUka00NzEx",
  },
  {
    id: 4,
    emoji: "📊",
    title: "FreeBet Pro — Sistema Profissional",
    badge: null,
    description: "Gestão de bancas, calculadoras avançadas e relatórios completos.",
    href: "https://freebetpro.com.br/planilhaprofissional",
  },
  {
    id: 5,
    emoji: "📡",
    title: "Monitor Odds — Radar de Oportunidades",
    badge: null,
    description: "Surebets, Duplo Green, Super Odds e Deep Links com varredura 24/7.",
    href: "https://monitorodds.com.br/",
  },
  {
    id: 6,
    emoji: "💬",
    title: "Suporte via Telegram",
    badge: null,
    description: "Fale direto com nossa equipe. Resposta rápida garantida.",
    href: "https://t.me/SuporteSharkGreen_financeiro",
  },
];

const BADGE_STYLES: Record<string, string> = {
  green: "bg-[#00ff8820] text-[#00ff88] border border-[#00ff8840]",
  yellow: "bg-[#ffcc0020] text-[#ffcc00] border border-[#ffcc0040]",
  orange: "bg-[#ff800020] text-[#ff8000] border border-[#ff800040]",
};

const BORDER_COLORS: Record<number, string> = {
  1: "border-l-[#00ff88]",
  2: "border-l-[#ffcc00]",
  3: "border-l-[#00ff88]",
  4: "border-l-[#00bfff]",
  5: "border-l-[#a855f7]",
  6: "border-l-[#00bfff]",
};

export default function BioLinks() {
  return (
    <div
      className="min-h-screen w-full flex justify-center"
      style={{
        background: "radial-gradient(ellipse at top, #0a1a0f 0%, #060d08 60%, #050c07 100%)",
      }}
    >
      <div className="w-full max-w-[440px] px-4 py-8 flex flex-col gap-0">

        {/* Logo */}
        <div className="flex justify-center mb-5">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{ boxShadow: "0 0 32px #00ff8830" }}
          >
            <img src={logoPath} alt="Shark 100% Green" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-1">
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #00ff88 0%, #00cc66 60%, #00ffaa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Shark 100% Green
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Apostas Esportivas com Método — Sem Achismo
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 my-5">
          {[
            { value: "800+", label: "Membros VIP" },
            { value: "R$ 1M+", label: "Resultados" },
            { value: "99%", label: "Satisfação" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center justify-center rounded-xl py-3 px-1"
              style={{
                background: "rgba(0,255,136,0.05)",
                border: "1px solid rgba(0,255,136,0.12)",
              }}
            >
              <span className="text-base font-bold text-[#00ff88]">{s.value}</span>
              <span className="text-[10px] text-white/40 mt-0.5 text-center leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Social icons */}
        <div className="flex justify-center gap-4 mb-6">
          <a
            href="https://www.instagram.com/sharkgreen_apostas"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-instagram"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90"
            style={{
              background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
            }}
          >
            <InstagramIcon size={20} />
          </a>
          <a
            href="https://t.me/SuporteSharkGreen_financeiro"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-telegram-social"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90"
            style={{ background: "#229ED9" }}
          >
            <TelegramIcon size={20} />
          </a>
        </div>

        {/* Links label */}
        <p className="text-[10px] text-white/25 text-center uppercase tracking-[0.2em] mb-3">
          Links
        </p>

        {/* Link cards */}
        <div className="flex flex-col gap-3">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`link-card-${link.id}`}
              className={`flex items-center gap-3 rounded-xl p-4 border-l-4 transition-all active:scale-[0.98] select-none ${BORDER_COLORS[link.id]}`}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderLeftWidth: "4px",
                borderLeftStyle: "solid",
              }}
            >
              {/* Number + emoji */}
              <div className="flex-shrink-0 flex flex-col items-center gap-0.5 w-8">
                <span className="text-[10px] text-white/25 font-mono leading-none">{link.id}</span>
                <span className="text-xl leading-none">{link.emoji}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white leading-snug">
                    {link.title}
                  </span>
                  {link.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${BADGE_STYLES[link.badge.color]}`}
                    >
                      {link.badge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5 leading-snug">{link.description}</p>
              </div>

              {/* Arrow */}
              <ChevronRight size={16} className="flex-shrink-0 text-white/20" />
            </a>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/15 mt-8 mb-2">
          sharkgreen.com.br
        </p>
      </div>
    </div>
  );
}
