import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VaultStore } from "../electron/vault-store.ts";
import type { ItemInput } from "../shared/types.ts";

const FAST = { kdf: { N: 1024, r: 8, p: 1 } }; // cheap scrypt, tests only
const MASTER = "correct horse battery staple";

const sample: ItemInput = {
  name: "GitHub",
  username: "octocat",
  password: "s3cr3t-PASSWORD-42!",
  website: "github.com",
  notes: "unique-note-marker",
  category: "Passwords",
  favorite: false,
};

function tempPath() {
  return join(mkdtempSync(join(tmpdir(), "myvault-")), "vault.myvault");
}

test("create -> lock -> unlock round trip keeps items", async () => {
  const path = tempPath();
  const a = new VaultStore(path, FAST);
  await a.create(MASTER);
  const added = a.add(sample);
  a.lock();

  const b = new VaultStore(path, FAST);
  await b.unlock(MASTER);
  const items = b.list();
  assert.equal(items.length, 1);
  assert.equal(items[0]!.id, added.id);
  assert.equal(b.reveal(added.id), sample.password);
});

test("list metadata never contains the password", async () => {
  const s = new VaultStore(tempPath(), FAST);
  await s.create(MASTER);
  s.add(sample);
  const json = JSON.stringify(s.list());
  assert.ok(!json.includes(sample.password));
  assert.ok(!("password" in s.list()[0]!));
});

test("vault file on disk contains no plaintext", async () => {
  const path = tempPath();
  const s = new VaultStore(path, FAST);
  await s.create(MASTER);
  s.add(sample);
  const raw = readFileSync(path, "utf8");
  for (const needle of ["GitHub", "octocat", sample.password, "unique-note-marker"]) {
    assert.ok(!raw.includes(needle), `found "${needle}" in file`);
  }
});

test("wrong master password is rejected", async () => {
  const path = tempPath();
  const a = new VaultStore(path, FAST);
  await a.create(MASTER);
  a.lock();
  const b = new VaultStore(path, FAST);
  await assert.rejects(() => b.unlock("wrong password!!"), /Incorrect master password/);
  assert.equal(b.isUnlocked(), false);
});

test("tampering with the file is detected", async () => {
  const path = tempPath();
  const a = new VaultStore(path, FAST);
  await a.create(MASTER);
  a.add(sample);
  a.lock();

  const file = JSON.parse(readFileSync(path, "utf8"));
  const bytes = Buffer.from(file.data, "base64");
  bytes[0] = bytes[0]! ^ 0xff;
  file.data = bytes.toString("base64");
  writeFileSync(path, JSON.stringify(file));

  const b = new VaultStore(path, FAST);
  await assert.rejects(() => b.unlock(MASTER), /Incorrect master password/);
});

test("changing KDF params in the header is detected (header is authenticated)", async () => {
  const path = tempPath();
  const a = new VaultStore(path, FAST);
  await a.create(MASTER);
  a.lock();
  const file = JSON.parse(readFileSync(path, "utf8"));
  file.kdf.p = 2;
  writeFileSync(path, JSON.stringify(file));
  await assert.rejects(() => new VaultStore(path, FAST).unlock(MASTER), /Incorrect master password/);
});

test("update, favorite and remove persist across unlock", async () => {
  const path = tempPath();
  const a = new VaultStore(path, FAST);
  await a.create(MASTER);
  const { id } = a.add(sample);
  a.update(id, { ...sample, name: "GitHub (work)", password: "new-password-123!" });
  a.setFavorite(id, true);
  const second = a.add({ ...sample, name: "Other" });
  a.remove(second.id);
  a.lock();

  const b = new VaultStore(path, FAST);
  await b.unlock(MASTER);
  const items = b.list();
  assert.equal(items.length, 1);
  assert.equal(items[0]!.name, "GitHub (work)");
  assert.equal(items[0]!.favorite, true);
  assert.equal(b.reveal(id), "new-password-123!");
});

test("locked store refuses access", async () => {
  const s = new VaultStore(tempPath(), FAST);
  await s.create(MASTER);
  const { id } = s.add(sample);
  s.lock();
  assert.throws(() => s.list(), /locked/);
  assert.throws(() => s.reveal(id), /locked/);
  assert.throws(() => s.add(sample), /locked/);
});

test("short master password and empty name are rejected", async () => {
  const s = new VaultStore(tempPath(), FAST);
  await assert.rejects(() => s.create("short"), /at least/);
  await s.create(MASTER);
  assert.throws(() => s.add({ ...sample, name: "   " }), /Name is required/);
});

test("auto-lock setting persists and rejects odd values", async () => {
  const path = tempPath();
  const a = new VaultStore(path, FAST);
  await a.create(MASTER);
  a.setAutoLock(15);
  assert.throws(() => a.setAutoLock(7), /Unsupported/);
  a.lock();
  const b = new VaultStore(path, FAST);
  await b.unlock(MASTER);
  assert.equal(b.autoLockMinutes, 15);
});

test("repeated failures trigger a temporary block", async () => {
  const path = tempPath();
  const a = new VaultStore(path, FAST);
  await a.create(MASTER);
  a.lock();
  const b = new VaultStore(path, FAST);
  for (let i = 0; i < 3; i++) await assert.rejects(() => b.unlock("nope-nope-nope"), /Incorrect/);
  await assert.rejects(() => b.unlock(MASTER), /Too many attempts/);
});
