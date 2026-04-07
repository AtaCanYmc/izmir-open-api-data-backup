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
- `App.tsx arama deneyimini iyilestir, sonra test stratejisi oner.`
- `data/eshot-hatlar.json formatina yeni alan ekle, geriye uyumlulugu koru.`
- `README'yi guncelle ve gerekli komutlari code block icinde ver.`

## Kod Inceleme Promptlari

- `Bu branch'i review et: once kritik bulgular, sonra orta/dusuk riskler.`
- `Sadece test acisindan eksikleri listele ve hangi dosyaya test eklenecegini soyle.`
- `GitHub Actions dosyasini guvenlik ve guvenilirlik acisindan denetle.`

## Tek Komutla Calistirma

```bash
npm run backup
npm run backup:dry
npm test
npm test:watch
npm run build
npm run dev
```

