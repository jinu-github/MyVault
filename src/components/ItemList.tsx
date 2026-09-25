import { Star } from "lucide-react";
import type { VaultItemMeta } from "../../shared/types.ts";
import { cn } from "../lib/utils.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { Button } from "./ui/button.tsx";

type Props = {
  items: VaultItemMeta[];
  isEmptyVault: boolean;
  onSelect: (id: string) => void;
};

export function ItemList({ items, isEmptyVault, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-center text-[13px] leading-5 text-muted-foreground">
        {isEmptyVault ? "Your vault is empty. Click + to add your first item." : "No items match."}
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5 overflow-y-auto px-4 pb-4">
      {items.map((item) => (
        <li key={item.id}>
          <Button
            variant="ghost"
            onClick={() => onSelect(item.id)}
            className={cn(
              "h-auto w-full justify-start gap-3 border border-border/70 bg-surface/40 px-3 py-2.5 text-left",
              "hover:border-input hover:bg-surface-raised",
            )}
          >
            <ItemIcon name={item.name} category={item.category} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[12px] font-semibold text-foreground">{item.name}</span>
                {item.favorite && <Star className="size-3 fill-warning text-warning" />}
              </div>
              <p className="mt-0.5 truncate text-[10px] font-normal text-muted-foreground">{item.username || "—"}</p>
            </div>
            <span className="max-w-20 truncate rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              {item.category}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
