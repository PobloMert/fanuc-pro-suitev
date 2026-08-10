param(
  [Parameter(Mandatory=$true)][string]$DriveEndpoint,
  [Parameter(Mandatory=$true)][string]$DriveFolderId,
  [string]$EnrollmentKey,
  [string]$Company = 'Inan Makina',
  [string]$OutputPath = '.\FANUC-Provisioning.json'
)

if (-not $EnrollmentKey) {
  $secureKey = Read-Host 'Apps Script FANUC_DRIVE_TOKEN degerini girin (karakterler gorunmez)' -AsSecureString
  $credential = [System.Net.NetworkCredential]::new('', $secureKey)
  $EnrollmentKey = $credential.Password
}

if ($EnrollmentKey.Length -lt 16 -or $EnrollmentKey.Length -gt 512 -or $EnrollmentKey -match "[\r\n]") { throw 'EnrollmentKey en az 16, en fazla 512 karakter olmalidir.' }
# -cmatch/-cnotmatch avoids Turkish-culture case folding of the ASCII I in Apps Script IDs.
if ($DriveEndpoint -cnotmatch '^https://script\.google\.com/macros/s/[-A-Za-z0-9_]+/exec$') { throw 'Gecerli bir Google Apps Script /exec adresi girin.' }
if ($DriveFolderId -cnotmatch '^[-A-Za-z0-9_]{10,128}$') { throw 'Drive klasor kimligi gecersiz.' }

$payload = [ordered]@{
  schemaVersion = 1
  company = $Company
  driveEndpoint = $DriveEndpoint
  driveFolderId = $DriveFolderId
  enrollmentKey = $EnrollmentKey
  deviceNameMode = 'windows-hostname'
}
$resolved = [System.IO.Path]::GetFullPath($OutputPath)
$payload | ConvertTo-Json | Set-Content -LiteralPath $resolved -Encoding UTF8
Write-Output "Provisioning dosyasi olusturuldu: $resolved"
Write-Output 'Bu dosyayi GitHuba yuklemeyin. Setup dosyasiyla ayni klasorde kurum icinde dagitin.'
