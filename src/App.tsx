import { useCallback, useEffect, useState } from "react";
import { LockScreen } from "./components/LockScreen.tsx";
import { Vault } from "./components/Vault.tsx";

type Phase = "loading" | "setup" | "locked" | "unlocked";

function readTheme(): boolean {
  try {
    return localStorage.getItem("theme") === "light";
  } catch {
    return false;
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [isLight, setIsLight] = useState(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("light", isLight);
    try {
      localStorage.setItem("theme", isLight ? "light" : "dark");
    } catch {
      /* storage unavailable: theme just won't persist */
    }
  }, [isLight]);

  useEffect(() => {
    void window.vault.status().then((s) => setPhase(!s.exists ? "setup" : s.unlocked ? "unlocked" : "locked"));
    // Main process locks itself on timeout / screen lock / sleep.
    return window.vault.onLocked(() => setPhase("locked"));
  }, []);

  const handleLocked = useCallback(() => setPhase("locked"), []);

  async function submit(masterPassword: string): Promise<string | null> {
    const res = phase === "setup" ? await window.vault.create(masterPassword) : await window.vault.unlock(masterPassword);
    if (!res.ok) return res.error;
    setPhase("unlocked");
    return null;
  }

  if (phase === "loading") return null;
  if (phase === "unlocked") {
    // Unmounting <Vault> on lock discards every decrypted value held in React state.
    return <Vault isLight={isLight} onToggleTheme={() => setIsLight((v) => !v)} onLock={handleLocked} />;
  }
  return <LockScreen key={phase} mode={phase} onSubmit={submit} />;
}
