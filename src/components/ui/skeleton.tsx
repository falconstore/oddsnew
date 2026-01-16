import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "rounded-md bg-muted relative overflow-hidden",
        // Shimmer effect using pseudo-element
        "before:absolute before:inset-0",
        "before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r",
        "before:from-transparent before:via-foreground/5 before:to-transparent",
        "dark:before:via-primary/10",
        className
      )} 
      {...props} 
    />
  );
}

export { Skeleton };
