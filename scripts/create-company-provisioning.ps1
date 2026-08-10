$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'create-provisioning.ps1') `
  -DriveEndpoint 'https://script.google.com/macros/s/AKfycbxfGViF_BiGwFpbiS-pIsnhAit_eIBtGKx9GKKESlUxb9vncTEh3vsnoJDbHDd6v4Z4NA/exec' `
  -DriveFolderId '1h7re6FFXCEXDgnGCLnoixuxVDBjEYtYK' `
  -Company 'Inan Makina' `
  -OutputPath (Join-Path $projectRoot 'FANUC-Provisioning.json')

Write-Host ''
Write-Host 'Islem tamamlandi. Bu pencereyi kapatabilirsiniz.' -ForegroundColor Green
