import type { Category } from "../../shared/types.ts";
import { cn } from "../lib/utils.ts";

const tones: Record<Category, string> = {
  Passwords: "bg-primary/15 text-primary ring-primary/30",
  "Secure Notes": "bg-note/15 text-note ring-note/30",
  Cards: "bg-warning/15 text-warning ring-warning/30",
  "Wi-Fi": "bg-success/15 text-success ring-success/30",
};

export function ItemIcon({ name, category, size = "md" }: { name: string; category: Category; size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-bold ring-1 ring-inset",
        size === "lg" ? "size-11 text-lg" : "size-9 text-sm",
        tones[category],
      )}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}
