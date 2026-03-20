import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 sm:p-6 md:p-8 pt-16 md:pt-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
