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
  [key: string]: unknown;
}

interface EshotIndexEntry {
  hatNo: string;
  folder: string;
  hatAdi?: string;
  baslangic?: string;
  bitis?: string;
  counts?: {
    duraklar?: number;
    guzergah?: number;
    saatler?: number;
  };
}

interface EshotIndexPayload {
  updatedAt?: string;
  hatlar?: EshotIndexEntry[];
}

interface DurakPayload {
  duraklar?: EshotHat[];
}

interface GuzergahPayload {
  guzergah?: EshotHat[];
}

interface SaatPayload {
  saatler?: EshotHat[];
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
  const [hatlar, setHatlar] = useState<EshotIndexEntry[]>([]);
  const [selectedHat, setSelectedHat] = useState<EshotIndexEntry | null>(null);
  const [duraklar, setDuraklar] = useState<EshotHat[]>([]);
  const [guzergah, setGuzergah] = useState<EshotHat[]>([]);
  const [saatler, setSaatler] = useState<EshotHat[]>([]);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState("-");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadIndex = async () => {
      try {
        const response = await fetch("data/eshot/index.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`index: HTTP ${response.status}`);
        }

        const payload = (await response.json()) as EshotIndexPayload;
        const rows = Array.isArray(payload.hatlar) ? payload.hatlar : [];

        if (!active) return;

        setHatlar(rows);
        if (rows.length > 0) {
          setSelectedHat(rows[0]);
        }
        setUpdatedAt(formatDate(payload.updatedAt));
        setError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        setError(`Veri okuma hatasi: ${message}`);
      } finally {
        if (active) setLoadingList(false);
      }
    };

    void loadIndex();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedHat) return;

    let active = true;
    const loadHatDetails = async () => {
      setLoadingDetails(true);
      try {
        const base = `data/eshot/${selectedHat.folder}`;
        const [durakRes, guzRes, saatRes] = await Promise.all([
          fetch(`${base}/duraklar.json`, { cache: "no-store" }),
          fetch(`${base}/guzergah.json`, { cache: "no-store" }),
          fetch(`${base}/saatler.json`, { cache: "no-store" }),
        ]);

        if (!durakRes.ok || !guzRes.ok || !saatRes.ok) {
          throw new Error(`hat detayi okunamadi (${selectedHat.hatNo})`);
        }

        const durakPayload = (await durakRes.json()) as DurakPayload;
        const guzPayload = (await guzRes.json()) as GuzergahPayload;
        const saatPayload = (await saatRes.json()) as SaatPayload;

        if (!active) return;
        setDuraklar(Array.isArray(durakPayload.duraklar) ? durakPayload.duraklar : []);
        setGuzergah(Array.isArray(guzPayload.guzergah) ? guzPayload.guzergah : []);
        setSaatler(Array.isArray(saatPayload.saatler) ? saatPayload.saatler : []);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        setError(`Hat detayi okunamadi: ${message}`);
      } finally {
        if (active) setLoadingDetails(false);
      }
    };

    void loadHatDetails();
    return () => {
      active = false;
    };
  }, [selectedHat]);

  const filteredHatlar = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return hatlar;
    return hatlar.filter((item) => {
      const text = `${item.hatNo} ${item.hatAdi || ""}`.toLowerCase();
      return text.includes(normalized);
    });
  }, [query, hatlar]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold tracking-tight">Izmir ESHOT Hatlari</h1>
          <p className="mt-2 text-sm text-slate-600">
            Kaynak: <code>data/eshot/index.json</code> ve hat bazli klasorler
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Hat no ara</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="text"
                placeholder="Hat no veya hat adi ara"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Guncelleme</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{updatedAt}</p>
            </div>
          </div>

        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold">Hat Listesi</h2>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {filteredHatlar.length} kayit
              </span>
            </div>

            {loadingList ? <div className="px-4 py-6 text-sm text-slate-500">Liste yukleniyor...</div> : null}
            {!loadingList && error ? <div className="px-4 py-6 text-sm text-rose-600">{error}</div> : null}

            {!loadingList && !error && filteredHatlar.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">Sonuc bulunamadi.</div>
            ) : null}

            {!loadingList && !error && filteredHatlar.length > 0 ? (
              <div className="max-h-[520px] overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Hat</th>
                      <th className="px-4 py-3 font-semibold">Hat Adi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHatlar.map((item) => (
                      <tr
                        key={item.hatNo}
                        className={`cursor-pointer hover:bg-slate-50 ${
                          selectedHat?.hatNo === item.hatNo ? "bg-indigo-50" : ""
                        }`}
                        onClick={() => setSelectedHat(item)}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.hatNo}</td>
                        <td className="px-4 py-3 text-slate-700">{item.hatAdi || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold">Hat Detayi</h2>
            </div>

            {!selectedHat ? <div className="px-4 py-6 text-sm text-slate-500">Bir hat secin.</div> : null}
            {selectedHat && loadingDetails ? <div className="px-4 py-6 text-sm text-slate-500">Detay yukleniyor...</div> : null}

            {selectedHat && !loadingDetails ? (
              <div className="space-y-4 px-4 py-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedHat.hatNo} - {selectedHat.hatAdi || "Isimsiz Hat"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedHat.baslangic || "-"}{" -> "}{selectedHat.bitis || "-"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Durak</p>
                    <p className="text-lg font-semibold text-slate-900">{duraklar.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Guzergah Noktasi</p>
                    <p className="text-lg font-semibold text-slate-900">{guzergah.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Saat Kaydi</p>
                    <p className="text-lg font-semibold text-slate-900">{saatler.length}</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Ornek Duraklar</h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {duraklar.slice(0, 6).map((durak, idx) => (
                      <li className="rounded-lg border border-slate-200 px-3 py-2" key={`${durak.DURAK_ID || idx}`}>
                        {durak.DURAK_ADI || "Durak"} ({durak.DURAK_ID || "-"})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}

export default App;
