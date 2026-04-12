import { useEffect, useMemo, useState, useCallback } from "react";
import initSqlJs, { Database } from "sql.js";

// --------------- types ---------------

interface Hat {
  hat_no: string;
  hat_adi: string | null;
  hat_baslangic: string | null;
  hat_bitis: string | null;
}

interface Durak {
  durak_id: number;
  durak_adi: string | null;
  enlem: number | null;
  boylam: number | null;
}

interface GuzergahNokta {
  yon: number | null;
  sira: number;
  enlem: number | null;
  boylam: number | null;
}

interface HareketSaati {
  tarife_id: number | null;
  sira: number | null;
  gidis_saati: string | null;
  donus_saati: string | null;
  gidis_engelli_destegi: number | null;
  donus_engelli_destegi: number | null;
  bisikletli_gidis: number | null;
  bisikletli_donus: number | null;
  gidis_elektrikli_otobus: number | null;
  donus_elektrikli_otobus: number | null;
}

interface HatDetail {
  hat_no: string;
  hat_adi: string | null;
  hat_baslangic: string | null;
  hat_bitis: string | null;
  duraklar: Durak[];
  guzergah: GuzergahNokta[];
  saatler: HareketSaati[];
}

type DetailTab = "duraklar" | "guzergah" | "saatler";

// --------------- db helper ---------------

