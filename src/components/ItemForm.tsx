import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Eye, EyeOff, RefreshCw } from "lucide-react";
import { estimateStrength } from "../../shared/strength.ts";
import { CATEGORIES, type Category, type ItemInput, type VaultItemMeta } from "../../shared/types.ts";
import { FIELD_LABELS, cn, generatePassword } from "../lib/utils.ts";
import { StrengthMeter } from "./StrengthMeter.tsx";
import { Button } from "./ui/button.tsx";

type Props = {
  /** Present when editing, absent when adding. */
  initial?: VaultItemMeta;
  defaultCategory: Category;
  /** Resolves to an error message, or null on success. */
  onSave: (input: ItemInput) => Promise<string | null>;
  onCancel: () => void;
};

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-surface px-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ItemForm({ initial, defaultCategory, onSave, onCancel }: Props) {
  const [category, setCategory] = useState<Category>(initial?.category ?? defaultCategory);
  const [name, setName] = useState(initial?.name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(Boolean(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labels = FIELD_LABELS[category];

  // When editing, fetch the current password from the main process.
  useEffect(() => {
    if (!initial) return;
    let live = true;
    window.vault.reveal(initial.id).then((res) => {
      if (!live) return;
      if (res.ok) setPassword(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [initial?.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    setSaving(true);
    setError(null);
    const err = await onSave({ name, username, password, website, notes, category, favorite });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
      <div className="flex items-center gap-2 py-4">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-base font-semibold">{initial ? "Edit item" : "New item"}</h2>
      </div>

      <div className="space-y-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="radiogroup" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === category}
              onClick={() => setCategory(c)}
              className={cn(
                "flex-1 rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors",
                c === category ? "bg-accent-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GitHub" className={inputClass} />
        </Field>

        <Field label={labels.username}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className={inputClass} />
        </Field>

        <Field label={labels.password}>
          <div className="flex gap-1.5">
            <input
              type={showPassword ? "text" : "password"}
              value={loading ? "" : password}
              disabled={loading}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              className={cn(inputClass, "font-mono")}
            />
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Generate password"
              title="Generate a strong password"
              onClick={() => {
                setPassword(generatePassword(20));
                setShowPassword(true);
              }}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
          {(category === "Passwords" || category === "Wi-Fi") && password && (
            <div className="mt-2">
              <StrengthMeter strength={estimateStrength(password)} />
            </div>
          )}
        </Field>

        {labels.hasWebsite && (
          <Field label="Website">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" className={inputClass} />
          </Field>
        )}

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={cn(inputClass, "h-auto resize-none py-2 leading-5")}
          />
        </Field>

        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="size-3.5 accent-[var(--primary)]" />
          Add to favorites
        </label>

        {error && (
          <p role="alert" className="text-[12px] text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || loading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
