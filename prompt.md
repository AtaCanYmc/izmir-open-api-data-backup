# Prompt Komut Rehberi

Bu dosya, projede sik kullanilan komutlari tek satirda istemek icin hazir prompt kaliplari icerir.

## Hizli Promptlar

- `Sadece backup scriptini calistir ve sonucu ozetle.`
- `Backup dry-run yap, dosya yazmadan kac kayit geldigini soyle.`
- `Tum testleri calistir, basarisiz test varsa nedeniyle birlikte yaz.`
- `Build al ve TypeScript hatasi varsa dosya/satir ile listele.`
- `Workflow cron saatini kontrol et, TSI 23:00 ile uyumlu mu bak.`
- `Belirli bir hat icin olusan dosyalari kontrol et: data/eshot/<hatNo> altinda 3 json var mi?`

## Gelistirme Promptlari

- `backup.ts icin yeni bir fonksiyon ekle ve testini yaz.`
- `App.tsx'e yeni bir sekme ekle (yeni veri kaynagi), tab sistemiyle entegrasyonu sagla.`
- `Yeni veri kaynagi icin backup fonksiyonu ekle, generic backup yolunu kullan.`
- `README'yi guncelle ve gerekli komutlari code block icinde ver.`
- `Hat bazli klasorleme kurallarini degistir (folder adlandirma, index alani) ve testleri guncelle.`

## Kod Inceleme Promptlari

- `Bu branch'i review et: once kritik bulgular, sonra orta/dusuk riskler.`
- `Sadece test acisindan eksikleri listele ve hangi dosyaya test eklenecegini soyle.`
- `GitHub Actions dosyasini guvenlik ve guvenilirlik acisindan denetle.`

## Veri Yapilari

### Hatlar (eshot-hatlar.json)
- HAT_NO: Hat numarasi
- HAT_ADI: Hat ismi
- HAT_BASLANGIC: Baslangic duragi
- HAT_BITIS: Bitis duragi

### Duraklar (data/eshot/<hatNo>/duraklar.json)
- DURAK_ID: Durak ID
- DURAK_ADI: Durak ismi
- ENLEM/BOYLAM: Koordinatlar
- DURAKTAN_GECEN_HATLAR: Gecen hat numaralari

### Guzergahlar (data/eshot/<hatNo>/guzergah.json)
- HAT_NO: Hat numarasi
- YON: Yonlendirme (1=Gidis, 2=Donus)
- ENLEM/BOYLAM: Koordinat noktasi

### Hareket Saatleri (data/eshot/<hatNo>/saatler.json)
- Tum hareket saati kayitlari (101761 kayit)

### Index (data/eshot/index.json)
- hatNo: Hat numarasi
- folder: Hat klasor adi
- counts: durak/guzergah/saat sayilari

## Tek Komutla Calistirma

```bash
npm run backup      # Tum verileri yedekle
npm run backup:dry  # Test modu (dosya yazmadan)
npm test            # Testleri calistir
npm test:watch      # Watch mode (calisilan)
npm run build       # TypeScript + Vite derlemesi
npm run dev         # Gelistirme sunucusu
```
