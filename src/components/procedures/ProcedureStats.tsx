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
      "p-4 flex flex-col transition-all duration-200 hover:shadow-lg",
      gradient
    )}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-[10px] text-muted-foreground font-medium mb-1">{title}</p>
          <p className="text-lg font-bold">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}
