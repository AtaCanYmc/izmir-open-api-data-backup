# Izmir Open API Data Backup

Bu proje, `izmir-open-data-js` kutuphanesi ile ESHOT verisini gunluk yedekler ve **Supabase PostgreSQL** veritabaninda saklar.

## Mimari

- **Veri Kaynağı**: İzmir Büyükşehir Belediyesi Open Data API (ESHOT)
- **Depolama**: Supabase PostgreSQL
- **Otomasyon**: GitHub Actions (günlük yedekleme)
- **Secrets**: GitHub Secrets üzerinden Supabase bilgileri

## Dosyalar

- `backup.ts`: ESHOT verisini çeker ve Supabase'e yazar.
- `db/supabase.ts`: Supabase client bağlantı modülü.
- `db/supabase-schema.sql`: PostgreSQL tablo şemaları (Supabase'de çalıştırılmalı).
- `.github/workflows/daily-backup.yml`: Her gün 06:00 TSİ backup scriptini çalıştırır.
- `src/App.tsx`: React frontend uygulaması.
- `tests/backup.test.ts`: Backup mantığı için birim testleri.

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Supabase Projesi Oluştur

1. [supabase.com](https://supabase.com) üzerinden yeni proje oluştur
2. SQL Editor'de `db/supabase-schema.sql` dosyasındaki SQL'i çalıştır
3. Project Settings > API bölümünden bilgileri al:
   - `SUPABASE_URL`: Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: service_role key (secret, paylaşma!)

### 3. GitHub Secrets Ayarla

GitHub repository'de Settings > Secrets and variables > Actions'a git ve şu secrets'ları ekle:

- `SUPABASE_URL`: `https://xxx.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Çalıştırma

### Yerel Test (Supabase bağlantısıyla)

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
npm run backup
```

### Sadece API Testi (veritabanına yazmadan)

```bash
npm run backup:dry
```

### Testleri Çalıştırma

```bash
npm test
```

## Veritabanı Şeması

Supabase'de aşağıdaki tablolar oluşturulur:

| Tablo | Açıklama |
|-------|----------|
| `backup_runs` | Yedekleme çalışma kayıtları |
| `hatlar` | Hat bilgileri (hat_no, hat_adi, vs.) |
| `duraklar` | Durak bilgileri (koordinatlar, isimler) |
| `guzergah_noktalari` | Güzergah polyline noktaları |
| `hareket_saatleri` | Sefer saatleri |
| `duraktan_gecen_hatlar` | Durak-hat ilişkileri |

Detaylı şema için `db/supabase-schema.sql` ve `docs/sqlite-tablolar.md` dosyalarına bakın.

## GitHub Actions Workflow

Workflow her gün otomatik olarak çalışır:

- **Zamanlama**: Her gün 06:00 TSİ (03:00 UTC)
- **Manuel Tetikleme**: Actions sekmesinden "Run workflow" butonu

Secrets doğru ayarlandığında, workflow İzmir Open Data API'den verileri çeker ve Supabase'e yazar.

## Güvenlik Notları

⚠️ **ÖNEMLİ**: `SUPABASE_SERVICE_ROLE_KEY` asla commit edilmemeli veya paylaşılmamalıdır!

- GitHub Secrets üzerinden güvenli şekilde saklanır
- Row Level Security (RLS) ile tablolar korunur
- Okuma herkese açık, yazma sadece service_role ile mümkün
