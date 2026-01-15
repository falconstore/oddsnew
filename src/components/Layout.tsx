import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:ml-64 p-3 sm:p-4 md:p-8 pt-16 md:pt-8">
        {children}
      </main>
    </div>
  );
}
