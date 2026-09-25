import type { Strength } from "./types.ts";

export const STRENGTH_LABELS = ["Weak", "Fair", "Good", "Strong"] as const;

/**
 * Rough entropy-based estimate. It does not know about dictionary words or
 * leaked passwords, so treat it as a hint, not a guarantee.
 */
export function estimateStrength(password: string): Strength {
  if (!password) return 0;
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 33;
  const unique = new Set(password).size;
  const effectiveLength = Math.min(password.length, unique * 2);
  const bits = effectiveLength * Math.log2(pool || 1);
  if (bits < 36) return 0;
  if (bits < 60) return 1;
  if (bits < 80) return 2;
  return 3;
}
