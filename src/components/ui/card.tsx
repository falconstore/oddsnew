import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl text-card-foreground transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        // Light mode: deep shadows | Dark mode: subtle borders with glow on hover
        default: [
          "bg-card",
          "shadow-card hover:shadow-card-hover",
          "dark:shadow-none dark:border dark:border-border/50",
          "dark:hover:border-primary/30 dark:hover:shadow-glow-primary",
          "hover:scale-[1.01]",
        ].join(" "),
        glass: [
          "bg-card/60 backdrop-blur-xl border border-border/20",
          "dark:bg-card/40 dark:border-border/30",
          "hover:scale-[1.01]",
        ].join(" "),
        gradient: [
          "bg-gradient-to-br from-card to-background border-0",
          "shadow-lg hover:shadow-xl",
          "dark:shadow-none dark:border dark:border-border/30",
          "hover:scale-[1.01]",
        ].join(" "),
        elevated: [
          "bg-card border-0",
          "shadow-xl hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]",
          "dark:shadow-none dark:border dark:border-border/60",
          "dark:hover:border-primary/50 dark:hover:shadow-glow-lg",
        ].join(" "),
        interactive: [
          "bg-card cursor-pointer",
          "shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]",
          "dark:shadow-none dark:border dark:border-border/50",
          "dark:hover:border-primary/50 dark:hover:bg-card/90",
          "dark:hover:shadow-[0_0_30px_hsl(142_70%_45%_/_0.15)]",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
