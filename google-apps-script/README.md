# Google Drive senkronizasyon sunucusu

`Code.gs`, FANUC Pro Suite'in güvenli Drive yedekleme ve cihazlar arası kayıt birleştirme endpoint'idir.

1. Google Apps Script projesinde `Code.gs` içeriğini kullanın.
2. Script Properties bölümüne `FANUC_DRIVE_TOKEN` ve `FANUC_DRIVE_FOLDER_ID` ekleyin.
3. `FANUC_DRIVE_TOKEN`, uygulamadaki Senkronizasyon Merkezi'ne girilen en az 16 karakterli cihaz anahtarıyla aynı olmalıdır.
4. Web uygulamasını yeni deployment olarak yayımlayın ve oluşan URL'yi `main.js` içindeki sabit endpoint ile eşleştirin.
5. Deployment erişimini yalnız gerekli hesaplarla sınırlayın.

Sunucu; checksum doğrulaması, allowlist, tombstone/revision birleştirmesi, cihaz listesi, çatışma kaydı, son 7 günlük ve son 4 haftalık kopyayı uygular. Eski deployment güncellenmeden istemci `legacy-full` fallback kullanır ve sunucu tarafı güvenlik/sürümleme garantisi verilemez.
