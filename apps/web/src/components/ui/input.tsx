import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-muted/80",
        className,
      )}
      {...props}
    />
  );
}
