# Operations guide

## Supported environment

- Windows 10/11 x64
- Node.js 24 for development
- Electron 43
- FANUC FOCAS Ethernet on TCP 8193 (site configuration may differ)
- Local telemetry ports 5000, 7880, 7881 and diagnostic API port 8090

Keep CNC traffic on a dedicated, firewalled VLAN. Do not expose adapter ports
to the internet or an untrusted office network.

## Development without a CNC

Run `npm run mock-adapter`, then start the application. The dashboard displays
an amber **SİMÜLASYON** badge. Mock data must never be presented as live CNC
data. The mock API implements read-only endpoints only.

## Data and logs

Application data is stored under `%USERPROFILE%/.fanuc-pro-suite`:

- `fanuc-pro-suite.db`: SQLite primary data store (WAL mode)
- `data/*.json`: writable compatibility mirrors and user records
- `logs/*.jsonl`: rotating structured logs
- `audit/security.jsonl`: authentication and privileged-operation audit
- `backups/`: recovery snapshots
- `secrets.json`: DPAPI-encrypted AI API key

The first launch contains no distributed accounts. The operator must create a
local administrator with a six-digit PIN before protected data is loaded.
Settings can export a redacted diagnostic JSON package and matching SHA-256
sidecar; API keys, PIN material, tokens and user paths are excluded.

The checked-in `data/*.json` files are compatibility mirrors. Back up both the
SQLite database (including `-wal`/`-shm` while running) and the backups folder.

## Recovery

1. Stop the application and adapter.
2. Copy the complete `.fanuc-pro-suite` directory to protected storage.
3. Restore through the admin-only application workflow.
4. Verify the data-store status and adapter integrity before reconnecting CNCs.
5. Test on the simulator or an isolated test machine first.

## Release requirements

Release integrity is based on reviewed SHA-256 manifests. Update
`bin/adapter.integrity.json` only from a reviewed build and publish
SHA-256 checksums for the installer, application executable and adapter files.
Distribute releases through a controlled internal location and verify hashes on
the target workstation before installation.

Before publishing, run `npm ci`, `npm test`, `npm run check`,
`npm audit --omit=dev` and `npm run build:dir`. Generate and archive SHA-256
checksums for the application executable, installer and adapter. Validate the
final build on an isolated simulator before any CNC VLAN deployment, followed
by a documented long-duration telemetry soak.

Run `npm run release:checksums` after packaging to create
`dist/SHA256SUMS.txt`. Run `npm run test:e2e` on a Windows runner with a working
Electron graphics/runtime environment. Telemetry entering the main process is
schema-validated, bounded and rate-limited before SQLite persistence.
