!macro customInstall
  ; A company provisioning file placed beside Setup is copied into the
  ; per-user data directory. The app validates it, imports its token into
  ; Windows safeStorage and removes this plaintext copy on first launch.
  IfFileExists "$EXEDIR\FANUC-Provisioning.json" 0 provisioning_done
    CreateDirectory "$PROFILE\.fanuc-pro-suite"
    CopyFiles /SILENT "$EXEDIR\FANUC-Provisioning.json" "$PROFILE\.fanuc-pro-suite\FANUC-Provisioning.json"
  provisioning_done:
!macroend
