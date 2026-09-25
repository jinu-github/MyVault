import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";

export interface KdfParams {
  name: "scrypt";
  N: number;
  r: number;
  p: number;
  salt: string; // base64
}

/** On-disk format. Everything except `data` is non-secret; the header is authenticated (AAD). */
export interface VaultFile {
  v: 1;
  kdf: KdfParams;
  iv: string; // base64, 12 bytes, fresh on every save
  tag: string; // base64, GCM auth tag
  data: string; // base64 ciphertext
}

// scrypt: N=2^17, r=8, p=1 (128 MiB) is the OWASP-recommended minimum profile.
export const DEFAULT_KDF = { N: 131072, r: 8, p: 1 };
const KEY_BYTES = 32;

export function newKdf(overrides: Partial<Pick<KdfParams, "N" | "r" | "p">> = {}): KdfParams {
  return { name: "scrypt", ...DEFAULT_KDF, ...overrides, salt: randomBytes(16).toString("base64") };
}

export function isValidKdf(k: unknown): k is KdfParams {
  if (typeof k !== "object" || k === null) return false;
  const { name, N, r, p, salt } = k as Record<string, unknown>;
  return (
    name === "scrypt" &&
    typeof N === "number" && Number.isInteger(N) && N >= 1024 && N <= 1 << 20 && (N & (N - 1)) === 0 &&
    typeof r === "number" && Number.isInteger(r) && r >= 1 && r <= 32 &&
    typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 16 &&
    typeof salt === "string" && salt.length > 0
  );
}

export function deriveKey(password: string, kdf: KdfParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      Buffer.from(password.normalize("NFKC"), "utf8"),
      Buffer.from(kdf.salt, "base64"),
      KEY_BYTES,
      { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 256 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

function aad(kdf: KdfParams): Buffer {
  return Buffer.from(`myvault|1|${kdf.name}|${kdf.N}|${kdf.r}|${kdf.p}|${kdf.salt}`, "utf8");
}

export function seal(key: Buffer, kdf: KdfParams, plaintext: string): VaultFile {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(kdf));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    v: 1,
    kdf,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

/** Throws if the key is wrong or the file was modified. */
export function open(key: Buffer, file: VaultFile): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(file.iv, "base64"));
  decipher.setAAD(aad(file.kdf));
  decipher.setAuthTag(Buffer.from(file.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(file.data, "base64")), decipher.final()]);
  return plain.toString("utf8");
}
