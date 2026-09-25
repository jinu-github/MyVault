# MyVault

A local-first, encrypted password vault for the desktop. Built with Electron, React, TypeScript and Tailwind.
Passwords, secure notes, cards and Wi-Fi credentials live in a single encrypted file on your computer.
Nothing is sent over the network.

## Run it

Requires Node.js 22.18 or newer.

```bash
npm install
npm run dev      # Vite + Electron with hot reload
npm start        # build and run the production bundle
npm test         # unit tests for the encryption and storage layer
npm run dist     # installers (.exe / .dmg / .AppImage) in ./release
```

## How it's put together

```
electron/
  crypto.ts       scrypt key derivation + AES-256-GCM seal/open
  vault-store.ts  the vault: load, unlock, lock, CRUD, atomic save (no Electron imports, unit-tested)
  main.ts         window, IPC handlers, auto-lock timer, clipboard clearing
  preload.ts      the only bridge the UI gets (window.vault)
shared/           types + strength estimator used by both sides
src/              React UI (lock screen, sidebar, list, detail panel, item form)
test/             node:test suite for the store
```

**The UI never sees the key or the vault file.** Decryption happens in the main process. The renderer only receives
item metadata; a password is sent to the UI only when you press "reveal" (and is dropped again after 15 s or when you
leave the item). "Copy" goes straight from the main process to the clipboard.

## Security model

- **Key derivation:** scrypt (N=2^17, r=8, p=1) from the master password, with a random 16-byte salt.
- **Encryption:** AES-256-GCM over the whole vault, fresh 12-byte IV on every save. The header (KDF parameters) is
  authenticated, so tampering with the file or its parameters makes unlocking fail.
- **No stored password hash:** a correct master password is one that successfully decrypts the file.
- **Auto-lock:** after 1/5/15/30 minutes of inactivity (default 5), and on screen lock or system sleep.
- **Clipboard:** copied values are cleared after 30 s (only if the clipboard still holds them) and on lock.
- **Attempt throttling:** 3 wrong attempts in a row start a growing delay (max 30 s).
- **Electron hardening:** `contextIsolation`, `sandbox`, no Node in the renderer, strict Content-Security-Policy in
  production builds, navigation blocked, only http(s) links are opened externally, IPC calls are checked against the
  app's own origin, DevTools are off in packaged builds.

Vault location: Electron's per-user data folder, file `vault.myvault`
(Windows `%APPDATA%\MyVault`, macOS `~/Library/Application Support/MyVault`, Linux `~/.config/MyVault`).
To back up your vault, copy that file.

## Known limitations

- **There is no master-password recovery.** Forget it and the data is gone.
- JavaScript can't reliably wipe strings from memory; on lock the key buffer is zeroed and all references are
  dropped, but decrypted text may linger until garbage collection.
- The strength meter is a rough entropy estimate. It doesn't know about dictionary words or breached passwords.
- Not audited. Treat it as a well-built personal project, not a replacement for a vetted password manager.

## Ideas for next steps

Change master password · import/export (encrypted) · password history · TOTP codes · browser autofill · optional
end-to-end-encrypted sync · OS keychain / biometric unlock (`safeStorage`).
