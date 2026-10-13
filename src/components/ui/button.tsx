import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] shadow-sm",
        outline:
          "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground text-foreground active:scale-[0.98]",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-muted active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:text-foreground active:scale-[0.98]",
        destructive:
          "border border-destructive/50 text-destructive bg-transparent hover:bg-destructive/15 active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-4 py-2 text-sm [&_svg]:size-4",
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
        lg: "h-11 px-6 text-sm [&_svg]:size-4.5",
        icon: "h-[38px] w-[38px] p-0 [&_svg]:size-4",
        "icon-sm": "h-8 w-8 p-0 [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="animate-spin size-3.5" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
