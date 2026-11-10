import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-moss text-paper hover:bg-moss-dark",
        secondary: "border border-line bg-card text-ink hover:border-moss",
        ghost: "text-ink hover:bg-ink/5",
        danger: "bg-danger text-paper hover:opacity-90",
      },
      size: {
        md: "h-11 px-5",
        sm: "h-9 px-3 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
