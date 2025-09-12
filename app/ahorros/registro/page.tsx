"use client";
import { useEffect, useMemo, useState } from "react";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };
type AhorroItem = {
  id: number;
  rondaId: number;
  rondaNombre?: string;
  semana: number;
  monto: number | string;
  fecha: string;
};
type HistorialResp = {
  items: AhorroItem[];
  saldo?: number | string;
};

const fmtMoney = (n: number, currency = "USD", locale = "es-EC") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDate = (iso: string | Date | null | undefined, locale = "es-EC") => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function AhorrosRegistroPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  const [items, setItems] = useState<AhorroItem[]>([]);
  const [saldo, setSaldo] = useState<number>(0);

  const [loadingSocios, setLoadingSocios] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar socios
  useEffect(() => {
    (async () => {
      try {
        setLoadingSocios(true);
        const r = await fetch("/api/socios");
        const list = await r.json();
        setSocios(Array.isArray(list) ? list : []);
      } catch {
        setSocios([]);
      } finally {
        setLoadingSocios(false);
      }
    })();
  }, []);

  // Cargar historial al cambiar socio o fechas
  useEffect(() => {
    if (!selectedId) {
      setItems([]);
      setSaldo(0);
      return;
    }
    (async () => {
      try {
        setError(null);
        setLoadingHist(true);
        const params = new URLSearchParams();
        params.set("socioId", String(selectedId));
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
        const r = await fetch(`/api/ahorros?${params.toString()}`, { cache: "no-store" });
        const data: HistorialResp | AhorroItem[] = await r.json();

        const arr = Array.isArray(data) ? data : data.items ?? [];
        setItems(arr);

        // saldo: usa el enviado por API; si no, calcula
        const s = !Array.isArray(data) && data.saldo != null
          ? Number(data.saldo)
          : arr.reduce((acc, it) => acc + Number(it.monto || 0), 0);
        setSaldo(s);
      } catch (e: any) {
        setError(e?.message || "No se pudo cargar el historial");
        setItems([]);
        setSaldo(0);
      } finally {
        setLoadingHist(false);
      }
    })();
  }, [selectedId, desde, hasta]);

  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return socios;
    return socios.filter((x) =>
      [x.nombres, x.apellidos, x.numeroCuenta].some((v) => String(v).toLowerCase().includes(s))
    );
  }, [socios, q]);

  const totalAhorros = items.reduce((acc, it) => acc + Number(it.monto || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header cajoncito */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Historial de ahorros</h1>
            <p className="text-sm text-gray-600">Consulta aportes de ahorro por socio y por fecha.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Socios */}
        <aside className="rounded-xl border bg-white p-6 shadow-sm md:col-span-1">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Socios</h2>
          </div>
          <div className="mb-3">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Buscar por nombre o cuenta…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {loadingSocios ? (
            <p className="text-gray-500">Cargando socios…</p>
          ) : sociosFiltrados.length === 0 ? (
            <p className="text-gray-500">Sin resultados.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {sociosFiltrados.map((s) => {
                const active = selectedId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={cx(
                        "w-full text-left p-3 hover:bg-gray-50 flex items-start justify-between gap-3",
                        active && "bg-gray-50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {s.nombres} {s.apellidos}
                        </p>
                        <p className="truncate text-xs text-gray-500">Cuenta {s.numeroCuenta}</p>
                      </div>
                      {active && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Activo
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Detalle */}
        <main className="rounded-xl border bg-white p-6 shadow-sm md:col-span-2 space-y-4">
          {!selectedId ? (
            <div className="text-gray-600">Selecciona un socio para ver su historial.</div>
          ) : (
            <>
              {/* Filtros + saldo */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Desde</label>
                    <input
                      type="date"
                      className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      value={desde}
                      onChange={(e) => setDesde(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Hasta</label>
                    <input
                      type="date"
                      className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      value={hasta}
                      onChange={(e) => setHasta(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => { setDesde(""); setHasta(""); }}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-right">
                  <p className="text-xs text-gray-500">Saldo acumulado</p>
                  <p className="text-xl font-semibold">{fmtMoney(saldo)}</p>
                </div>
              </div>

              {error && <div className="rounded-md bg-red-50 p-3 text-red-700">{error}</div>}

              {loadingHist ? (
                <p className="text-gray-500">Cargando historial…</p>
              ) : items.length === 0 ? (
                <p className="text-gray-600">No hay ahorros registrados para el criterio seleccionado.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full table-auto text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-4 py-2">Fecha</th>
                        <th className="px-4 py-2">Ronda</th>
                        <th className="px-4 py-2">Semana</th>
                        <th className="px-4 py-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((it) => (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{fmtDate(it.fecha)}</td>
                          <td className="px-4 py-2">{it.rondaNombre ?? `#${it.rondaId}`}</td>
                          <td className="px-4 py-2">{it.semana}</td>
                          <td className="px-4 py-2 text-right">{fmtMoney(Number(it.monto))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-medium">
                        <td className="px-4 py-2" colSpan={3}>Total mostrado</td>
                        <td className="px-4 py-2 text-right">{fmtMoney(totalAhorros)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
