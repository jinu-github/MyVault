import type { ReactNode } from "react";
import { CreditCard, FileLock2, KeyRound, LayoutGrid, ShieldCheck, Star, Wifi } from "lucide-react";
import { AUTO_LOCK_OPTIONS } from "../../shared/types.ts";
import { cn } from "../lib/utils.ts";
import { Button } from "./ui/button.tsx";

export type Filter = "All Items" | "Favorites" | "Passwords" | "Secure Notes" | "Cards" | "Wi-Fi";

const nav: { label: Filter; icon: ReactNode }[] = [
  { label: "All Items", icon: <LayoutGrid className="size-4" /> },
  { label: "Favorites", icon: <Star className="size-4" /> },
  { label: "Passwords", icon: <KeyRound className="size-4" /> },
  { label: "Secure Notes", icon: <FileLock2 className="size-4" /> },
  { label: "Cards", icon: <CreditCard className="size-4" /> },
  { label: "Wi-Fi", icon: <Wifi className="size-4" /> },
];

type Props = {
  active: Filter;
  counts: Record<Filter, number>;
  onSelect: (filter: Filter) => void;
  autoLockMinutes: number;
  onAutoLockChange: (minutes: number) => void;
};

export function Sidebar({ active, counts, onSelect, autoLockMinutes, onAutoLockChange }: Props) {
  return (
    <aside className="flex w-[154px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-glow">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </div>
        <span className="text-[14px] font-bold text-sidebar-foreground">MyVault</span>
      </div>

      <nav className="mt-2 flex flex-col gap-1 px-2.5">
        <p className="px-2 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Vault</p>
        {nav.map(({ label, icon }) => {
          const isActive = label === active;
          return (
            <Button
              key={label}
              variant="ghost"
              onClick={() => onSelect(label)}
              className={cn(
                "group h-8 w-full justify-start gap-2 px-2 text-[11px]",
                isActive
                  ? "bg-sidebar-accent text-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <span className={isActive ? "text-primary" : ""}>{icon}</span>
              <span className="flex-1 text-left">{label}</span>
              <span className="ml-auto text-[10px] tabular-nums">{counts[label]}</span>
            </Button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border p-3">
        <div className="rounded-lg bg-surface-raised/60 p-2.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Stored locally
          </div>
          <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
            Encrypted at rest
            <br />
            AES-256-GCM
          </p>
          <label className="mt-2 flex items-center justify-between gap-1 text-[9px] text-muted-foreground">
            Auto-lock
            <select
              value={autoLockMinutes}
              onChange={(e) => onAutoLockChange(Number(e.target.value))}
              className="rounded border border-input bg-surface px-1 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {AUTO_LOCK_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </aside>
  );
}
