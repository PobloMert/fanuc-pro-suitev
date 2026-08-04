# Architecture

```text
Renderer (untrusted UI)
  └─ preload allowlisted API
       └─ Electron main process
            ├─ authentication / roles / DPAPI secrets
            ├─ SQLite store + JSON compatibility mirror
            ├─ structured logs and audit trail
            ├─ allowlisted AI network client
            └─ verified FANUC adapter child process
                 └─ isolated CNC network
```

The renderer is not a trust boundary. Privileged decisions are made in the main
process. CNC mutation endpoints are intentionally absent until the adapter has
server-side authentication, authorization, replay protection and durable audit.

`src/renderer.js` remains the legacy feature host. New infrastructure belongs in
`lib/` (main-process services), `src/js/` (renderer modules), and `scripts/`.
Feature migrations should move one page at a time and preserve the shared
`window.State` object until the legacy host is retired.

All mutable state lives under `%USERPROFILE%/.fanuc-pro-suite`. Files bundled
under `app.asar/data` are immutable first-run seeds only. On first launch they
are copied to the writable `data/` directory before SQLite migration. Runtime
code must never write beneath `__dirname` in a packaged application.

The renderer loads protected application data only after the main process has
created an authenticated session. Privileged IPC requires the primary window,
an unexpired session, the relevant role/permission, bounded input and an
allowlisted filesystem or network target.
