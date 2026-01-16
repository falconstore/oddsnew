import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface MatchCardSkeletonProps {
  isBasketball?: boolean;
}

export function MatchCardSkeleton({ isBasketball = false }: MatchCardSkeletonProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-3">
          {/* Teams header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded-full" />
              <Skeleton className="h-5 w-24 sm:w-32" />
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-5 w-24 sm:w-32" />
              <Skeleton className="h-5 w-5 sm:h-6 sm:w-6 rounded-full" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          
          {/* League badge */}
          <Skeleton className="h-5 w-28 rounded-full" />
          
          {/* Date */}
          <Skeleton className="h-4 w-32" />
          
          {/* Odds grid */}
          <div className="pt-2 border-t border-border/50">
            <div className={`grid gap-3 sm:gap-4 ${isBasketball ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {Array.from({ length: isBasketball ? 3 : 4 }).map((_, i) => (
                <div key={i} className="text-center space-y-2">
                  <Skeleton className="h-3 w-14 sm:w-16 mx-auto" />
                  <Skeleton className="h-7 sm:h-8 w-12 sm:w-14 mx-auto rounded-lg" />
                  <Skeleton className="h-3 w-10 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
