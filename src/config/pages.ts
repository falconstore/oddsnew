// ============================================================================
// REGISTRO DE PÁGINAS — fonte ÚNICA da verdade do sistema de permissões.
//
// Adicionou uma aba nova? Basta registrar UM item aqui (e a rota em
// AnimatedRoutes). Ele aparece automaticamente:
//   - no menu lateral (Sidebar)
//   - na tela de permissões (Usuários), agrupado por seção
//   - no guard de rota (RequireAuth via canViewPage)
//
// Não precisa mais mexer em types/auth.ts, nem criar coluna no banco: o acesso
// é guardado numa coluna JSON `allowed_pages` (array de `key`s) em
// user_permissions. Aba nova nasce OCULTA pra usuário comum (default seguro);
// admin/super-admin sempre veem tudo.
// ============================================================================

import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Building2,
  Settings,
  UserCog,
  FileText,
  TrendingUp,
  CreditCard,
  Gift,
  Receipt,
  Trophy,
  Stamp,
  BookOpen,
  ScrollText,
  Megaphone,
  Bell,
  BarChart3,
  Brain,
  Send,
  Users2,
  ClipboardCheck,
} from 'lucide-react';

/** Seções do menu, na ordem em que aparecem. */
export type SectionId = 'OPERAÇÃO' | 'RECEITA' | 'AQUISIÇÃO' | 'SISTEMA';

export const SECTION_ORDER: SectionId[] = ['OPERAÇÃO', 'RECEITA', 'AQUISIÇÃO', 'SISTEMA'];

export interface PageDef {
  /** Identificador estável da página. NUNCA mude depois de criado — é o que
   *  fica salvo em allowed_pages no banco. Use snake_case. */
  key: string;
  /** Nome exibido no menu e na tela de permissões. */
  label: string;
  /** Descrição curta exibida na tela de permissões. */
  description: string;
  /** Rota (href) no menu. */
  href: string;
  /** Ícone do menu. */
  icon: ComponentType<{ className?: string }>;
  /** Seção do menu. */
  section: SectionId;
  /** Visível pra qualquer usuário logado, sem precisar de permissão
   *  (ex.: páginas utilitárias). Não aparece na tela de permissões. */
  alwaysVisible?: boolean;
  /** Só admin/super-admin podem acessar — não aparece como toggle pra liberar
   *  a usuário comum (ex.: gerenciar usuários, logs). */
  adminOnly?: boolean;
  /** Não exibir no menu lateral (mas continua sendo uma rota protegida). */
  hideFromSidebar?: boolean;
}

