import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { deriveKey, isValidKdf, newKdf, open, seal, type KdfParams, type VaultFile } from "./crypto.ts";
import { estimateStrength } from "../shared/strength.ts";
import {
  AUTO_LOCK_OPTIONS,
  CATEGORIES,
  MIN_MASTER_LENGTH,
  type ItemInput,
  type SecretField,
  type VaultItem,
  type VaultItemMeta,
} from "../shared/types.ts";

/** Errors whose message is safe to show to the user. */
export class VaultError extends Error {}

interface Payload {
  items: VaultItem[];
  settings: { autoLockMinutes: number };
}

interface StoreOptions {
  /** Override scrypt cost (tests only). */
  kdf?: { N?: number; r?: number; p?: number };
}

const LIMITS = { name: 200, username: 500, password: 1000, website: 500, notes: 10_000 } as const;

export class VaultStore {
  #filePath: string;
  #kdfOptions: NonNullable<StoreOptions["kdf"]>;
  #key: Buffer | null = null;
  #kdf: KdfParams | null = null;
  #items: VaultItem[] = [];
  #autoLockMinutes = 5;
  #failures = 0;
  #blockedUntil = 0;

  constructor(filePath: string, options: StoreOptions = {}) {
    this.#filePath = filePath;
    this.#kdfOptions = options.kdf ?? {};
  }

  // ---- state -------------------------------------------------------------

