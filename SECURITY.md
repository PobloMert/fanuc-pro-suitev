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
release must update the manifest through a reviewed build pipeline and code-sign
the EXE and DLL files. The C# adapter source and the FOCAS redistribution terms
must be reviewed before distributing this application outside its current
environment.

## Secrets and user data

- PINs are scrypt hashes with unique salts and are verified in the Electron main
  process.
- AI API keys are encrypted with Electron `safeStorage` (Windows DPAPI) and are
  not written to `settings.json`.
- File access is limited to application data, bundled data/bin files, and files
  explicitly selected in a native dialog.
- Security events are appended to
  `%USERPROFILE%/.fanuc-pro-suite/audit/security.jsonl`.

Replace all distributed default PINs immediately after deployment.
