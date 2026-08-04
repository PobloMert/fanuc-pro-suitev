$ErrorActionPreference = 'Stop'
$mock = Start-Process -FilePath node -ArgumentList 'scripts/mock-adapter.js' -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
try {
  $env:FANUC_SIMULATION = '1'
  $env:FANUC_SMOKE_TEST = '1'
  $env:FANUC_DATA_DIR = Join-Path (Get-Location) '.smoke-data'
  & .\node_modules\.bin\electron.cmd . --disable-gpu --in-process-gpu --disable-gpu-compositing --disable-gpu-disk-cache
  if ($LASTEXITCODE -ne 0) { throw "Electron smoke test failed: $LASTEXITCODE" }
} finally {
  Stop-Process -Id $mock.Id -Force -ErrorAction SilentlyContinue
  Remove-Item Env:FANUC_SIMULATION -ErrorAction SilentlyContinue
  Remove-Item Env:FANUC_SMOKE_TEST -ErrorAction SilentlyContinue
  Remove-Item Env:FANUC_DATA_DIR -ErrorAction SilentlyContinue
}
