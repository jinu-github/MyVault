import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Category } from "../../shared/types.ts";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Only http(s) links are ever opened; bare domains get https://. */
export function toSafeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(timestamp: number): string {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** Field labels differ per category (a card's "username" is its number, etc.). */
export const FIELD_LABELS: Record<Category, { username: string; password: string; hasWebsite: boolean }> = {
  Passwords: { username: "Username", password: "Password", hasWebsite: true },
  "Secure Notes": { username: "Subtitle", password: "Secret", hasWebsite: false },
  Cards: { username: "Card number", password: "CVV / PIN", hasWebsite: false },
  "Wi-Fi": { username: "Network name (SSID)", password: "Password", hasWebsite: false },
};

const CHARSETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digits: "23456789",
  symbols: "!@#$%^&*-_=+?",
};

/** Cryptographically random password with at least one character from each class. */
export function generatePassword(length = 20): string {
  const all = Object.values(CHARSETS).join("");
  const pick = (set: string) => set[randomBelow(set.length)]!;
  const chars = [
    pick(CHARSETS.lower),
    pick(CHARSETS.upper),
    pick(CHARSETS.digits),
    pick(CHARSETS.symbols),
  ];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

function randomBelow(max: number): number {
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % max;
}