async function loadDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: () => `/sql-wasm.wasm`,
  });
  const response = await fetch("data/eshot.db");
  if (!response.ok) throw new Error(`DB yüklenemedi: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}

function queryHatlar(db: Database): Hat[] {
  const stmt = db.prepare(`
    SELECT hat_no, hat_adi, hat_baslangic, hat_bitis
    FROM hatlar
    ORDER BY CAST(hat_no AS INTEGER), hat_no
  `);
  const results: Hat[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Hat;
    results.push(row);
  }
  stmt.free();
  return results;
}

function queryHatDetail(db: Database, hatNo: string): HatDetail | null {
  // Hat bilgisi
  const hatStmt = db.prepare(`
    SELECT hat_no, hat_adi, hat_baslangic, hat_bitis
    FROM hatlar WHERE hat_no = ?
  `);
  hatStmt.bind([hatNo]);
  if (!hatStmt.step()) {
    hatStmt.free();
    return null;
  }
  const hat = hatStmt.getAsObject() as Hat;
  hatStmt.free();

  // Duraklar - doğrudan duraklar tablosundan hat_no ile çekiyoruz
  const durakStmt = db.prepare(`
    SELECT d.durak_id, d.durak_adi, d.enlem, d.boylam
    FROM duraktan_gecen_hatlar dgh
    JOIN duraklar d ON d.durak_id = dgh.durak_id
    WHERE dgh.hat_no = ?
       OR dgh.hat_no LIKE ? || '-%'
       OR dgh.hat_no LIKE '%-' || ?
       OR dgh.hat_no LIKE '%-' || ? || '-%'
    ORDER BY d.durak_id
  `);
  durakStmt.bind([hatNo, hatNo, hatNo, hatNo]);
  const duraklar: Durak[] = [];
  while (durakStmt.step()) {
    duraklar.push(durakStmt.getAsObject() as Durak);
  }
  durakStmt.free();

  // Güzergah
  const guzergahStmt = db.prepare(`
    SELECT yon, sira, enlem, boylam
    FROM guzergah_noktalari
    WHERE hat_no = ?
    ORDER BY yon, sira
  `);
  guzergahStmt.bind([hatNo]);
  const guzergah: GuzergahNokta[] = [];
  while (guzergahStmt.step()) {
    guzergah.push(guzergahStmt.getAsObject() as GuzergahNokta);
  }
  guzergahStmt.free();

  // Saatler
  const saatStmt = db.prepare(`
    SELECT DISTINCT tarife_id, sira, gidis_saati, donus_saati,
           gidis_engelli_destegi, donus_engelli_destegi,
           bisikletli_gidis, bisikletli_donus,
           gidis_elektrikli_otobus, donus_elektrikli_otobus
    FROM hareket_saatleri
    WHERE hat_no = ?
    ORDER BY sira
  `);
  saatStmt.bind([hatNo]);
  const saatler: HareketSaati[] = [];
  while (saatStmt.step()) {
    saatler.push(saatStmt.getAsObject() as HareketSaati);
  }
  saatStmt.free();

  return {
    ...hat,
    duraklar,
    guzergah,
    saatler,
  };
}

// --------------- component ---------------

function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [hatlar, setHatlar] = useState<Hat[]>([]);
  const [selectedHatNo, setSelectedHatNo] = useState<string>("");
  const [detail, setDetail] = useState<HatDetail | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<DetailTab>("duraklar");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // veritabanını yükle
  useEffect(() => {
    let active = true;
    loadDatabase()
      .then((database) => {
        if (!active) {
          database.close();
          return;
        }
        setDb(database);
        const hatlarData = queryHatlar(database);
        setHatlar(hatlarData);
        if (hatlarData.length > 0) {
          setSelectedHatNo(hatlarData[0].hat_no);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // seçilen hat detayını yükle
  const loadDetail = useCallback((hatNo: string) => {
    if (!db || !hatNo) return;
    setLoadingDetail(true);
    setDetail(null);
    try {
      const hatDetail = queryHatDetail(db, hatNo);
      setDetail(hatDetail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDetail(false);
    }
  }, [db]);

  useEffect(() => {
    if (selectedHatNo && db) {
      loadDetail(selectedHatNo);
    }
  }, [selectedHatNo, db, loadDetail]);

  const filteredHatlar = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hatlar;
    return hatlar.filter((h) =>
      `${h.hat_no} ${h.hat_adi ?? ""}`.toLowerCase().includes(q)
    );
  }, [hatlar, search]);

  const selectedHat = hatlar.find((h) => h.hat_no === selectedHatNo);

  const tabLabel: Record<DetailTab, string> = {
    duraklar: "Duraklar",
    guzergah: "Güzergah",
    saatler: "Saatler",
  };

  const tabCount = (tab: DetailTab): number => {
    if (!detail) return 0;
    if (tab === "duraklar") return detail.duraklar.length;
    if (tab === "guzergah") return detail.guzergah.length;
    return detail.saatler.length;
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* ---- Header ---- */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold tracking-tight">İzmir ESHOT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hat güzergahı, duraklar ve hareket saatleri
          </p>

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* arama */}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Hat ara</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="text"
                placeholder="Hat no veya adı..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            {/* dropdown */}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Hat seç
                {!loadingList && (
                  <span className="ml-1.5 text-xs font-normal text-slate-400">
                    ({filteredHatlar.length} hat)
                  </span>
                )}
              </span>
              <select
                value={selectedHatNo}
                onChange={(e) => {
                  setSelectedHatNo(e.target.value);
                  setActiveTab("duraklar");
                }}
                disabled={loadingList}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
              >
                {loadingList ? (
                  <option>Yükleniyor...</option>
                ) : (
                  filteredHatlar.map((h) => (
                    <option key={h.hat_no} value={h.hat_no}>
                      {h.hat_no} – {h.hat_adi ?? "İsimsiz"}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          {/* secilen hat ozet */}
          {selectedHat && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
              <div>
                <p className="font-semibold text-indigo-800">
                  Hat {selectedHat.hat_no} — {selectedHat.hat_adi ?? "İsimsiz Hat"}
                </p>
                <p className="mt-0.5 text-sm text-indigo-600">
                  {selectedHat.hat_baslangic ?? "?"}{" "}→{" "}{selectedHat.hat_bitis ?? "?"}
                </p>
              </div>
              {detail && (
                <div className="flex gap-3 text-xs text-indigo-700">
                  <span className="rounded-lg bg-indigo-100 px-2 py-1 font-semibold">
                    {detail.duraklar.length} durak
                  </span>
                  <span className="rounded-lg bg-indigo-100 px-2 py-1 font-semibold">
                    {detail.saatler.length} saat
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ---- Detail ---- */}
        {selectedHatNo && (
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

            {/* sekmeler */}
            <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
              {(["duraklar", "guzergah", "saatler"] as DetailTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tabLabel[tab]}
                  {detail && (
                    <span className="ml-1.5 text-xs opacity-70">
                      ({tabCount(tab)})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {loadingDetail && (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Yükleniyor...
              </div>
            )}

            {!loadingDetail && detail && (
              <div className="overflow-x-auto">

                {/* Duraklar */}
                {activeTab === "duraklar" && (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">ID</th>
                        <th className="px-4 py-3 font-semibold">Durak Adı</th>
                        <th className="px-4 py-3 font-semibold">Koordinat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.duraklar.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                            Bu hat için durak kaydı yok.
                          </td>
                        </tr>
                      ) : (
                        detail.duraklar.map((d, i) => (
                          <tr key={`${d.durak_id}-${i}`} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-400">
                              {d.durak_id}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {d.durak_adi ?? "-"}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                              {d.enlem != null && d.boylam != null
                                ? `${d.enlem.toFixed(5)}, ${d.boylam.toFixed(5)}`
                                : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {/* Guzergah */}
                {activeTab === "guzergah" && (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Yön</th>
                        <th className="px-4 py-3 font-semibold">Sıra</th>
                        <th className="px-4 py-3 font-semibold">Enlem</th>
                        <th className="px-4 py-3 font-semibold">Boylam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.guzergah.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                            Bu hat için güzergah kaydı yok.
                          </td>
                        </tr>
                      ) : (
                        detail.guzergah.map((g, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  g.yon === 1
                                    ? "bg-green-100 text-green-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {g.yon === 1 ? "Gidiş" : "Dönüş"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                              {g.sira}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                              {g.enlem?.toFixed(6) ?? "-"}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                              {g.boylam?.toFixed(6) ?? "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {/* Saatler */}
                {activeTab === "saatler" && (() => {
                  const tarifeler = [
                    { id: 1, label: "Hafta İçi", bgClass: "bg-blue-50", textClass: "text-blue-700" },
                    { id: 2, label: "Cumartesi", bgClass: "bg-purple-50", textClass: "text-purple-700" },
                    { id: 3, label: "Pazar", bgClass: "bg-rose-50", textClass: "text-rose-700" },
                  ];

                  return (
                    <div className="p-4 space-y-6">
                      {tarifeler.map((tarife) => {
                        const tarifeSaatleri = detail.saatler
                          .filter((s) => s.tarife_id === tarife.id)
                          .sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0));

                        if (tarifeSaatleri.length === 0) return null;

                        return (
                          <div key={tarife.id} className="space-y-3">
                            <h3 className={`text-lg font-semibold ${tarife.textClass}`}>
                              {tarife.label}
                              <span className="ml-2 text-sm font-normal opacity-70">
                                ({tarifeSaatleri.length} sefer)
                              </span>
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {(["gidis", "donus"] as const).map((yon) => {
                                const saatKey = yon === "gidis" ? "gidis_saati" : "donus_saati";
                                const rows = tarifeSaatleri.filter((s) => s[saatKey] !== null);
                                return (
                                  <div
                                    key={yon}
                                    className="overflow-hidden rounded-xl border border-slate-200"
                                  >
                                    <div
                                      className={`px-4 py-2.5 text-sm font-semibold ${
                                        yon === "gidis"
                                          ? "bg-green-50 text-green-700"
                                          : "bg-orange-50 text-orange-700"
                                      }`}
                                    >
                                      {yon === "gidis" ? "Gidiş" : "Dönüş"} Saatleri
                                      <span className="ml-1.5 font-normal opacity-70">
                                        ({rows.length})
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 p-3">
                                      {rows.length === 0 ? (
                                        <span className="text-sm text-slate-400">Kayıt yok.</span>
                                      ) : (
                                        rows.map((s, i) => {
                                          const saat = yon === "gidis" ? s.gidis_saati : s.donus_saati;
                                          const engelliDestegi = yon === "gidis" ? s.gidis_engelli_destegi : s.donus_engelli_destegi;
                                          const bisikletli = yon === "gidis" ? s.bisikletli_gidis : s.bisikletli_donus;
                                          const elektrikli = yon === "gidis" ? s.gidis_elektrikli_otobus : s.donus_elektrikli_otobus;
                                          return (
                                            <span
                                              key={i}
                                              className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm text-slate-700 flex items-center gap-1"
                                              title={[
                                                engelliDestegi ? "♿ Engelli desteği" : null,
                                                bisikletli ? "🚲 Bisikletli" : null,
                                                elektrikli ? "⚡ Elektrikli" : null,
                                              ].filter(Boolean).join(", ") || undefined}
                                            >
                                              {saat ?? "-"}
                                              {engelliDestegi === 1 && <span className="text-xs">♿</span>}
                                              {bisikletli === 1 && <span className="text-xs">🚲</span>}
                                              {elektrikli === 1 && <span className="text-xs">⚡</span>}
                                            </span>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
