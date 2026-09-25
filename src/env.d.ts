/// <reference types="vite/client" />
import type { VaultApi } from "../shared/types.ts";

declare global {
  interface Window {
    vault: VaultApi;
  }
}
