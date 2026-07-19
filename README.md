# MTB Elektrik Bakım

MTB Breakers için elektrik bakım, tezgâh takibi ve teknik referans uygulaması.

## Başlatma

```powershell
cd <proje-klasörü>
npm start
```

## Modüller

### Tezgâh Kitaplığı

- FANUC teknik dokümanlarını kategori ve seri bazında düzenleme
- PDF doküman bağlama ve görüntüleme

### Proje Yöneticisi

- Mekanik, elektrik ve PMC projeleri oluşturma
- Proje ilerlemesini takip etme
- Projeleri `%USERPROFILE%\.fanuc-pro-suite\projects\` altında saklama

### Alarm Veritabanı

- FANUC alarm kodları, nedenleri ve çözüm adımları
- AI asistana ilgili alarm için soru sorma

### Parametre Veritabanı

- FANUC parametre açıklamaları, veri türleri, aralıkları ve varsayılanları

### AI Asistan

- Yerel veritabanını kullanan çevrimdışı mod
- OpenAI ve Gemini sağlayıcı desteği

## Proje Yapısı

```text
Fanuc/
├── main.js              # Electron ana süreç
├── preload.js           # IPC köprüsü
├── package.json
├── data/                # Uygulama verileri
└── src/
    ├── index.html       # Ana pencere
    ├── renderer.js      # UI mantığı
    └── styles/
        ├── main.css     # Ana stil
        └── ai.css       # AI sohbet stilleri
```

## PMC Adres Haritası

| Prefix | Açıklama |
| --- | --- |
| X | Makine girişleri |
| Y | Makine çıkışları |
| G | NC → PMC sinyalleri |
| F | PMC → NC sinyalleri |
| R | Dahili röleler |
| T | Zamanlayıcılar |
| C | Sayaçlar |
| K | Kalıcı bitler |
| D | Veri registerleri |
