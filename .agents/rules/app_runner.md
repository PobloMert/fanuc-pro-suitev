# Uygulama Çalıştırma Kuralı (Application Execution Rule)

Kullanıcı "uygulamayı çalıştır", "uygulamayı aç", "app aç" veya benzeri bir istekte bulunduğunda:

Electron GUI penceresinin kullanıcının aktif masaüstü oturumunda görünür olarak açılabilmesi için komutu şu şekilde çalıştır:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'c:\Users\ahmet\OneDrive\Masaüstü\Fanuc'; npm run dev"
```

veya kullanıcıya terminalde `cd "c:\Users\ahmet\OneDrive\Masaüstü\Fanuc"; npm run dev` çalıştırmasını belirt.
