# SQLite Tablo Tasarimi (ESHOT)

Bu dokuman, `data/eshot.db` icinde olusturulan tablolarin amacini ve alanlarini listeler.

## Genel

- Veritabani dosyasi: `data/eshot.db`
- Olusturma komutu: `npm run db:init`
- Surucu: `better-sqlite3`

## Tablolar

### `backup_runs`

Yedekleme calisma gecmisini takip eder.

| Alan | Tip | Aciklama |
|---|---|---|
| `id` | INTEGER PK | Otomatik artan kayit kimligi |
| `source` | TEXT NOT NULL | Calistiran kaynak (ornegin `backup.ts`) |
| `started_at` | TEXT NOT NULL | Baslangic zamani (ISO) |
| `finished_at` | TEXT | Bitis zamani (ISO) |
| `status` | TEXT NOT NULL | `running`, `success`, `failed` |
| `notes` | TEXT | Opsiyonel log/not |

### `hatlar`

Hat bazli ana bilgi tablosu.

| Alan | Tip | Aciklama |
|---|---|---|
| `hat_no` | TEXT PK | Hat numarasi |
| `hat_adi` | TEXT | Hat adi |
| `hat_baslangic` | TEXT | Baslangic duragi |
| `hat_bitis` | TEXT | Bitis duragi |
| `updated_at` | TEXT NOT NULL | Son guncelleme zamani |
| `raw_json` | TEXT NOT NULL | Kaynaktan gelen ham satir (JSON string) |

### `duraklar`

Durak kayitlarini saklar.

| Alan | Tip | Aciklama |
|---|---|---|
| `id` | INTEGER PK | Otomatik artan kimlik |
| `hat_no` | TEXT | Ilgili hat numarasi |
| `durak_id` | INTEGER | Durak kimligi |
| `durak_adi` | TEXT | Durak ismi |
| `enlem` | REAL | Enlem |
| `boylam` | REAL | Boylam |
| `yon` | INTEGER | Yon bilgisi |
| `updated_at` | TEXT NOT NULL | Son guncelleme zamani |
| `raw_json` | TEXT NOT NULL | Ham veri |

Kisit:
- `UNIQUE (hat_no, durak_id, yon)`

Indeks:
- `idx_duraklar_hat_no`

### `duraktan_gecen_hatlar`

`DURAKTAN_GECEN_HATLAR` alaninin normalize edilmis iliski tablosu.

| Alan | Tip | Aciklama |
|---|---|---|
| `id` | INTEGER PK | Otomatik artan kimlik |
| `durak_id` | INTEGER NOT NULL | Durak kimligi |
| `hat_no` | TEXT NOT NULL | Duraktan gecen hat numarasi |
| `updated_at` | TEXT NOT NULL | Son guncelleme zamani |

Kisit:
- `UNIQUE (durak_id, hat_no)`

Indeks:
- `idx_duraktan_gecen_hatlar_durak_id`
- `idx_duraktan_gecen_hatlar_hat_no`

### `guzergah_noktalari`

Hat guzergah koordinat noktalarini saklar.

| Alan | Tip | Aciklama |
|---|---|---|
| `id` | INTEGER PK | Otomatik artan kimlik |
| `hat_no` | TEXT | Hat numarasi |
| `yon` | INTEGER | Yon |
| `sira` | INTEGER | Nokta sirasi |
| `enlem` | REAL | Enlem |
| `boylam` | REAL | Boylam |
| `updated_at` | TEXT NOT NULL | Son guncelleme zamani |
| `raw_json` | TEXT NOT NULL | Ham veri |

Kisit:
- `UNIQUE (hat_no, yon, sira)`

Indeks:
- `idx_guzergah_hat_no`

### `hareket_saatleri`

Hat hareket saatlerini saklar.

| Alan | Tip | Aciklama |
|---|---|---|
| `id` | INTEGER PK | Otomatik artan kimlik |
| `hat_no` | TEXT | Hat numarasi |
| `yon` | INTEGER | Yon |
| `kalkis_saati` | TEXT | Saat bilgisi |
| `aciklama` | TEXT | Serbest metin/ek bilgi |
| `updated_at` | TEXT NOT NULL | Son guncelleme zamani |
| `raw_json` | TEXT NOT NULL | Ham veri |

Indeks:
- `idx_saatler_hat_no`

## Notlar

- `raw_json` alani sema degisimlerine karsi esneklik saglar.
- Uygulama tarafinda islenmis kolonlar + ham satir birlikte tutulur.
- Buyuk importlarda transaction kullanimi onerilir.

