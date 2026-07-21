# ⚙️ FANUC Pro Suite — CNC Telemetri, Elektrik Bakım & IIoT Endüstriyel Yönetim Sistemi

[![Electron Version](https://img.shields.io/badge/Electron-v28.0.0-blue.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![Node Version](https://img.shields.io/badge/Node.js-v18%2B-brightgreen.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![FANUC Protocol](https://img.shields.io/badge/FANUC-FOCAS2%20%2F%20MTConnect-yellow.svg?style=for-the-badge&logo=csharp)](https://github.com/PobloMert/fanuc-pro-suitev)
[![License](https://img.shields.io/badge/License-MIT-orange.svg?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Aktif%20Saha%20Kullan%C4%B1m%C4%B1-success.svg?style=for-the-badge)]()

**FANUC Pro Suite**, CNC atölyelerindeki FANUC kontrol üniteli tezgahlar için geliştirilmiş; **canlı telemetri izleme (FOCAS/MTConnect)**, **Side-by-Side parametre karşılaştırma**, **pil & fan ömrü takibi (Lifecycle Calculator)**, **G-kod ile eksen boşluk hesaplama (Backlash)** ve **yapay zeka destekli saha arıza teşhis** platformudur.

---

## 🌟 Ana Modüller ve İleri Seviye Özellikler

### 1. 📡 Canlı CNC Telemetri & MTConnect Paneli
- C# tabanlı **FOCAS Ethernet Adaptörü (`FanucSHDRAdapter.exe`, `Fwlib32.dll`)** ile tezgahlardan canlı devir, ilerleme, eksen pozisyonları ve alarm verilerini toplama.
- Dahili web sunucusu üzerinden mobil cihazlardan erişilebilir **MTConnect Canlı İzleme Paneli (`src/dashboard/`)**.
- Doğal Türkçe alfanümerik tezgah sıralama algoritması (`CNF 05`, `CNF 13`, `UNİ 20`).

### 2. 📂 Side-by-Side Parametre Karşılaştırma & Diff Engine (`param_comparator`)
- İki farklı FANUC parametre yedeğini (`.PRM`, `.ALL`, `.TXT`, `.NC`) yan yana karşılaştırma.
- **8-Bit Görsel Vurgulama:** `1815 APZ/APC` (Referans sıfırlaması), `3111 NPA/SVS` (Ekran gösterimi), `3202 NE8/NE9` (Program kilidi) gibi kritik bit değişikliklerini **Bit 0 → Bit 7** detaylı açıklamasıyla gösterme.
- Sürükle-bırak (Drag & Drop) dosya alanları, arama filtresi ve PDF rapor çıktısı alma.

### 3. 🔋 Pil & Sürücü Fan Ömrü Takip Paneli (Lifecycle Calculator)
- FANUC Absolute Enkoder pilleri (A06B-6093-K001) ve sürücü fanları için montaj tarihinden itibaren **kalan gün ve saat geri sayım sayacı**.
- Anlık pil voltaj seviye göstergesi (`⚡ 3.6V`, `⚡ 3.2V`, `⚡ 2.4V`) ve renkli ilerleme çubukları.
- Süresi geçen veya 60 günden az kalan kritik piller için canlı KPI sayaçları.

### 4. 📈 Eksen Boşluk (Backlash) & Hatve Telafisi Sihirbazı (`backlash_helper`)
- X, Y veya Z ekseni için otomatik **mikro test G-kodu programı** üretme (`G91 G01 X10. F500`, `G04 P2000`, `X-10.`).
- Komparatör saatiyle ölçülen mikron sapmasını girerek **FANUC Parametre 1851 (Backlash Comp)** yeni telafi değerini hesaplama.
- Siyah-yeşil nostaljik **FANUC SYSTEM PARAMETER No. 1851 ekran simülasyonu**.

### 5. 🤖 Yapay Zeka Destekli FANUC Saha Arıza Botu (`ai`)
- Çevrimdışı yerel veritabanı + Online LLM desteği (OpenAI / Gemini).
- FANUC alarmları (`SV0401 Servo Alarm`, `P1815 APZ`, `FSSB Fiber Optik`, `SP9012 Spindle Overcurrent`) için adım adım elektrik kontrol adımları, konnektör lokasyonları (`CXA2A`, `JF1`) ve avometre ölçüm noktaları rehberi.

### 6. 🏭 Atölye Bakım & OEE Verimlilik Takibi
- Arıza kayıtları, periyodik bakım takvimi ve parça değişim geçmişi.
- Pikselleşmeyen responsive HTML/CSS OEE Verimlilik ve Durum çubukları.
- Her tezgah için özel QR kodlu fiziksel bakım etiketi üretimi.

---

## 🏗️ Proje Mimarisi ve Klasör Yapısı

```text
Fanuc/
├── main.js                   # Electron Ana Süreç & IPC Geçitleri
├── preload.js                # Güvenli IPC Köprüsü
├── adapter.config.json       # Telemetri IP / Port Eşleşme Yapılandırması
├── bin/
│   ├── FanucSHDRAdapter.exe  # C# FOCAS Telemetri Servisi
│   └── Fwlib32.dll           # FANUC FOCAS2 Kütüphanesi
├── data/                     # JSON Veritabanları (Machines, Alarms, Params...)
│   ├── machines.json
│   ├── maintenances.json
│   ├── batteries.json
│   ├── parameters.json
│   └── alarms.json
└── src/
    ├── index.html            # Ana Uygulama Arayüzü
    ├── renderer.js           # UI Kontrolörü & İstemci Mantığı
    ├── dashboard/            # MTConnect Web Canlı İzleme Paneli
    └── styles/
        ├── main.css          # Glassmorphism & Animasyon CSS
        └── ai.css            # AI Sohbet Arayüz CSS
```

---

## ⚡ Hızlı Başlangıç

### 1. Gereksinimler
- **Node.js**: v18.0.0 veya üstü
- **İşletim Sistemi**: Windows 10 / 11 (FOCAS DLL desteği için)

### 2. Kurulum ve Çalıştırma

```powershell
# Bağımlılıkları yükleyin
npm install

# Uygulamayı başlatın
npm start
```

---

## 🔌 FANUC PMC Adres Haritası Referansı

| Prefix | Adres Tipi | Açıklama |
| :--- | :--- | :--- |
| **X** | Giriş (Input) | Limit switchler, basınç şalterleri, pano butonları |
| **Y** | Çıkış (Output) | Solenoid valfler, röleler, kule lambaları, kontaktörler |
| **G** | NC → PMC | CNC kontrolöründen PMC'ye aktarılan durum sinyalleri |
| **F** | PMC → NC | PMC'den CNC kontrolörüne iletilen komut sinyalleri |
| **R** | Dahili Röle | Geçici lojik dahili hafıza bitleri |
| **T** | Zamanlayıcı | Timer sayaçları |
| **C** | Counter | Parça ve tur sayaçları |
| **K** | Keep Relay | Kalıcı makine fonksiyon ayar bitleri |
| **D** | Data Register | Sayısal veri ve sayaç saklama alanları |

---

## 📄 Lisans

Bu proje **MIT Lisansı** altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakabilirsiniz.
