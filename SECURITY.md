# Security policy

## Safe operating mode

The bundled dashboard is read-only. CNC program activation and deletion remain
disabled until the adapter provides authenticated, role-aware write endpoints,
request signing, replay protection, and server-side audit logging. The frontend
does not contain calls to the adapter's mutation endpoints; UI-only authorization
would not be a security boundary.

## Adapter binaries

The application verifies the SHA-256 values in `bin/adapter.integrity.json`
before starting the adapter and manages only the child process it created. A
release must update the manifest through a reviewed build pipeline and publish
SHA-256 checksums for the installer and adapter artifacts. The C# adapter source and the FOCAS redistribution terms
must be reviewed before distributing this application outside its current
environment.

## Secrets and user data

- PINs are scrypt hashes with unique salts and are verified in the Electron main
  process.
- Login attempts use progressive delay and temporary lockout; sessions expire
  after 30 minutes of inactivity. Seeded accounts must change their PIN on first
  use.
- AI API keys are encrypted with Electron `safeStorage` (Windows DPAPI) and are
  not written to `settings.json`.
- File access is limited to application data, bundled data/bin files, and files
  explicitly selected in a native dialog.
- Security events are appended to
  `%USERPROFILE%/.fanuc-pro-suite/audit/security.jsonl`.

Replace all distributed default PINs immediately after deployment.

Renderer IPC is accepted only from the primary application window. Protected
data is not loaded until authentication succeeds. General file and network
bridges require an active role, bounded input and allowlisted targets.

The script Content Security Policy does not permit inline JavaScript. Legacy
HTML event attributes are migrated at runtime to a delegated event layer that
parses only literal arguments and invokes an explicit action allowlist; it does
not use `eval` or the Function constructor. Inline styles remain temporarily
allowed while feature views are migrated to modules.
