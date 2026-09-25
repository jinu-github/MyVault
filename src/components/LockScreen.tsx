import { useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { estimateStrength } from "../../shared/strength.ts";
import { MIN_MASTER_LENGTH } from "../../shared/types.ts";
import { Button } from "./ui/button.tsx";
import { StrengthMeter } from "./StrengthMeter.tsx";

type Props = {
  mode: "setup" | "locked";
  /** Resolves to an error message, or null on success. */
  onSubmit: (masterPassword: string) => Promise<string | null>;
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-surface px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

export function LockScreen({ mode, onSubmit }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setup = mode === "setup";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (setup) {
      if (password.length < MIN_MASTER_LENGTH) return setError(`Use at least ${MIN_MASTER_LENGTH} characters.`);
      if (password !== confirm) return setError("Passwords don't match.");
    }
    setBusy(true);
    const err = await onSubmit(password);
    setBusy(false);
    if (err) {
      setError(err);
      if (!setup) setPassword("");
    }
  }

  return (
    <main className="flex h-full items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-[320px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold">{setup ? "Create your vault" : "MyVault is locked"}</h1>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {setup
              ? "Choose a master password. It encrypts everything on this computer."
              : "Enter your master password to unlock."}
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              autoFocus
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
              autoComplete="off"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {setup && (
            <>
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm master password"
                autoComplete="off"
                className={inputClass}
              />
              {password && <StrengthMeter strength={estimateStrength(password)} />}
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] leading-4 text-warning">
                There is no recovery option. If you forget this password, your vault cannot be opened.
              </p>
            </>
          )}

          {error && (
            <p role="alert" className="text-[12px] text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy || !password} className="h-10 w-full">
            {busy ? "Working…" : setup ? "Create vault" : "Unlock"}
          </Button>
        </div>
      </form>
    </main>
  );
}
