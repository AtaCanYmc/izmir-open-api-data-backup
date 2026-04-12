# SQLite Ornek Sorgular

Bu dosya, `data/eshot.db` icin hazir SQL sorgulari icerir.

## 1) Son backup durumu

```sql
SELECT id, source, started_at, finished_at, status, notes
FROM backup_runs
ORDER BY id DESC
LIMIT 5;
```

## 2) Tablo bazli kayit sayilari

```sql
SELECT 'hatlar' AS tablo, COUNT(*) AS toplam FROM hatlar
UNION ALL
SELECT 'duraklar', COUNT(*) FROM duraklar
UNION ALL
SELECT 'guzergah_noktalari', COUNT(*) FROM guzergah_noktalari
UNION ALL
SELECT 'hareket_saatleri', COUNT(*) FROM hareket_saatleri;
```

## 3) Hat listesini gor

```sql
SELECT hat_no, hat_adi, hat_baslangic, hat_bitis, updated_at
FROM hatlar
ORDER BY CAST(hat_no AS INTEGER), hat_no
LIMIT 100;
```

## 4) Tek bir hatta ait duraklar (ornek: 168)

```sql
SELECT hat_no, durak_id, durak_adi, enlem, boylam, yon
FROM duraklar
WHERE hat_no = '168'
ORDER BY durak_id;
```

## 5) Tek bir hatta ait guzergah noktalari (ornek: 168)

```sql
SELECT hat_no, yon, sira, enlem, boylam
FROM guzergah_noktalari
WHERE hat_no = '168'
ORDER BY yon, sira;
```

## 6) Tek bir hatta ait hareket saatleri (ornek: 168)

```sql
SELECT hat_no, yon, kalkis_saati, aciklama, updated_at
FROM hareket_saatleri
WHERE hat_no = '168'
ORDER BY yon, kalkis_saati
LIMIT 500;
```

## 7) Hat bazli ozet (durak/guzergah/saat sayisi)

```sql
SELECT
  h.hat_no,
  h.hat_adi,
  COALESCE(d.durak_sayisi, 0) AS durak_sayisi,
  COALESCE(g.guzergah_nokta_sayisi, 0) AS guzergah_nokta_sayisi,
  COALESCE(s.saat_sayisi, 0) AS saat_sayisi
FROM hatlar h
LEFT JOIN (
  SELECT hat_no, COUNT(*) AS durak_sayisi
  FROM duraklar
  GROUP BY hat_no
) d ON d.hat_no = h.hat_no
LEFT JOIN (
  SELECT hat_no, COUNT(*) AS guzergah_nokta_sayisi
  FROM guzergah_noktalari
  GROUP BY hat_no
) g ON g.hat_no = h.hat_no
LEFT JOIN (
  SELECT hat_no, COUNT(*) AS saat_sayisi
  FROM hareket_saatleri
  GROUP BY hat_no
) s ON s.hat_no = h.hat_no
ORDER BY CAST(h.hat_no AS INTEGER), h.hat_no;
```

## 8) Hatlarin en yogun oldugu ilk 20 kayit (durak sayisina gore)

```sql
SELECT hat_no, COUNT(*) AS durak_sayisi
FROM duraklar
GROUP BY hat_no
ORDER BY durak_sayisi DESC
LIMIT 20;
```

## 9) Koordinati eksik kayit kontrolu

```sql
SELECT COUNT(*) AS eksik_durak_koordinat
FROM duraklar
WHERE enlem IS NULL OR boylam IS NULL;

SELECT COUNT(*) AS eksik_guzergah_koordinat
FROM guzergah_noktalari
WHERE enlem IS NULL OR boylam IS NULL;
```

## 10) Ham JSON'dan alan kontrolu (debug)

```sql
SELECT hat_no, raw_json
FROM hareket_saatleri
WHERE hat_no = '168'
LIMIT 5;
```

## JetBrains SQL Console icin not

`console.sql` dosyasina bu sorgulardan ihtiyac duydugunu kopyalayip dogrudan calistirabilirsin.


