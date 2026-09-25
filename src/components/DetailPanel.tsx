import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Eye, EyeOff, Pencil, Star, Trash2 } from "lucide-react";
import type { SecretField, VaultItemMeta } from "../../shared/types.ts";
import { FIELD_LABELS, timeAgo, toSafeUrl } from "../lib/utils.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { StrengthMeter } from "./StrengthMeter.tsx";
import { Button } from "./ui/button.tsx";

const REVEAL_MS = 15_000;

type Props = {
  item: VaultItemMeta;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  notify: (message: string) => void;
};

function Row({ label, value, mono, children }: { label: string; value: string; mono?: boolean; children?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-0.5 truncate text-[12px] text-foreground ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      </div>
      {children}
    </div>
  );
}

function CopyButton({ label, onCopy }: { label: string; onCopy: () => Promise<boolean> }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Copy ${label}`}
      onClick={async () => setCopied(await onCopy())}
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </Button>
  );
}

export function DetailPanel({ item, onBack, onEdit, onDelete, onToggleFavorite, notify }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const labels = FIELD_LABELS[item.category];

  // Drop any revealed secret when the item changes or is edited.
  useEffect(() => {
    setRevealed(null);
    setConfirmDelete(false);
  }, [item.id, item.updatedAt]);

  // Re-hide automatically.
  useEffect(() => {
    if (revealed === null) return;
    const t = setTimeout(() => setRevealed(null), REVEAL_MS);
    return () => clearTimeout(t);
  }, [revealed]);

  async function toggleReveal() {
    if (revealed !== null) return setRevealed(null);
    const res = await window.vault.reveal(item.id);
    if (res.ok) setRevealed(res.data);
    else notify(res.error);
  }

  async function copy(field: SecretField, label: string): Promise<boolean> {
    const res = await window.vault.copy(item.id, field);
    notify(res.ok ? `${label} copied · clears in 30s` : res.error);
    return res.ok;
  }

  const masked = item.passwordLength ? "•".repeat(Math.min(item.passwordLength, 16)) : "";
  const link = toSafeUrl(item.website);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
      <div className="flex items-center gap-3 py-4">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to list">
          <ArrowLeft className="size-4" />
        </Button>
        <ItemIcon name={item.name} category={item.category} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-foreground">{item.name}</h2>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {item.category} · Updated {timeAgo(item.updatedAt)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFavorite}
          aria-label={item.favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className={item.favorite ? "size-4 fill-warning text-warning" : "size-4"} />
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-surface/70 shadow-panel">
        <Row label={labels.username} value={item.username}>
          {item.username && <CopyButton label={labels.username} onCopy={() => copy("username", labels.username)} />}
        </Row>
        <Row label={labels.password} value={revealed ?? masked} mono>
          {item.passwordLength > 0 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={revealed !== null ? "Hide password" : "Reveal password"}
                onClick={toggleReveal}
              >
                {revealed !== null ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <CopyButton label={labels.password} onCopy={() => copy("password", labels.password)} />
            </>
          )}
        </Row>
        {labels.hasWebsite && (
          <Row label="Website" value={item.website}>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                aria-label="Open website"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
          </Row>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface/70 p-3 shadow-panel">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
        <p className="mt-1.5 select-text whitespace-pre-wrap break-words text-[12px] leading-5 text-foreground/90">
          {item.notes || <span className="text-muted-foreground">No notes</span>}
        </p>
      </div>

      {(item.category === "Passwords" || item.category === "Wi-Fi") && item.passwordLength > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface/70 px-3 py-2.5 text-[10px] text-muted-foreground">
          <span>Password strength</span>
          <StrengthMeter strength={item.strength} />
        </div>
      )}

      <div className="mt-4 flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            Delete permanently?
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="hover:text-destructive">
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