// ----------------------------------------------------------------------------
// As páginas do sistema. Ordem dentro de cada seção = ordem no menu.
// ----------------------------------------------------------------------------
export const PAGES: PageDef[] = [
  // OPERAÇÃO
  { key: 'dashboard', label: 'Dashboard', description: 'Visão geral do sistema', href: '/', icon: LayoutDashboard, section: 'OPERAÇÃO' },
  { key: 'procedure_control', label: 'Procedimentos', description: 'Gerenciar procedimentos', href: '/procedures', icon: FileText, section: 'OPERAÇÃO' },
  { key: 'freebets_ganhas', label: 'FreeBets Ganhas', description: 'Registro de freebets ganhas', href: '/procedures/freebets-ganhas', icon: Trophy, section: 'OPERAÇÃO' },
  { key: 'bot_templates', label: 'Templates Bot', description: 'Templates de mensagens do bot', href: '/bot-templates', icon: BookOpen, section: 'OPERAÇÃO' },
  { key: 'envio_procedimentos', label: 'Envio Procedimentos', description: 'Monta o procedimento e envia para revisão antes do disparo no Telegram', href: '/envio-procedimentos', icon: Send, section: 'OPERAÇÃO' },
  { key: 'revisao_procedimentos', label: 'Revisão Procedimentos', description: 'Revisa os procedimentos pendentes e libera (ou rejeita) o envio', href: '/revisao-procedimentos', icon: ClipboardCheck, section: 'OPERAÇÃO' },
  { key: 'casas', label: 'Casas', description: 'Cadastro de casas de apostas', href: '/cadastros', icon: Building2, section: 'OPERAÇÃO' },

  // RECEITA
  { key: 'betbra_affiliate', label: 'Betbra Affiliate', description: 'Dados de afiliação Betbra', href: '/betbra', icon: TrendingUp, section: 'RECEITA' },
  { key: 'subscriptions', label: 'Assinaturas', description: 'Controle de pagamentos', href: '/subscriptions', icon: CreditCard, section: 'RECEITA' },
  { key: 'lastlink_admin', label: 'Pagamentos Lastlink', description: 'Painel de pagamentos via Lastlink', href: '/lastlink-admin', icon: Receipt, section: 'RECEITA' },
  { key: 'lastlink_dashboard', label: 'Dashboard Lastlink', description: 'Dashboard de vendas e renovações Lastlink', href: '/lastlink-dashboard', icon: BarChart3, section: 'RECEITA' },

  // AQUISIÇÃO
  { key: 'grupo_free', label: 'Grupo Free', description: 'Acompanhamento de quem entra e sai do grupo gratuito', href: '/grupo-free', icon: Users2, section: 'AQUISIÇÃO' },
  { key: 'trial', label: 'Trial Telegram', description: 'CRM legado do trial de 7 dias (histórico)', href: '/trial-admin', icon: Gift, section: 'AQUISIÇÃO', hideFromSidebar: true },
  { key: 'ads_admin', label: 'Anúncios', description: 'Gerenciar anúncios', href: '/ads-admin', icon: Megaphone, section: 'AQUISIÇÃO' },
  { key: 'app_stats', label: 'Estatísticas App', description: 'Estatísticas de uso do app', href: '/app-stats', icon: BarChart3, section: 'AQUISIÇÃO' },
  { key: 'push_notifications', label: 'Push Notifications', description: 'Envio de notificações push', href: '/push-notifications', icon: Bell, section: 'AQUISIÇÃO' },

  // SISTEMA
  { key: 'watermark', label: "Marca d'Água", description: "Editor de marca d'água com logo Shark", href: '/watermark', icon: Stamp, section: 'SISTEMA' },
  { key: 'settings', label: 'Configurações', description: 'Configurações do sistema', href: '/settings', icon: Settings, section: 'SISTEMA' },
  { key: 'admin_users', label: 'Usuários', description: 'Gerenciar usuários e permissões', href: '/admin/users', icon: UserCog, section: 'SISTEMA', adminOnly: true },
  { key: 'bot_logs', label: 'Logs do Bot', description: 'Logs e diagnóstico do bot', href: '/admin/bot-logs', icon: ScrollText, section: 'SISTEMA', adminOnly: true },
  { key: 'parser_ia', label: 'Parser IA', description: 'Aprendizado e custos da IA do parser', href: '/admin/parser-ia', icon: Brain, section: 'SISTEMA', adminOnly: true },
];

// ----------------------------------------------------------------------------
// Derivados — não editar à mão.
// ----------------------------------------------------------------------------

/** Lookup rápido por key. */
export const PAGE_BY_KEY: Record<string, PageDef> = Object.fromEntries(
  PAGES.map((p) => [p.key, p]),
);

/** Páginas que aparecem como toggle na tela de permissões: nem alwaysVisible
 *  (todo mundo vê) nem adminOnly (só admin). São as que você libera por usuário. */
export const PERMISSION_PAGES = PAGES.filter((p) => !p.alwaysVisible && !p.adminOnly);

/** Permission pages agrupadas por seção, na ordem do menu. */
export const PERMISSION_PAGES_BY_SECTION: { section: SectionId; pages: PageDef[] }[] =
  SECTION_ORDER
    .map((section) => ({ section, pages: PERMISSION_PAGES.filter((p) => p.section === section) }))
    .filter((g) => g.pages.length > 0);

/** Páginas que aparecem no menu lateral, agrupadas por seção. */
export const SIDEBAR_PAGES_BY_SECTION: { section: SectionId; pages: PageDef[] }[] =
  SECTION_ORDER
    .map((section) => ({ section, pages: PAGES.filter((p) => p.section === section && !p.hideFromSidebar) }))
    .filter((g) => g.pages.length > 0);
