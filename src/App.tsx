import { useEffect, useMemo, useState } from "react";

interface EshotHat {
  HAT_NO?: string | number;
  HAT_ADI?: string;
  HAT_BASLANGIC?: string;
  HAT_BITIS?: string;
}

interface HatPayload {
  updatedAt?: string;
  hatlar?: EshotHat[];
}

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

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("data/eshot-hatlar.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as HatPayload;
        if (!active) return;

        setRows(Array.isArray(payload.hatlar) ? payload.hatlar : []);
        setUpdatedAt(formatDate(payload.updatedAt));
        setError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        setError(`Veri okunamadi: ${message}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

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
            Kaynak: <code>data/eshot-hatlar.json</code>
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Hat no ara</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="text"
                placeholder="Orn: 121"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Guncelleme</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{updatedAt}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold">Hat Listesi</h2>
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
                    <th className="px-4 py-3 font-semibold">Hat No</th>
                    <th className="px-4 py-3 font-semibold">Hat Adi</th>
                    <th className="px-4 py-3 font-semibold">Baslangic</th>
                    <th className="px-4 py-3 font-semibold">Bitis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((item, idx) => (
                    <tr className="hover:bg-slate-50" key={`${String(item.HAT_NO ?? "-")}-${idx}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.HAT_NO ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{item.HAT_ADI ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{item.HAT_BASLANGIC ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{item.HAT_BITIS ?? "-"}</td>
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
