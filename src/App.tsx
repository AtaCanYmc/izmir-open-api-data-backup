import { useEffect, useMemo, useState } from "react";

interface EshotHat {
  HAT_NO?: string | number;
  HAT_ADI?: string;
  HAT_BASLANGIC?: string;
  HAT_BITIS?: string;
  DURAK_ADI?: string;
  DURAK_ID?: number;
  ENLEM?: number;
  BOYLAM?: number;
  YON?: number;
}

interface DataPayload {
  updatedAt?: string;
  hatlar?: EshotHat[];
  duraklar?: EshotHat[];
  guzergahlar?: EshotHat[];
  saatler?: EshotHat[];
}

type TabType = "hatlar" | "duraklar" | "guzergahlar" | "saatler";

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function App() {
  const [rows, setRows] = useState<EshotHat[]>([]);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState("-");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("hatlar");
  const [allData, setAllData] = useState<Record<TabType, EshotHat[]>>({
    hatlar: [],
    duraklar: [],
    guzergahlar: [],
    saatler: [],
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const files = [
          { tab: "hatlar" as TabType, file: "data/eshot-hatlar.json" },
          { tab: "duraklar" as TabType, file: "data/eshot-duraklar.json" },
          { tab: "guzergahlar" as TabType, file: "data/eshot-guzergahlar.json" },
          { tab: "saatler" as TabType, file: "data/eshot-hareket-saatleri.json" },
        ];

        const results = await Promise.all(
          files.map(async ({ tab, file }) => {
            const response = await fetch(file, { cache: "no-store" });
            if (!response.ok) throw new Error(`${tab}: HTTP ${response.status}`);
            const payload = (await response.json()) as DataPayload;
            const data =
              payload[tab] ||
              (tab === "saatler" ? payload.saatler : undefined) ||
              [];
            return { tab, data: Array.isArray(data) ? data : [] };
          })
        );

        if (!active) return;

        const newData = { hatlar: [], duraklar: [], guzergahlar: [], saatler: [] };
        for (const { tab, data } of results) {
          newData[tab] = data;
        }
        setAllData(newData);
        setRows(newData.hatlar);
        const firstPayload = await fetch("data/eshot-hatlar.json", { cache: "no-store" }).then((r) => r.json()) as DataPayload;
        setUpdatedAt(formatDate(firstPayload.updatedAt));
        setError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        setError(`Veri okuma hatasi: ${message}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setRows(allData[activeTab]);
    setQuery("");
  }, [activeTab, allData]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((item) => String(item.HAT_NO ?? "").toLowerCase().includes(normalized));
  }, [query, rows]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold tracking-tight">Izmir ESHOT Hatlari</h1>
          <p className="mt-2 text-sm text-slate-600">
            Kaynak: <code>data/eshot-*.json</code> (4 dosya)
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Hat no ara</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="text"
                placeholder="Hat/Durak ara"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Guncelleme</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{updatedAt}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["hatlar", "duraklar", "guzergahlar", "saatler"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {filteredRows.length} kayit
            </span>
          </div>

          {loading ? <div className="px-4 py-6 text-sm text-slate-500">Veri yukleniyor...</div> : null}
          {!loading && error ? <div className="px-4 py-6 text-sm text-rose-600">{error}</div> : null}

          {!loading && !error && filteredRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Sonuc bulunamadi.</div>
          ) : null}

          {!loading && !error && filteredRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    {activeTab === "hatlar" && (
                      <>
                        <th className="px-4 py-3 font-semibold">Hat No</th>
                        <th className="px-4 py-3 font-semibold">Hat Adi</th>
                        <th className="px-4 py-3 font-semibold">Baslangic</th>
                        <th className="px-4 py-3 font-semibold">Bitis</th>
                      </>
                    )}
                    {activeTab === "duraklar" && (
                      <>
                        <th className="px-4 py-3 font-semibold">Durak ID</th>
                        <th className="px-4 py-3 font-semibold">Durak Adi</th>
                        <th className="px-4 py-3 font-semibold">Koordinat</th>
                      </>
                    )}
                    {activeTab === "guzergahlar" && (
                      <>
                        <th className="px-4 py-3 font-semibold">Hat No</th>
                        <th className="px-4 py-3 font-semibold">Yon</th>
                        <th className="px-4 py-3 font-semibold">Konum</th>
                      </>
                    )}
                    {activeTab === "saatler" && (
                      <>
                        <th className="px-4 py-3 font-semibold">Bilgi</th>
                        <th className="px-4 py-3 font-semibold">Deger</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === "hatlar" &&
                    filteredRows.map((item, idx) => (
                      <tr className="hover:bg-slate-50" key={idx}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.HAT_NO ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{item.HAT_ADI ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.HAT_BASLANGIC ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.HAT_BITIS ?? "-"}</td>
                      </tr>
                    ))}
                  {activeTab === "duraklar" &&
                    filteredRows.map((item, idx) => (
                      <tr className="hover:bg-slate-50" key={idx}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.DURAK_ID ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{item.DURAK_ADI ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.ENLEM?.toFixed(6)}, {item.BOYLAM?.toFixed(6)}
                        </td>
                      </tr>
                    ))}
                  {activeTab === "guzergahlar" &&
                    filteredRows.map((item, idx) => (
                      <tr className="hover:bg-slate-50" key={idx}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.HAT_NO ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{item.YON === 1 ? "Gidiş" : "Dönüş"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          ({item.ENLEM?.toFixed(4)}, {item.BOYLAM?.toFixed(4)})
                        </td>
                      </tr>
                    ))}
                  {activeTab === "saatler" &&
                    filteredRows.slice(0, 50).map((item, idx) => (
                      <tr className="hover:bg-slate-50" key={idx}>
                        <td className="px-4 py-3 text-slate-700">
                          {Object.keys(item).slice(0, 1).join(", ")}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {JSON.stringify(item).slice(0, 80)}...
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default App;
