import { useEffect, useMemo, useState } from "react";

// --------------- types ---------------

interface Hat {
  hat_no: string;
  hat_adi: string | null;
  hat_baslangic: string | null;
  hat_bitis: string | null;
}

interface HatlarPayload {
  total: number;
  hatlar: Hat[];
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
  yon: number | null;
  kalkis_saati: string | null;
  aciklama: string | null;
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

// --------------- component ---------------

function App() {
  const [hatlar, setHatlar] = useState<Hat[]>([]);
  const [selectedHatNo, setSelectedHatNo] = useState<string>("");
  const [detail, setDetail] = useState<HatDetail | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<DetailTab>("duraklar");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hat listesini yukle
  useEffect(() => {
    let active = true;
    fetch("data/hatlar.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HatlarPayload>;
      })
      .then((payload) => {
        if (!active) return;
        setHatlar(payload.hatlar);
        if (payload.hatlar.length > 0) setSelectedHatNo(payload.hatlar[0].hat_no);
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

  // secilen hat detayini yukle
  useEffect(() => {
    if (!selectedHatNo) return;
    let active = true;
    setLoadingDetail(true);
    setDetail(null);
    const safeNo = selectedHatNo.replace(/[^a-zA-Z0-9._-]/g, "_");
    fetch(`data/hat/${safeNo}.json`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HatDetail>;
      })
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedHatNo]);

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
                        <th className="px-4 py-3 font-semibold">Durak ID</th>
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
                        detail.duraklar.map((d) => (
                          <tr key={d.durak_id} className="hover:bg-slate-50">
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
                {activeTab === "saatler" && (
                  <div className="p-4 grid gap-4 sm:grid-cols-2">
                    {(["1", "2"] as const).map((yon) => {
                      const rows = detail.saatler.filter(
                        (s) => String(s.yon) === yon
                      );
                      return (
                        <div
                          key={yon}
                          className="overflow-hidden rounded-xl border border-slate-200"
                        >
                          <div
                            className={`px-4 py-2.5 text-sm font-semibold ${
                              yon === "1"
                                ? "bg-green-50 text-green-700"
                                : "bg-orange-50 text-orange-700"
                            }`}
                          >
                            {yon === "1" ? "Gidiş" : "Dönüş"} Saatleri
                            <span className="ml-1.5 font-normal opacity-70">
                              ({rows.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 p-3">
                            {rows.length === 0 ? (
                              <span className="text-sm text-slate-400">Kayıt yok.</span>
                            ) : (
                              rows.map((s, i) => (
                                <span
                                  key={i}
                                  className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm text-slate-700"
                                >
                                  {s.kalkis_saati ?? "-"}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
