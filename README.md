# Izmir Open API Data Backup

Bu proje, `izmir-open-data-js` kutuphanesi ile ESHOT verisini gunluk yedekler ve GitHub Pages uzerinden hat bazli goruntuler.

## Dosyalar

- `backup.ts`: ESHOT verisini ceker, `data/eshot-hatlar.json` ve hat bazli klasor yapisini yazar.
   - `data/eshot/index.json`
   - `data/eshot/<hatNo>/duraklar.json`
   - `data/eshot/<hatNo>/guzergah.json`
   - `data/eshot/<hatNo>/saatler.json`
- `.github/workflows/daily-backup.yml`: Her gun TSI 23:00 (UTC 20:00) backup scriptini calistirir ve degisiklik varsa commit/push yapar.
- `index.html`: TypeScript React uygulamasini yukler.
- `src/App.tsx`: Tailwind tabanli, responsive, arama destekli goruntuleme arayuzu.
   - `index.json` uzerinden hat listesi yukler
   - Secilen hat icin detay dosyalarini lazy-load eder
- `tests/backup.test.ts`: backup mantigi icin birim testleri.
- `prompt.md`: Sik kullanilan prompt kaliplari.
- `data/eshot-hatlar.json`: Uretilen JSON yedek dosyasi.
- `data/eshot/`: Hat bazli tum detay dosyalari.

## Kurulum

```bash
npm install
```

## Calistirma

```bash
npm run backup
```

Sadece cekme testi (dosya yazmadan):

```bash
npm run backup:dry
```

Testleri calistirma:

```bash
npm test
```

## GitHub Pages

1. GitHub depo ayarlarinda Pages kaynagini branch root olarak secin.
2. `index.html` ve `data/` klasoru root'ta oldugu icin ek ayar gerekmez.

## Ornek JSON formatlari

```json
{
  "updatedAt": "2026-04-08T20:00:00.000Z",
  "source": "izmir-open-data-js / ESHOT grouped by HAT_NO",
  "total": 441,
  "hatlar": [{ "hatNo": "10", "folder": "10" }]
}
```

```json
{
  "updatedAt": "2026-04-08T20:00:00.000Z",
  "source": "izmir-open-data-js / ESHOT getDuraklar",
  "hatNo": "10",
  "total": 52,
  "duraklar": []
}
```
