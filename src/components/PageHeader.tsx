import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  /** Código de telemetria, ex: "REL_001" ou "OPS" — fica no eyebrow mono. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Ações à direita (botões, selects). */
  actions?: ReactNode;
}

// Cabeçalho de página no padrão console: eyebrow mono de telemetria, título
// display, ações à direita, fechado por um hairline que atravessa a página.
export function PageHeader({ eyebrow, title, subtitle, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="border-b border-border pb-4 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="w-9 h-9 mt-0.5 flex items-center justify-center border border-border text-primary flex-shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="telemetry-label text-primary mb-1">[ {eyebrow} ]</p>}
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="telemetry-label text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
