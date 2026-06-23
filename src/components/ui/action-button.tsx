// ActionButton — botão de ação PADRÃO do admin (editar, excluir, arquivar, etc.).
//
// Fonte única de verdade pro visual dos botões de ação em tabelas e cards:
// tamanho, forma (quadrado), e COR POR INTENÇÃO (o ícone já vem colorido,
// o fundo colorido aparece no hover). Use em vez de montar <Button> na mão
// pra garantir que todas as abas fiquem idênticas.
//
// Dois modos:
//  - ícone-só (default): quadrado h-7 w-7, pra colunas "Ações" de tabela.
//  - com label (`label`): full-width opcional, pra cards mobile.
import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Intenção semântica → classes de cor (ícone + hover). 'neutral' = cinza.
export type ActionIntent =
  | "edit"      // editar — verde (primary)
  | "confirm"   // conferir/ativar — verde (primary)
  | "delete"    // excluir/remover — vermelho (destructive)
  | "archive"   // arquivar/desativar — âmbar (warning)
  | "warning"   // ações de atenção — âmbar (warning)
  | "neutral";  // ações secundárias — cinza

const INTENT_CLASSES: Record<ActionIntent, string> = {
  edit: "text-primary hover:text-primary hover:bg-primary/10",
  confirm: "text-primary hover:text-primary hover:bg-primary/10",
  delete: "text-destructive hover:text-destructive hover:bg-destructive/10",
  archive: "text-warning hover:text-warning hover:bg-warning/10",
  warning: "text-warning hover:text-warning hover:bg-warning/10",
  neutral: "text-muted-foreground/70 hover:text-foreground hover:bg-accent",
};

// Borda por intenção — usada no modo com label (cards).
const INTENT_BORDER: Record<ActionIntent, string> = {
  edit: "border-primary/30",
  confirm: "border-primary/30",
  delete: "border-destructive/30",
  archive: "border-warning/30",
  warning: "border-warning/30",
  neutral: "border-border",
};

interface ActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  icon: LucideIcon;
  /** Texto acessível + tooltip. Obrigatório. */
  label: string;
  intent?: ActionIntent;
  /** Mostra o texto ao lado do ícone (modo card). Sem isto = ícone-só. */
  showLabel?: boolean;
  /** No modo card, ocupa a largura disponível (flex-1). */
  block?: boolean;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon: Icon, label, intent = "neutral", showLabel = false, block = false, className, ...props }, ref) => {
    if (showLabel) {
      // Modo card: borda + texto, altura h-8.
      return (
        <button
          ref={ref}
          type="button"
          title={label}
          aria-label={label}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium",
            "border bg-transparent transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
            INTENT_BORDER[intent],
            INTENT_CLASSES[intent],
            block && "flex-1",
            className,
          )}
          {...props}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      );
    }

    // Modo ícone-só: quadrado h-7 w-7, sem borda, ícone colorido + hover.
    return (
      <button
        ref={ref}
        type="button"
        title={label}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 shrink-0",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          INTENT_CLASSES[intent],
          className,
        )}
        {...props}
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
    );
  },
);
ActionButton.displayName = "ActionButton";

/** Wrapper padrão pra agrupar ActionButtons numa célula/linha de tabela. */
export function ActionGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-0.5 justify-end", className)}>
      {children}
    </div>
  );
}
