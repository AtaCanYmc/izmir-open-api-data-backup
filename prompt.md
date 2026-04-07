# Prompt Komut Rehberi

Bu dosya, projede sik kullanilan komutlari tek satirda istemek icin hazir prompt kaliplari icerir.

## Hizli Promptlar

- `Sadece backup scriptini calistir ve sonucu ozetle.`
- `Backup dry-run yap, dosya yazmadan kac kayit geldigini soyle.`
- `Tum testleri calistir, basarisiz test varsa nedeniyle birlikte yaz.`
- `Build al ve TypeScript hatasi varsa dosya/satir ile listele.`
- `Workflow cron saatini kontrol et, TSI 23:00 ile uyumlu mu bak.`

## Gelistirme Promptlari

- `backup.ts icin yeni bir fonksiyon ekle ve testini yaz.`
- `App.tsx'e yeni bir sekme ekle (yeni veri kaynagi), tab sistemiyle entegrasyonu sagla.`
- `Yeni veri kaynagi icin backup fonksiyonu ekle, generic backup yolunu kullan.`
- `README'yi guncelle ve gerekli komutlari code block icinde ver.`

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

### Duraklar (eshot-duraklar.json)
- DURAK_ID: Durak ID
- DURAK_ADI: Durak ismi
- ENLEM/BOYLAM: Koordinatlar
- DURAKTAN_GECEN_HATLAR: Gecen hat numaralari

### Guzergahlar (eshot-guzergahlar.json)
- HAT_NO: Hat numarasi
- YON: Yonlendirme (1=Gidis, 2=Donus)
- ENLEM/BOYLAM: Koordinat noktasi

### Hareket Saatleri (eshot-hareket-saatleri.json)
- Tum hareket saati kayitlari (101761 kayit)

## Tek Komutla Calistirma

```bash
npm run backup      # Tum verileri yedekle
npm run backup:dry  # Test modu (dosya yazmadan)
npm test            # Testleri calistir
npm test:watch      # Watch mode (calisilan)
npm run build       # TypeScript + Vite derlemesi
npm run dev         # Gelistirme sunucusu
```
