import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-line bg-card p-5 shadow-[0_1px_0_rgba(28,25,21,0.04)]", className)} {...props} />;
}
