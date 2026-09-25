import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, Moon, Plus, Search, ShieldCheck, Sun } from "lucide-react";
import type { ItemInput, VaultItemMeta } from "../../shared/types.ts";
import { DetailPanel } from "./DetailPanel.tsx";
import { ItemForm } from "./ItemForm.tsx";
import { ItemList } from "./ItemList.tsx";
import { Sidebar, type Filter } from "./Sidebar.tsx";
import { Button } from "./ui/button.tsx";

type Props = {
  isLight: boolean;
  onToggleTheme: () => void;
  onLock: () => void;
};

type Mode = "browse" | "add" | "edit";

export function Vault({ isLight, onToggleTheme, onLock }: Props) {
  const [items, setItems] = useState<VaultItemMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [autoLock, setAutoLock] = useState(5);
  const [filter, setFilter] = useState<Filter>("All Items");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("browse");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  const refresh = useCallback(async () => {
    const res = await window.vault.list();
    if (res.ok) {
      setItems(res.data);
      setLoaded(true);
    } else {
      onLock(); // most likely the vault locked itself
    }
  }, [onLock]);

  useEffect(() => {
    void refresh();
    void window.vault.status().then((s) => setAutoLock(s.autoLockMinutes));
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [refresh]);

  // Tell the main process the user is active so the auto-lock timer restarts.
  useEffect(() => {
    let last = 0;
    const ping = () => {
      const now = Date.now();
      if (now - last > 5000) {
        last = now;
        window.vault.touch();
      }
    };
    window.addEventListener("pointerdown", ping);
    window.addEventListener("keydown", ping);
    return () => {
      window.removeEventListener("pointerdown", ping);
      window.removeEventListener("keydown", ping);
    };
  }, []);

  const lockNow = useCallback(() => {
    void window.vault.lock().then(onLock);
  }, [onLock]);

  // Keyboard: Esc goes back, Ctrl/Cmd+L locks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        lockNow();
      } else if (e.key === "Escape") {
        if (mode !== "browse") setMode("browse");
        else if (selectedId) setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selectedId, lockNow]);

  const counts = useMemo(
    () =>
      ({
        "All Items": items.length,
        Favorites: items.filter((i) => i.favorite).length,
        Passwords: items.filter((i) => i.category === "Passwords").length,
        "Secure Notes": items.filter((i) => i.category === "Secure Notes").length,
        Cards: items.filter((i) => i.category === "Cards").length,
        "Wi-Fi": items.filter((i) => i.category === "Wi-Fi").length,
      }) satisfies Record<Filter, number>,
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => {
        const inFilter = filter === "All Items" ? true : filter === "Favorites" ? i.favorite : i.category === filter;
        const inQuery = !q || i.name.toLowerCase().includes(q) || i.username.toLowerCase().includes(q);
        return inFilter && inQuery;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, filter, query]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  async function save(input: ItemInput): Promise<string | null> {
    const editing = mode === "edit" && selected;
    const res = editing ? await window.vault.update(selected.id, input) : await window.vault.add(input);
    if (!res.ok) return res.error;
    await refresh();
    setSelectedId(res.data.id);
    setMode("browse");
    notify(editing ? "Changes saved" : "Item added");
    return null;
  }

  async function remove() {
    if (!selected) return;
    const res = await window.vault.remove(selected.id);
    if (!res.ok) return notify(res.error);
    await refresh();
    setSelectedId(null);
    notify("Item deleted");
  }

  async function toggleFavorite() {
    if (!selected) return;
    const res = await window.vault.setFavorite(selected.id, !selected.favorite);
    if (!res.ok) return notify(res.error);
    await refresh();
  }

  async function changeAutoLock(minutes: number) {
    const res = await window.vault.setAutoLock(minutes);
    if (res.ok) setAutoLock(minutes);
    else notify(res.error);
  }

  const showList = mode === "browse" && !selected;
  const defaultCategory = filter === "Passwords" || filter === "Secure Notes" || filter === "Cards" || filter === "Wi-Fi" ? filter : "Passwords";

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        active={filter}
        counts={counts}
        autoLockMinutes={autoLock}
        onAutoLockChange={changeAutoLock}
        onSelect={(next) => {
          setFilter(next);
          setSelectedId(null);
          setMode("browse");
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <label className="relative flex h-9 min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (mode === "browse") setSelectedId(null);
              }}
              placeholder="Search vault…"
              className="h-full w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Lock vault"
              title="Lock vault (Ctrl+L)"
              onClick={lockNow}
              className="border border-border bg-surface text-success hover:text-success"
            >
              <Lock className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={isLight ? "Use dark mode" : "Use light mode"}
              title={isLight ? "Dark mode" : "Light mode"}
              onClick={onToggleTheme}
              className="border border-border bg-surface"
            >
              {isLight ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            </Button>
            <Button
              size="icon"
              aria-label="New item"
              title="New item"
              onClick={() => {
                setSelectedId(null);
                setMode("add");
              }}
              className="size-9 shadow-glow"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {mode !== "browse" ? (
            <ItemForm
              key={mode === "edit" ? selected?.id : "new"}
              {...(mode === "edit" && selected ? { initial: selected } : {})}
              defaultCategory={defaultCategory}
              onSave={save}
              onCancel={() => setMode("browse")}
            />
          ) : selected ? (
            <DetailPanel
              item={selected}
              onBack={() => setSelectedId(null)}
              onEdit={() => setMode("edit")}
              onDelete={remove}
              onToggleFavorite={toggleFavorite}
              notify={notify}
            />
          ) : (
            <section className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Vault</p>
                  <h1 className="mt-0.5 text-[15px] font-semibold">{filter}</h1>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {visible.length} {visible.length === 1 ? "item" : "items"}
                </span>
              </div>
              {loaded && <ItemList items={visible} isEmptyVault={items.length === 0} onSelect={setSelectedId} />}
            </section>
          )}
        </div>

        <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border px-4 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5" role="status">
            <span className="size-1.5 rounded-full bg-success" />
            {notice ?? "Vault unlocked"}
          </span>
          <ShieldCheck className="size-3.5" aria-hidden="true" />
        </footer>
      </div>
    </div>
  );
}
