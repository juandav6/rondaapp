// app/ahorros/registro/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };
type AhorroItem = {
  id: string | number;
  tipo?: string;
  rondaId: number | null;
  rondaNombre?: string | null;
  semana: number | null;
  monto: number | string;
  fecha: string;
  nota?: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function AhorrosRegistroPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSocio, setSelectedSocio] = useState<Socio | null>(null);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [items, setItems] = useState<AhorroItem[]>([]);
  const [saldo, setSaldo] = useState(0);

  const [loadingSocios, setLoadingSocios] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevoMonto, setNuevoMonto] = useState("");

  useEffect(() => {
    fetch("/api/socios").then(r => r.json()).then(l => setSocios(Array.isArray(l) ? l : [])).catch(() => setSocios([])).finally(() => setLoadingSocios(false));
  }, []);

  async function cargarHistorial(socioId: number, d?: string, h?: string) {
    setLoadingHist(true);
    try {
      setError(null);
      const params = new URLSearchParams({ socioId: String(socioId) });
      if (d) params.set("desde", d);
      if (h) params.set("hasta", h);
      const data = await fetch(`/api/ahorros?${params}`, { cache: "no-store" }).then(r => r.json());
      setItems(Array.isArray(data) ? data : (data.items ?? []));
      setSaldo(!Array.isArray(data) && data.saldo != null ? Number(data.saldo) : 0);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el historial");
      setItems([]); setSaldo(0);
    } finally { setLoadingHist(false); }
  }

  useEffect(() => {
    if (!selectedId) { setItems([]); setSaldo(0); return; }
    cargarHistorial(selectedId, desde, hasta);
  }, [selectedId, desde, hasta]);

  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s))) : socios;
  }, [socios, q]);

  const totalMostrado = items.reduce((a, it) => a + Number(it.monto || 0), 0);

  async function agregarDeposito() {
    if (!selectedId) return;
    const monto = Number(nuevoMonto);
    if (!monto || monto <= 0) { setError("Ingresa un monto válido mayor a 0"); return; }
    try {
      setSaving(true); setError(null); setOkMsg(null);
      const res = await fetch("/api/ahorros/deposito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId: selectedId, monto, ...(nuevaFecha ? { fecha: nuevaFecha } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al registrar");
      setOkMsg("Depósito registrado correctamente");
      setNuevaFecha(""); setNuevoMonto("");
      setTimeout(() => setOkMsg(null), 3000);
      await cargarHistorial(selectedId, desde, hasta);
    } catch (e: any) { setError(e?.message); }
    finally { setSaving(false); }
  }

  const tipoConfig: Record<string, { label: string; color: string; bg: string; signo: string }> = {
    ronda: { label: "Ahorro ronda", color: "text-emerald-700", bg: "bg-emerald-100", signo: "+" },
    deposito: { label: "Depósito libre", color: "text-blue-700", bg: "bg-blue-100", signo: "+" },
    retiro: { label: "Retiro", color: "text-rose-700", bg: "bg-rose-100", signo: "−" },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/>
              <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd"/>
              <path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.075 1.19.324 2.4-.558 2.4-1.82V18.75a.75.75 0 0 0-.75-.75H2.25Z"/>
            </svg>
          </span>
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Depósitos de ahorros</h1>
            <p className="text-xs sm:text-sm text-gray-500">Registra depósitos libres y consulta el historial por socio.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Panel socios */}
        <aside className="rounded-xl border bg-white shadow-sm overflow-hidden lg:col-span-1">
          <div className="border-b bg-gray-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Seleccionar socio</h2>
          </div>
          <div className="p-3">
            <div className="relative">
              <input className="w-full rounded-lg border px-3 py-2 pl-8 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Buscar por nombre o cuenta…" value={q} onChange={e => setQ(e.target.value)} />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none">
                <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.05l3.725 3.725a.75.75 0 1 0 1.06-1.06l-3.724-3.725A6.75 6.75 0 0 0 10.5 3.75Z" clipRule="evenodd"/>
              </svg>
            </div>
          </div>
          {loadingSocios ? (
            <div className="px-4 pb-4 text-sm text-gray-400">Cargando socios…</div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto divide-y">
              {sociosFiltrados.map(s => {
                const active = selectedId === s.id;
                return (
                  <li key={s.id}>
                    <button onClick={() => { setSelectedId(s.id); setSelectedSocio(s); }}
                      className={cx("w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3", active && "bg-emerald-50/60 border-l-2 border-emerald-500")}>
                      <div className="min-w-0">
                        <p className={cx("truncate text-sm font-medium", active ? "text-emerald-800" : "text-gray-900")}>
                          {s.nombres} {s.apellidos}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                      </div>
                      {active && <span className="shrink-0 inline-flex h-2 w-2 rounded-full bg-emerald-500" />}
                    </button>
                  </li>
                );
              })}
              {sociosFiltrados.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">Sin resultados</li>}
            </ul>
          )}
        </aside>

        {/* Panel principal */}
        <main className="lg:col-span-2 space-y-4">
          {!selectedId ? (
            <div className="rounded-xl border border-dashed bg-white p-12 text-center text-gray-400 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-gray-200 mx-auto mb-3">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm">Selecciona un socio para ver su historial y registrar depósitos</p>
            </div>
          ) : (
            <>
              {/* Socio seleccionado + saldo */}
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">
                      {selectedSocio?.nombres?.[0]}{selectedSocio?.apellidos?.[0]}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedSocio?.nombres} {selectedSocio?.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{selectedSocio?.numeroCuenta}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Saldo total</p>
                    <p className="text-2xl font-bold text-emerald-700 tabular-nums">{fmt(saldo)}</p>
                  </div>
                </div>
              </div>

              {/* Formulario depósito */}
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs">+</span>
                  Registrar depósito libre
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Fecha (opcional)</label>
                    <input
                      type="date"
                      value={nuevaFecha}
                      onChange={e => setNuevaFecha(e.target.value)}
                      onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer" />
                    <p className="mt-0.5 text-[10px] text-gray-400">Si no se indica, se usa la fecha de hoy</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Monto ($)</label>
                    <input type="number" min="0.01" step="0.01" placeholder="0.00" value={nuevoMonto}
                      onChange={e => setNuevoMonto(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div className="flex flex-col justify-end">
                    <button onClick={agregarDeposito} disabled={saving || !Number(nuevoMonto)}
                      className={cx("rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
                        saving || !Number(nuevoMonto) ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700")}>
                      {saving ? "Guardando…" : "Registrar depósito"}
                    </button>
                  </div>
                </div>
                {okMsg && <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">✓ {okMsg}</div>}
                {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
              </div>

              {/* Historial */}
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Historial de movimientos</p>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(totalMostrado)}</span>
                </div>

                {loadingHist ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                    Cargando historial…
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    No hay movimientos registrados{desde || hasta ? " para el período seleccionado" : ""}.
                  </div>
                ) : (
                  <>
                    {/* Tabla desktop */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-4 py-3 text-left">Fecha</th>
                            <th className="px-4 py-3 text-left">Tipo</th>
                            <th className="px-4 py-3 text-left">Origen</th>
                            <th className="px-4 py-3 text-right">Semana</th>
                            <th className="px-4 py-3 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {items.map((it, i) => {
                            const val = Number(it.monto);
                            const tipo = it.tipo ?? "ronda";
                            const cfg = tipoConfig[tipo] ?? tipoConfig.ronda;
                            return (
                              <tr key={`${it.id}_${i}`} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-600">{fmtDate(it.fecha)}</td>
                                <td className="px-4 py-3">
                                  <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cfg.bg, cfg.color)}>
                                    {cfg.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {it.rondaNombre ?? (it.rondaId ? `#${it.rondaId}` : "—")}
                                  {it.nota && <span className="text-gray-400 ml-1 text-xs">· {it.nota}</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-500">{it.semana ?? "—"}</td>
                                <td className={cx("px-4 py-3 text-right font-semibold tabular-nums", cfg.color)}>
                                  {cfg.signo}{fmt(Math.abs(val))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t bg-gray-50">
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total mostrado</td>
                            <td className={cx("px-4 py-3 text-right font-bold tabular-nums", totalMostrado >= 0 ? "text-emerald-700" : "text-rose-700")}>
                              {fmt(totalMostrado)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Tarjetas móvil */}
                    <ul className="sm:hidden divide-y">
                      {items.map((it, i) => {
                        const val = Number(it.monto);
                        const tipo = it.tipo ?? "ronda";
                        const cfg = tipoConfig[tipo] ?? tipoConfig.ronda;
                        return (
                          <li key={`${it.id}_${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.bg, cfg.color)}>
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">{fmtDate(it.fecha)}</p>
                              <p className="text-xs text-gray-400">{it.rondaNombre ?? "—"}{it.semana ? ` · Sem. ${it.semana}` : ""}</p>
                            </div>
                            <p className={cx("font-semibold tabular-nums shrink-0", cfg.color)}>
                              {cfg.signo}{fmt(Math.abs(val))}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const tipoConfig: Record<string, { label: string; color: string; bg: string; signo: string }> = {
  ronda: { label: "Ahorro ronda", color: "text-emerald-700", bg: "bg-emerald-100", signo: "+" },
  deposito: { label: "Depósito libre", color: "text-blue-700", bg: "bg-blue-100", signo: "+" },
  retiro: { label: "Retiro", color: "text-rose-700", bg: "bg-rose-100", signo: "−" },
};
