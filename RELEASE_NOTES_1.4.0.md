# FANUC Pro Suite v1.4.0

Bu sürüm, bakım ekibinin günlük FANUC çalışmalarını tek merkezde toplar.

## Yenilikler

- Tezgâha özel FANUC profilleri ve merkezi çalışma ekranı
- Altı yönlendirmeli teşhis senaryosu
- Elektrik panosu ve FANUC modül envanteri
- Tezgâh, modül, yedek, teşhis ve LED kayıtlarında evrensel arama
- Bakım, pil, fan, yedek ve envanter risklerini özetleyen operasyon paneli
- Parametre karşılaştırma ve yedekleme ekranlarına hızlı geçişler
- Model bağımlı uyarılar içeren LED ve 7-segment rehberi
- FANUC merkezi ve operasyon panelinin ayrı modüllere taşınması

## Güvenlik yaklaşımı

Uygulama salt okunur çalışma prensibini korur. CNC parametresi yazmaz, program yüklemez, silmez veya çalıştırmaz. LED kodları ve teşhis önerileri model bağımlıdır; işlem öncesinde ilgili FANUC bakım kılavuzuyla doğrulanmalıdır.

## Doğrulama

- JavaScript sözdizimi kontrolü başarılı
- 36 otomatik test başarılı
- Windows x64 NSIS kurulum paketi oluşturuldu
