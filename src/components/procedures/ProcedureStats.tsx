import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  gradient?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, gradient }: StatCardProps) {
  return (
    <Card className={cn(
      "p-6 flex flex-col transition-all duration-200 hover:shadow-lg",
      gradient
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground font-medium mb-2">{title}</p>
          <p className="text-xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
