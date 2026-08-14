# FANUC Pro Suite v1.4.4

## 🚀 Öne Çıkan Geliştirmeler

- **🤖 Akıllı RAG & Bakım Defteri Arıza Geçmişi Entegrasyonu:**
  - AI Asistanı atölyedeki tüm geçmiş bakım, arıza, sensör ve mekanik müdahale kayıtlarını (`State.maintenances`) doğrudan tarayabilir.
  - Tezgâh bazlı arıza geçmişi ve parça kelimelerine göre teşhis desteği sağlandı.
- **⚡ Çoklu Alarm Çapraz Kök Neden Hiyerarşisi:**
  - Birden fazla alarm oluştuğunda (örn: SV0401 + SP9012) birincil tetikleyici arıza ile zincirleme güvenlik sonuçları otomatik ayrıştırılır ve pano başında müdahale sırası belirlenir.
- **📝 Bakım Defterinde 3 Saniyede Hızlı Kayıt:**
  - `[ 🛢️ Kızak Yağı İkmali ]`, `[ 🔋 Absolute Pil Değişimi ]`, `[ 🧹 Pano Fan Temizliği ]`, `[ 📐 Eksen Boşluk / Cetvel Ayarı ]`, `[ 🌀 Spindle Bakımı ]` tek tık şablonları eklendi.
- **🚨 İnteraktif Alarm Pano Kontrol Listesi:**
  - Alarm detay modalında çözüm adımları tıklanabilir `[✓]` kontrol listesine dönüştürüldü; pano başında test edilen adımlar işaretlenip üstü çizilebilir.
- **🔌 RS232 Multimetre Buzzer Test Simülatörü:**
  - DB9 (PC) ve DB25 (CNC) lehim bağlantılarını test eden interaktif multimetre süreklilik simülatörü eklendi; kısa devre çapaklarını önceden tespit eder.
- **📺 Canlı İzleme Görsel Modernizasyonu & Kule Lambası Beacon LED'leri:**
  - DRO koordinat göstergeleri, nefes alan canlı neon kule lambası durum noktacıkları (`beaconPulse`) ve 6px siber kaydırma çubukları entegre edildi.
- **🎨 Dinamik Kurumsal Logo & Tema Uyumu:**
  - Açık (beyaz) ve koyu temalar için özel tasarlanan yüksek kaliteli İnan Makina / MTB logosu (`mtb-breakers-logo-dark.png`) entegre edildi.
- **📋 Tezgâh Sıralaması:**
  - Tüm açılır listeler ve Teşhis Merkezi Türkçe alfabetik ve doğal sayısal düzene göre (`CNF 05` ... `VİNÇ 73`) sıralandı.

## 🛡️ Güvenlik ve Veri Bütünlüğü

- **Hacker Seviyesi Penetrasyon Denetimi:** SQL Injection, Path Traversal, XSS ve FOCAS izinsiz yazma saldırılarına karşı tam koruma.
- **%100 Salt-Okunur Güvenlik:** Tezgâha hiçbir zaman komut yazılmaz; donanım güvenliği tavizsiz korunur.

## 🧪 Doğrulama

- **181 / 181 Birim & Regresyon Testi:** Sıfır hata ile tamamlandı.
- **Sözdizimi Doğrulaması:** `npm run check` başarıyla geçti.

Setup SHA-256:

`89CE2EE73AB3492C75E67E418A49A0C7F99C63FD133DB0BD869C059F5BA6FD51`

