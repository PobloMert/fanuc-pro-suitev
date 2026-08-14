# AGENTS Guidelines for FANUC Pro Suite

## Temel Mühendislik İlkeleri ve Gerçeklik Protokolü (Ground Reality Protocol)
- **Çıplak Gerçeklik:** Kullanıcıya hiçbir zaman süslü vaatler veya duymak istedikleri değil; atölyenin, CNC tezgahlarının, FOCAS haberleşmesinin ve donanımın çıplak fiziksel gerçekleri söylenecektir.
- **Sıfır Saçmalık / Sıfır Fuzuli Özellik:** Sırf "özellik eklemiş olmak için" sahada karşılığı olmayan gereksiz animasyonlar, işe yaramaz teorik tablolar veya fuzuli süsler kesinlikle önerilmeyecek ve geliştirilmeyecektir.
- **Sahada Somut Değer:** Uygulama genelindeki her geliştirme mutlaka;
  1. Bir arızayı doğrudan yakalamalı,
  2. Parça hurdaya gitmesini veya takım kırılmasını önlemeli,
  3. Ya da duruş süresini ve maliyeti somut olarak düşürmelidir.
- **Kalıcı %100 Salt-Okunur Güvenlik:** Tezgaha hiçbir zaman komut yazılmayacak; donanım güvenliği tavizsiz korunacaktır.
- **Uygulama Geneli Standart:** Bundan sonraki her adımda, her tespitte ve her analizde yalnızca bu katı mühendislik standardıyla ilerlenecektir.

## Skills-First Protocol
- Her kullanıcı talebinde, soru ve geliştirmede her zaman en uygun yetenek (`skill`) belirlenmeli, `SKILL.md` kuralları okunmalı ve o yeteneğin metodolojisine göre adım atılmalıdır.
- "Uygulamayı aç / çalıştır" istendiğinde interaktif oturumda `Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'c:\Users\ahmet\OneDrive\Masaüstü\Fanuc'; npm run dev"` çalıştırılmalıdır.

