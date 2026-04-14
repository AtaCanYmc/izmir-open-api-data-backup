-- Supabase PostgreSQL Şeması
-- İzmir Open API ESHOT Verileri

-- Yedekleme çalışma kayıtları
CREATE TABLE IF NOT EXISTS backup_runs (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  notes TEXT
);

-- Hat bilgileri
CREATE TABLE IF NOT EXISTS hatlar (
  hat_no TEXT PRIMARY KEY,
  hat_adi TEXT,
  hat_baslangic TEXT,
  hat_bitis TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  raw_json JSONB NOT NULL
);

-- Durak bilgileri
CREATE TABLE IF NOT EXISTS duraklar (
  id SERIAL PRIMARY KEY,
  hat_no TEXT,
  durak_id INTEGER,
  durak_adi TEXT,
  enlem DOUBLE PRECISION,
  boylam DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL,
  raw_json JSONB NOT NULL,
  UNIQUE (hat_no, durak_id)
);

-- Güzergah noktaları
CREATE TABLE IF NOT EXISTS guzergah_noktalari (
  id SERIAL PRIMARY KEY,
  hat_no TEXT,
  yon INTEGER,
  sira INTEGER,
  enlem DOUBLE PRECISION,
  boylam DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL,
  raw_json JSONB NOT NULL,
  UNIQUE (hat_no, yon, sira)
);

-- Hareket saatleri
CREATE TABLE IF NOT EXISTS hareket_saatleri (
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
  updated_at TIMESTAMPTZ NOT NULL,
  raw_json JSONB NOT NULL
);

-- Duraktan geçen hatlar (many-to-many ilişki)
CREATE TABLE IF NOT EXISTS duraktan_gecen_hatlar (
  id SERIAL PRIMARY KEY,
  durak_id INTEGER NOT NULL,
  hat_no TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (durak_id, hat_no)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_duraklar_hat_no ON duraklar (hat_no);
CREATE INDEX IF NOT EXISTS idx_duraktan_gecen_hatlar_durak_id ON duraktan_gecen_hatlar (durak_id);
CREATE INDEX IF NOT EXISTS idx_duraktan_gecen_hatlar_hat_no ON duraktan_gecen_hatlar (hat_no);
CREATE INDEX IF NOT EXISTS idx_guzergah_hat_no ON guzergah_noktalari (hat_no);
CREATE INDEX IF NOT EXISTS idx_saatler_hat_no ON hareket_saatleri (hat_no);

-- Row Level Security (RLS) - Okuma herkese açık, yazma sadece service_role
ALTER TABLE backup_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hatlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE duraklar ENABLE ROW LEVEL SECURITY;
ALTER TABLE guzergah_noktalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE hareket_saatleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE duraktan_gecen_hatlar ENABLE ROW LEVEL SECURITY;

-- Public okuma politikaları
CREATE POLICY "Public read backup_runs" ON backup_runs FOR SELECT USING (true);
CREATE POLICY "Public read hatlar" ON hatlar FOR SELECT USING (true);
CREATE POLICY "Public read duraklar" ON duraklar FOR SELECT USING (true);
CREATE POLICY "Public read guzergah_noktalari" ON guzergah_noktalari FOR SELECT USING (true);
CREATE POLICY "Public read hareket_saatleri" ON hareket_saatleri FOR SELECT USING (true);
CREATE POLICY "Public read duraktan_gecen_hatlar" ON duraktan_gecen_hatlar FOR SELECT USING (true);

-- Service role yazma politikaları (INSERT, UPDATE, DELETE)
CREATE POLICY "Service write backup_runs" ON backup_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write hatlar" ON hatlar FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write duraklar" ON duraklar FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write guzergah_noktalari" ON guzergah_noktalari FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write hareket_saatleri" ON hareket_saatleri FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write duraktan_gecen_hatlar" ON duraktan_gecen_hatlar FOR ALL USING (auth.role() = 'service_role');

