-- Supabase PostgreSQL Şeması
-- İzmir Open API ESHOT Verileri

-- Yedekleme çalışma kayıtları (maksimum 30 kayıt tutulur)
CREATE TABLE IF NOT EXISTS backup_runs (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  notes TEXT
);

-- Hat bilgileri
CREATE TABLE IF NOT EXISTS eshot_hatlar (
  hat_no TEXT PRIMARY KEY,
  hat_adi TEXT,
  hat_baslangic TEXT,
  hat_bitis TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Durak bilgileri
CREATE TABLE IF NOT EXISTS eshot_duraklar (
  id SERIAL PRIMARY KEY,
  hat_no TEXT,
  durak_id INTEGER,
  durak_adi TEXT,
  enlem DOUBLE PRECISION,
  boylam DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (hat_no, durak_id)
);

-- Güzergah noktaları
CREATE TABLE IF NOT EXISTS eshot_guzergah_noktalari (
  id SERIAL PRIMARY KEY,
  hat_no TEXT,
  yon INTEGER,
  sira INTEGER,
  enlem DOUBLE PRECISION,
  boylam DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (hat_no, yon, sira)
);

-- Hareket saatleri
CREATE TABLE IF NOT EXISTS eshot_hareket_saatleri (
  id SERIAL PRIMARY KEY,
  hat_no TEXT,
  tarife_id INTEGER,
  sira INTEGER,
  gidis_saati TEXT,
  donus_saati TEXT,
  gidis_engelli_destegi BOOLEAN,
  donus_engelli_destegi BOOLEAN,
  bisikletli_gidis BOOLEAN,
  bisikletli_donus BOOLEAN,
  gidis_elektrikli_otobus BOOLEAN,
  donus_elektrikli_otobus BOOLEAN,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Duraktan geçen hatlar (many-to-many ilişki)
CREATE TABLE IF NOT EXISTS eshot_duraktan_gecen_hatlar (
  id SERIAL PRIMARY KEY,
  durak_id INTEGER NOT NULL,
  hat_no TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (durak_id, hat_no)
);

-- Metro istasyonları
CREATE TABLE IF NOT EXISTS metro_istasyonlar (
  id SERIAL PRIMARY KEY,
  istasyon_id INTEGER UNIQUE,
  istasyon_adi TEXT,
  sira INTEGER,
  enlem DOUBLE PRECISION,
  boylam DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL
);

-- İzban istasyonları
CREATE TABLE IF NOT EXISTS izban_istasyonlar (
  id SERIAL PRIMARY KEY,
  istasyon_id INTEGER UNIQUE,
  istasyon_adi TEXT,
  enlem DOUBLE PRECISION,
  boylam DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_eshot_duraklar_hat_no ON eshot_duraklar (hat_no);
CREATE INDEX IF NOT EXISTS idx_eshot_duraktan_gecen_hatlar_durak_id ON eshot_duraktan_gecen_hatlar (durak_id);
CREATE INDEX IF NOT EXISTS idx_eshot_duraktan_gecen_hatlar_hat_no ON eshot_duraktan_gecen_hatlar (hat_no);
CREATE INDEX IF NOT EXISTS idx_eshot_guzergah_hat_no ON eshot_guzergah_noktalari (hat_no);
CREATE INDEX IF NOT EXISTS idx_eshot_saatler_hat_no ON eshot_hareket_saatleri (hat_no);

-- backup_runs tablosu için 30 kayıt limiti trigger'ı
CREATE OR REPLACE FUNCTION limit_backup_runs()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM backup_runs
  WHERE id IN (
    SELECT id FROM backup_runs
    ORDER BY started_at DESC
    OFFSET 30
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_limit_backup_runs ON backup_runs;
CREATE TRIGGER trigger_limit_backup_runs
  AFTER INSERT ON backup_runs
  FOR EACH STATEMENT
  EXECUTE FUNCTION limit_backup_runs();

-- Row Level Security (RLS) - Okuma herkese açık, yazma sadece service_role
ALTER TABLE backup_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE eshot_hatlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE eshot_duraklar ENABLE ROW LEVEL SECURITY;
ALTER TABLE eshot_guzergah_noktalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE eshot_hareket_saatleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE eshot_duraktan_gecen_hatlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE metro_istasyonlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE izban_istasyonlar ENABLE ROW LEVEL SECURITY;

-- Public okuma politikaları
CREATE POLICY "Public read backup_runs" ON backup_runs FOR SELECT USING (true);
CREATE POLICY "Public read eshot_hatlar" ON eshot_hatlar FOR SELECT USING (true);
CREATE POLICY "Public read eshot_duraklar" ON eshot_duraklar FOR SELECT USING (true);
CREATE POLICY "Public read eshot_guzergah_noktalari" ON eshot_guzergah_noktalari FOR SELECT USING (true);
CREATE POLICY "Public read eshot_hareket_saatleri" ON eshot_hareket_saatleri FOR SELECT USING (true);
CREATE POLICY "Public read eshot_duraktan_gecen_hatlar" ON eshot_duraktan_gecen_hatlar FOR SELECT USING (true);
CREATE POLICY "Public read metro_istasyonlar" ON metro_istasyonlar FOR SELECT USING (true);
CREATE POLICY "Public read izban_istasyonlar" ON izban_istasyonlar FOR SELECT USING (true);

-- Service role yazma politikaları (INSERT, UPDATE, DELETE)
CREATE POLICY "Service write backup_runs" ON backup_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write eshot_hatlar" ON eshot_hatlar FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write eshot_duraklar" ON eshot_duraklar FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write eshot_guzergah_noktalari" ON eshot_guzergah_noktalari FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write eshot_hareket_saatleri" ON eshot_hareket_saatleri FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write eshot_duraktan_gecen_hatlar" ON eshot_duraktan_gecen_hatlar FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write metro_istasyonlar" ON metro_istasyonlar FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write izban_istasyonlar" ON izban_istasyonlar FOR ALL USING (auth.role() = 'service_role');
