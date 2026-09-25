import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  powerMonitor,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { VaultError, VaultStore } from "./vault-store.ts";
import type { ItemInput, Result, SecretField, VaultStatus } from "../shared/types.ts";

const DEV_URL = process.env["ELECTRON_DEV_URL"];
const INDEX_HTML = path.join(app.getAppPath(), "dist", "index.html");
const ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "icon.ico")
  : path.join(app.getAppPath(), "build", "icon.ico");
const CLIPBOARD_CLEAR_MS = 30_000;

app.setName("MyVault");
app.setAppUserModelId("com.myvault.app");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let win: BrowserWindow | null = null;
let store: VaultStore;
let lockTimer: NodeJS.Timeout | null = null;
let clipTimer: NodeJS.Timeout | null = null;
let lastCopied: string | null = null;

// ---- auto-lock -----------------------------------------------------------

function armAutoLock(): void {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = null;
  if (!store.isUnlocked()) return;
  lockTimer = setTimeout(lockVault, store.autoLockMinutes * 60_000);
}

function lockVault(): void {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = null;
  const wasUnlocked = store.isUnlocked();
  store.lock();
  void clearClipboardIfOurs();
  if (wasUnlocked) win?.webContents.send("vault:locked");
}

// ---- clipboard -----------------------------------------------------------

async function copyTemporarily(text: string): Promise<void> {
  await clipboard.writeText(text);
  lastCopied = text;
  if (clipTimer) clearTimeout(clipTimer);
  clipTimer = setTimeout(() => void clearClipboardIfOurs(), CLIPBOARD_CLEAR_MS);
}

async function clearClipboardIfOurs(): Promise<void> {
  if (clipTimer) clearTimeout(clipTimer);
  clipTimer = null;
  const ours = lastCopied;
  lastCopied = null;
  if (ours !== null && (await clipboard.readText()) === ours) clipboard.clear();
}

// ---- IPC -----------------------------------------------------------------

function isTrusted(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  const url = event.senderFrame?.url ?? "";
  return DEV_URL ? url.startsWith(DEV_URL) : url.startsWith(pathToFileURL(INDEX_HTML).toString());
}

function fail(error: string): Result<never> {
  return { ok: false, error };
}

function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>): void {
  ipcMain.handle(channel, async (event, ...args): Promise<Result<R>> => {
    if (!isTrusted(event)) return fail("Request rejected.");
    try {
      const data = await fn(...(args as A));
      if (store.isUnlocked()) armAutoLock(); // any successful activity restarts the timer
      return { ok: true, data };
    } catch (err) {
      if (err instanceof VaultError) return fail(err.message);
      console.error(`[${channel}]`, err);
      return fail("Something went wrong.");
    }
  });
}

function registerIpc(): void {
  ipcMain.handle("vault:status", (event): VaultStatus => {
    if (!isTrusted(event)) return { exists: false, unlocked: false, autoLockMinutes: 5 };
    return { exists: store.exists(), unlocked: store.isUnlocked(), autoLockMinutes: store.autoLockMinutes };
  });
  ipcMain.handle("vault:lock", (event) => {
    if (isTrusted(event)) lockVault();
  });
  ipcMain.on("vault:touch", (event) => {
    if (isTrusted(event) && store.isUnlocked()) armAutoLock();
  });

  handle("vault:create", (pw: string) => store.create(pw));
  handle("vault:unlock", (pw: string) => store.unlock(pw));
  handle("vault:list", () => store.list());
  handle("vault:reveal", (id: string) => store.reveal(id));
  handle("vault:copy", async (id: string, field: SecretField) => {
    if (field !== "username" && field !== "password") throw new VaultError("Unknown field.");
    await copyTemporarily(store.secret(id, field));
  });
  handle("vault:add", (input: ItemInput) => store.add(input));
  handle("vault:update", (id: string, input: ItemInput) => store.update(id, input));
  handle("vault:remove", (id: string) => store.remove(id));
  handle("vault:setFavorite", (id: string, fav: boolean) => store.setFavorite(id, fav));
  handle("vault:setAutoLock", (minutes: number) => store.setAutoLock(minutes));
}

// ---- window --------------------------------------------------------------

function createWindow(): void {
  win = new BrowserWindow({
    width: 600,
    height: 700,
    minWidth: 520,
    minHeight: 560,
    show: false,
    title: "MyVault",
    icon: ICON_PATH,
    backgroundColor: "#0e1116",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => {
    win = null;
  });

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(INDEX_HTML);
}

app.on("web-contents-created", (_e, contents) => {
  contents.on("will-navigate", (e) => e.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const { protocol } = new URL(url);
      if (protocol === "https:" || protocol === "http:") void shell.openExternal(url);
    } catch {
      /* ignore malformed URLs */
    }
    return { action: "deny" };
  });
});

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  if (!gotLock) return;
  store = new VaultStore(path.join(app.getPath("userData"), "vault.myvault"));

  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  registerIpc();
  powerMonitor.on("lock-screen", lockVault);
  powerMonitor.on("suspend", lockVault);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  lockVault();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
