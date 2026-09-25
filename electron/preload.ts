import { contextBridge, ipcRenderer } from "electron";
import type { VaultApi } from "../shared/types.ts";

// The renderer gets exactly these functions and nothing else: no Node, no fs, no raw ipcRenderer.
const api: VaultApi = {
  status: () => ipcRenderer.invoke("vault:status"),
  create: (pw) => ipcRenderer.invoke("vault:create", pw),
  unlock: (pw) => ipcRenderer.invoke("vault:unlock", pw),
  lock: () => ipcRenderer.invoke("vault:lock"),
  list: () => ipcRenderer.invoke("vault:list"),
  reveal: (id) => ipcRenderer.invoke("vault:reveal", id),
  copy: (id, field) => ipcRenderer.invoke("vault:copy", id, field),
  add: (input) => ipcRenderer.invoke("vault:add", input),
  update: (id, input) => ipcRenderer.invoke("vault:update", id, input),
  remove: (id) => ipcRenderer.invoke("vault:remove", id),
  setFavorite: (id, fav) => ipcRenderer.invoke("vault:setFavorite", id, fav),
  setAutoLock: (minutes) => ipcRenderer.invoke("vault:setAutoLock", minutes),
  touch: () => ipcRenderer.send("vault:touch"),
  onLocked: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("vault:locked", handler);
    return () => ipcRenderer.removeListener("vault:locked", handler);
  },
};

contextBridge.exposeInMainWorld("vault", api);
