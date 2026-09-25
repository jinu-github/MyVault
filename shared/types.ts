// Types shared by the Electron main process and the React renderer.
// Keep this file free of enums / parameter properties so Node can run it directly (tests).

export const CATEGORIES = ["Passwords", "Secure Notes", "Cards", "Wi-Fi"] as const;
export type Category = (typeof CATEGORIES)[number];

export const AUTO_LOCK_OPTIONS = [1, 5, 15, 30] as const;
export const MIN_MASTER_LENGTH = 10;

export type Strength = 0 | 1 | 2 | 3;

export interface VaultItem {
  id: string;
  name: string;
  username: string;
  password: string;
  website: string;
  notes: string;
  category: Category;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

/** What the renderer sees in lists: everything except the secret itself. */
export type VaultItemMeta = Omit<VaultItem, "password"> & {
  passwordLength: number;
  strength: Strength;
};

/** What the renderer sends when creating or editing an item. */
export type ItemInput = Omit<VaultItem, "id" | "createdAt" | "updatedAt">;

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  autoLockMinutes: number;
}

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type SecretField = "username" | "password";

export interface VaultApi {
  status(): Promise<VaultStatus>;
  create(masterPassword: string): Promise<Result>;
  unlock(masterPassword: string): Promise<Result>;
  lock(): Promise<void>;
  list(): Promise<Result<VaultItemMeta[]>>;
  reveal(id: string): Promise<Result<string>>;
  copy(id: string, field: SecretField): Promise<Result>;
  add(input: ItemInput): Promise<Result<VaultItemMeta>>;
  update(id: string, input: ItemInput): Promise<Result<VaultItemMeta>>;
  remove(id: string): Promise<Result>;
  setFavorite(id: string, favorite: boolean): Promise<Result<VaultItemMeta>>;
  setAutoLock(minutes: number): Promise<Result>;
  /** Tell the main process the user is active, so the auto-lock timer restarts. */
  touch(): void;
  /** Called when the vault locks itself (timeout, screen lock, sleep). Returns an unsubscribe fn. */
  onLocked(cb: () => void): () => void;
}
