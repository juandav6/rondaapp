// app/socios/retiros/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function RetirosAhorroPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSocio, setSelectedSocio] = useState<Socio | null>(null);

  const [saldo, setSaldo] = useState(0);
  const [montoRetiro, setMontoRetiro] = useState("");
  const [fechaRetiro, setFechaRetiro] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });

  const [hayRondaActiva, setHayRondaActiva] = useState(false);
  const [checkingRonda, setCheckingRonda] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/socios").then(r => r.json()).then(l => setSocios(Array.isArray(l) ? l : [])).catch(() => setSocios([])).finally(() => setLoadingSocios(false));
  }, []);

  useEffect(() => {
    fetch("/api/rondas", { cache: "no-store" })
      .then(r => setHayRondaActiva(r.status !== 204))
      .catch(() => setHayRondaActiva(true))
      .finally(() => setCheckingRonda(false));
  }, []);

  async function cargarSaldo(id: number) {
    try {
      setError(null);
      const data = await fetch(`/api/ahorros?socioId=${id}`, { cache: "no-store" }).then(r => r.json());
      setSaldo(!Array.isArray(data) && data.saldo != null ? Number(data.saldo) : 0);
    } catch { setSaldo(0); }
  }

  useEffect(() => {
    if (!selectedId) { setSaldo(0); return; }
    cargarSaldo(selectedId);
  }, [selectedId]);

  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s))) : socios;
  }, [socios, q]);

  const montoNum = Number(montoRetiro);
  const puedeRetirar = !checkingRonda && !hayRondaActiva && !!selectedId && montoNum > 0 && montoNum <= saldo && !!fechaRetiro;
  const pct = saldo > 0 && montoNum > 0 ? Math.min((montoNum / saldo) * 100, 100) : 0;

  async function hacerRetiro() {
    if (!puedeRetirar || !selectedId) return;
    try {
      setLoading(true); setError(null); setOk(null);
      const res = await fetch("/api/ahorros/retiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId: selectedId, monto: montoNum, fecha: fechaRetiro }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al registrar");
      setOk("Retiro registrado correctamente.");
      setMontoRetiro("");
      await cargarSaldo(selectedId);
    } catch (e: any) { setError(e?.message); }
    finally { setLoading(false); setTimeout(() => setOk(null), 3000); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M9.375 3a1.875 1.875 0 0 0 0 3.75h1.875v4.5H3.375A1.875 1.875 0 0 1 1.5 9.375v-.75c0-1.036.84-1.875 1.875-1.875h3.193A3.375 3.375 0 0 1 12 2.753a3.375 3.375 0 0 1 5.432 3.997h3.943c1.035 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875H12.75v-4.5h1.875a1.875 1.875 0 1 0-1.875-1.875V6.75h-1.5V4.875C11.25 3.839 10.41 3 9.375 3ZM11.25 12.75H3v6.75a2.25 2.25 0 0 0 2.25 2.25h6v-9ZM12.75 21.75h6a2.25 2.25 0 0 0 2.25-2.25V12.75h-8.25v9Z"/>
            </svg>
          </span>
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Retiro de ahorros</h1>
            <p className="text-xs sm:text-sm text-gray-500">Registra retiros del saldo libre de un socio.</p>
          </div>
        </div>
      </div>

      {/* Banner ronda activa */}
      {!checkingRonda && hayRondaActiva && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-amber-600 shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Hay una ronda activa</p>
            <p className="text-xs text-amber-600 mt-0.5">Los retiros solo están disponibles cuando no hay una ronda en curso.</p>
          </div>
        </div>
      )}

      {checkingRonda && (
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-400 animate-pulse">Verificando estado de rondas…</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lista socios */}
        <aside className="rounded-xl border bg-white shadow-sm overflow-hidden lg:col-span-1">
          <div className="border-b bg-gray-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Seleccionar socio</h2>
          </div>
          <div className="p-3">
            <div className="relative">
              <input className="w-full rounded-lg border px-3 py-2 pl-8 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
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
                    <button onClick={() => { setSelectedId(s.id); setSelectedSocio(s); setMontoRetiro(""); setError(null); setOk(null); }}
                      className={cx("w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3", active && "bg-rose-50/60 border-l-2 border-rose-500")}>
                      <div className="min-w-0">
                        <p className={cx("truncate text-sm font-medium", active ? "text-rose-800" : "text-gray-900")}>
                          {s.nombres} {s.apellidos}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                      </div>
                      {active && <span className="shrink-0 inline-flex h-2 w-2 rounded-full bg-rose-500" />}
                    </button>
                  </li>
                );
              })}
              {sociosFiltrados.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">Sin resultados</li>}
            </ul>
          )}
        </aside>

        {/* Panel retiro */}
        <main className="lg:col-span-2">
          {!selectedId ? (
            <div className="rounded-xl border border-dashed bg-white p-12 text-center text-gray-400 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-gray-200 mx-auto mb-3">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm">Selecciona un socio para registrar un retiro</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info socio + saldo */}
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 font-bold text-sm">
                      {selectedSocio?.nombres?.[0]}{selectedSocio?.apellidos?.[0]}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedSocio?.nombres} {selectedSocio?.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{selectedSocio?.numeroCuenta}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Saldo disponible</p>
                    <p className="text-2xl font-bold text-emerald-700 tabular-nums">{fmt(saldo)}</p>
                  </div>
                </div>
              </div>

              {/* Formulario */}
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">Registrar retiro</h3>

                <div className="max-w-xs space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Fecha del retiro</label>
                    <div className="relative">
                      <input
                        id="fecha-retiro-input"
                        type="date"
                        value={fechaRetiro}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={e => setFechaRetiro(e.target.value)}
                        disabled={hayRondaActiva}
                        className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-200 disabled:bg-gray-100"
                      />
                      <button
                        type="button"
                        disabled={hayRondaActiva}
                        onClick={() => {
                          const el = document.getElementById("fecha-retiro-input") as HTMLInputElement | null;
                          el?.showPicker?.();
                          el?.focus();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 disabled:opacity-40"
                        tabIndex={-1}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                          <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/>
                        </svg>
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Puedes seleccionar una fecha anterior si el retiro fue en otro día.</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Monto a retirar</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" min="0.01" step="0.01" placeholder="0.00"
                        value={montoRetiro} onChange={e => setMontoRetiro(e.target.value)}
                        disabled={hayRondaActiva}
                        className="w-full rounded-lg border pl-7 pr-3 py-2.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-200 disabled:bg-gray-100" />
                    </div>
                    {montoNum > saldo && saldo > 0 && <p className="mt-1 text-xs text-rose-600">⚠️ Excede el saldo disponible</p>}
                    {montoNum > 0 && montoNum <= saldo && <p className="mt-1 text-xs text-gray-400">Quedará: {fmt(saldo - montoNum)}</p>}
                  </div>

                  {/* Barra visual */}
                  {montoNum > 0 && saldo > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Porcentaje del saldo</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className={cx("h-full rounded-full transition-all", pct >= 100 ? "bg-rose-500" : "bg-amber-400")}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  <button onClick={hacerRetiro} disabled={!puedeRetirar || loading}
                    className={cx("w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors",
                      !puedeRetirar || loading ? "bg-gray-300 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700")}>
                    {loading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                          <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/>
                        </svg>
                        Procesando…
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-.53 14.03a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V8.25a.75.75 0 0 0-1.5 0v5.69l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3Z" clipRule="evenodd"/>
                        </svg>
                        Registrar retiro
                      </>
                    )}
                  </button>
                </div>

                {ok && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">✓ {ok}</div>}
                {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

                {saldo === 0 && !hayRondaActiva && selectedId && (
                  <div className="rounded-lg bg-gray-50 border px-3 py-2 text-sm text-gray-500">
                    Este socio no tiene saldo disponible para retirar.
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
