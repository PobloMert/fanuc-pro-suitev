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
- `logs/*.jsonl`: rotating structured logs
- `audit/security.jsonl`: authentication and privileged-operation audit
- `backups/`: recovery snapshots
- `secrets.json`: DPAPI-encrypted AI API key

The checked-in `data/*.json` files are compatibility mirrors. Back up both the
SQLite database (including `-wal`/`-shm` while running) and the backups folder.

## Recovery

1. Stop the application and adapter.
2. Copy the complete `.fanuc-pro-suite` directory to protected storage.
3. Restore through the admin-only application workflow.
4. Verify the data-store status and adapter integrity before reconnecting CNCs.
5. Test on the simulator or an isolated test machine first.

## Release requirements

A production release requires a Windows code-signing certificate. Sign the
Electron executable, installer, `FanucSHDRAdapter.exe`, and adapter DLLs. Update
`bin/adapter.integrity.json` only from a reviewed build. Never disable signature
or integrity checks to ship a release.