  exists(): boolean {
    return existsSync(this.#filePath);
  }

  isUnlocked(): boolean {
    return this.#key !== null;
  }

  get autoLockMinutes(): number {
    return this.#autoLockMinutes;
  }

  // ---- lifecycle ---------------------------------------------------------

  async create(masterPassword: string): Promise<void> {
    if (this.exists()) throw new VaultError("A vault already exists on this computer.");
    if (typeof masterPassword !== "string" || masterPassword.length < MIN_MASTER_LENGTH) {
      throw new VaultError(`Master password must be at least ${MIN_MASTER_LENGTH} characters.`);
    }
    const kdf = newKdf(this.#kdfOptions);
    const key = await deriveKey(masterPassword, kdf);
    this.#key = key;
    this.#kdf = kdf;
    this.#items = [];
    this.#autoLockMinutes = 5;
    this.#persist();
  }

  async unlock(masterPassword: string): Promise<void> {
    if (typeof masterPassword !== "string" || masterPassword.length === 0) {
      throw new VaultError("Enter your master password.");
    }
    const wait = this.#blockedUntil - Date.now();
    if (wait > 0) {
      throw new VaultError(`Too many attempts. Try again in ${Math.ceil(wait / 1000)}s.`);
    }

    const file = this.#readFile();
    const key = await deriveKey(masterPassword, file.kdf);

    let plaintext: string;
    try {
      plaintext = open(key, file);
    } catch {
      key.fill(0);
      this.#failures += 1;
      if (this.#failures >= 3) {
        this.#blockedUntil = Date.now() + Math.min(2 ** (this.#failures - 3) * 1000, 30_000);
      }
      throw new VaultError("Incorrect master password.");
    }

    const payload = this.#parsePayload(plaintext);
    this.#failures = 0;
    this.#blockedUntil = 0;
    this.#key = key;
    this.#kdf = file.kdf;
    this.#items = payload.items;
    this.#autoLockMinutes = payload.settings.autoLockMinutes;
  }

  lock(): void {
    this.#key?.fill(0);
    this.#key = null;
    this.#kdf = null;
    this.#items = [];
  }

  // ---- items -------------------------------------------------------------

  list(): VaultItemMeta[] {
    this.#requireUnlocked();
    return this.#items.map(toMeta);
  }

  reveal(id: string): string {
    return this.#find(id).password;
  }

  secret(id: string, field: SecretField): string {
    const item = this.#find(id);
    return field === "username" ? item.username : item.password;
  }

  add(input: ItemInput): VaultItemMeta {
    this.#requireUnlocked();
    const now = Date.now();
    const item: VaultItem = { ...cleanInput(input), id: randomUUID(), createdAt: now, updatedAt: now };
    this.#items.push(item);
    this.#persist();
    return toMeta(item);
  }

  update(id: string, input: ItemInput): VaultItemMeta {
    const existing = this.#find(id);
    Object.assign(existing, cleanInput(input), { updatedAt: Date.now() });
    this.#persist();
    return toMeta(existing);
  }

  remove(id: string): void {
    const item = this.#find(id);
    this.#items = this.#items.filter((i) => i !== item);
    this.#persist();
  }

  setFavorite(id: string, favorite: boolean): VaultItemMeta {
    const item = this.#find(id);
    item.favorite = Boolean(favorite);
    this.#persist();
    return toMeta(item);
  }

  setAutoLock(minutes: number): void {
    this.#requireUnlocked();
    if (!(AUTO_LOCK_OPTIONS as readonly number[]).includes(minutes)) {
      throw new VaultError("Unsupported auto-lock value.");
    }
    this.#autoLockMinutes = minutes;
    this.#persist();
  }

  // ---- internals ---------------------------------------------------------

  #requireUnlocked(): void {
    if (!this.#key || !this.#kdf) throw new VaultError("The vault is locked.");
  }

  #find(id: string): VaultItem {
    this.#requireUnlocked();
    const item = this.#items.find((i) => i.id === id);
    if (!item) throw new VaultError("Item not found.");
    return item;
  }

  #persist(): void {
    this.#requireUnlocked();
    const payload: Payload = { items: this.#items, settings: { autoLockMinutes: this.#autoLockMinutes } };
    const file = seal(this.#key!, this.#kdf!, JSON.stringify(payload));
    mkdirSync(dirname(this.#filePath), { recursive: true });
    const tmp = `${this.#filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(file), { mode: 0o600 });
    renameSync(tmp, this.#filePath); // atomic replace: a crash never leaves a half-written vault
  }

  #readFile(): VaultFile {
    if (!this.exists()) throw new VaultError("No vault found.");
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(this.#filePath, "utf8"));
    } catch {
      throw new VaultError("The vault file is unreadable.");
    }
    const f = raw as Partial<VaultFile> | null;
    if (
      !f || f.v !== 1 || !isValidKdf(f.kdf) ||
      typeof f.iv !== "string" || typeof f.tag !== "string" || typeof f.data !== "string"
    ) {
      throw new VaultError("The vault file is unreadable or from a newer version.");
    }
    return f as VaultFile;
  }

  #parsePayload(plaintext: string): Payload {
    try {
      const p = JSON.parse(plaintext) as Payload;
      if (!Array.isArray(p.items)) throw new Error("bad items");
      const minutes = p.settings?.autoLockMinutes;
      const valid = (AUTO_LOCK_OPTIONS as readonly number[]).includes(minutes);
      return { items: p.items, settings: { autoLockMinutes: valid ? minutes : 5 } };
    } catch {
      throw new VaultError("The vault contents are corrupted.");
    }
  }
}

function toMeta(item: VaultItem): VaultItemMeta {
  const { password, ...rest } = item;
  return { ...rest, passwordLength: password.length, strength: estimateStrength(password) };
}

function cleanInput(input: ItemInput): ItemInput {
  const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
  const name = str(input?.name, LIMITS.name).trim();
  if (!name) throw new VaultError("Name is required.");
  const category = (CATEGORIES as readonly string[]).includes(input.category) ? input.category : "Passwords";
  return {
    name,
    username: str(input.username, LIMITS.username).trim(),
    password: str(input.password, LIMITS.password),
    website: str(input.website, LIMITS.website).trim(),
    notes: str(input.notes, LIMITS.notes),
    category,
    favorite: Boolean(input.favorite),
  };
}
