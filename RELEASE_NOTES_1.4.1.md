# FANUC Pro Suite v1.4.1

## Öne çıkanlar

- Tezgâh Listesi ve Tezgâh Detayı yenilendi; bağlam, filtre ve erişilebilir sekmeler geliştirildi.
- FANUC Merkezi, operasyon özeti, modül envanteri ve bakım akışları güçlendirildi.
- Bakım, pil, fan ve yedek durumları yalnızca en güncel kayıtlarla değerlendiriliyor.
- Yedekleme sistemi manifest, checksum, SQLite kapsamı, staging ve geri alma desteğiyle geliştirildi.
- `renderer.js` içindeki ana ekran ve hizmetler bağımsız modüllere ayrıldı.
- Yerel performans teşhisi ve renderer çökme kurtarma ekranı eklendi.
- Modal, tablo, boş durum, bildirim ve klavye erişilebilirliği iyileştirildi.
- RS232/DNC ekranının yalnızca yerel simülasyon olduğu açık hale getirildi.

## Güvenlik ve veri bütünlüğü

- PDF oluşturma oturum kontrolü, boyut sınırı ve aktif içerik temizliğiyle korundu.
- Kullanıcı kimlik bilgileri iş verisi yedeklerinden ayrı tutuluyor.
- Geri yükleme sonrası aktif oturumlar kapatılıyor.
- Uygulamanın kalıcı salt-okunur CNC politikası korunuyor.

## Doğrulama

- 95/95 birim ve regresyon testi başarılı.
- 3/3 Electron E2E testi başarılı.
- 40 sayfa ve ilgili alt sekmeler fiziksel olarak doğrulandı.
- Windows Setup kurulum, ilk açılış ve kaldırma testi başarılı.

Setup SHA-256:

`0639965043986F649FDCD2AA3CAF3AAF95FB5550370E37740EBE82F5C3447990`
