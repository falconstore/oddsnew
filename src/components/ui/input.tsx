import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base
          "flex h-11 w-full rounded-xl border bg-background px-4 py-2",
          "text-base md:text-sm",
          // Border
          "border-input",
          // Placeholder
          "placeholder:text-muted-foreground/60",
          // Focus - Green glow effect
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/30",
          "focus-visible:border-primary",
          "focus-visible:shadow-[0_0_15px_hsl(142_70%_45%_/_0.2)]",
          // Dark mode focus
          "dark:focus-visible:shadow-[0_0_20px_hsl(142_70%_45%_/_0.25)]",
          // Transition
          "transition-all duration-200",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          // File input
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
