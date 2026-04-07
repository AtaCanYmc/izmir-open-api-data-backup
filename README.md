# Izmir Open API Data Backup

Bu proje, `izmir-open-data-js` kutuphanesi ile ESHOT hat verisini gunluk yedekler ve GitHub Pages uzerinden gosterir.

## Dosyalar

- `backup.ts`: ESHOT hat listesini CKAN kaynagindan cekip `data/eshot-hatlar.json` dosyasina yazar.
- `.github/workflows/daily-backup.yml`: Her gun TSI 23:00 (UTC 20:00) backup scriptini calistirir ve degisiklik varsa commit/push yapar.
- `index.html`: TypeScript React uygulamasini yukler.
- `src/App.tsx`: Tailwind tabanli, responsive, arama destekli goruntuleme arayuzu.
- `tests/backup.test.ts`: backup mantigi icin birim testleri.
- `prompt.md`: Sik kullanilan prompt kaliplari.
- `data/eshot-hatlar.json`: Uretilen JSON yedek dosyasi.

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

## Ornek JSON formati

```json
{
  "updatedAt": "2026-04-08T20:00:00.000Z",
  "source": "izmir-open-data-js / ESHOT getHatlar",
  "total": 441,
  "hatlar": []
}
```
