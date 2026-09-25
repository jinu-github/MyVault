import { STRENGTH_LABELS } from "../../shared/strength.ts";
import type { Strength } from "../../shared/types.ts";
import { cn } from "../lib/utils.ts";

const colors = ["bg-destructive", "bg-warning", "bg-primary", "bg-success"] as const;
const textColors = ["text-destructive", "text-warning", "text-primary", "text-success"] as const;

export function StrengthMeter({ strength }: { strength: Strength }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`Password strength: ${STRENGTH_LABELS[strength]}`}>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 w-5 rounded-full bg-secondary", i <= strength && colors[strength])} />
        ))}
      </div>
      <span className={cn("text-[10px] font-medium", textColors[strength])}>{STRENGTH_LABELS[strength]}</span>
    </div>
  );
}
