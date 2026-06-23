import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface LayoutProps {
  children: ReactNode;
}

const COLLAPSE_KEY = 'admin:sidebar-collapsed';

export function Layout({ children }: LayoutProps) {
  // Estado de colapso da sidebar (desktop). Persistido pra sobreviver a refresh.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <div className="app-admin min-h-screen">
      <Sidebar collapsed={collapsed} />
      <div
        className={
          (collapsed ? 'md:ml-0' : 'md:ml-64') +
          ' min-h-screen flex flex-col transition-[margin] duration-300 ease-out'
        }
      >
        <TopBar collapsed={collapsed} onToggleSidebar={() => setCollapsed((v) => !v)} />
        <main className="flex-1">
          <div className="p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
