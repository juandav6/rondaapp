// app/socios/retiros/page.tsx
"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };
type MovItem = { id: number; monto: number; nota?: string | null; fecha: string; socio?: { nombres: string; apellidos: string; numeroCuenta: string } };

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const toInputDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; };
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function RetirosAhorroContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"registrar" | "listado">(() =>
    searchParams.get("tab") === "listado" ? "listado" : "registrar"
  );

  // Registrar tab
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

  // Listado tab
  const [listado, setListado] = useState<MovItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listTotalMonto, setListTotalMonto] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listPages, setListPages] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [listDesde, setListDesde] = useState("");
  const [listHasta, setListHasta] = useState("");
  const [listQ, setListQ] = useState("");

  // Edición
  const [editId, setEditId] = useState<number | null>(null);
  const [editMonto, setEditMonto] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editNota, setEditNota] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

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
      const data = await fetch(`/api/ahorros?socioId=${id}`, { cache: "no-store" }).then(r => r.json());
      setSaldo(!Array.isArray(data) && data.saldo != null ? Number(data.saldo) : 0);
    } catch { setSaldo(0); }
  }

  useEffect(() => { if (!selectedId) { setSaldo(0); return; } cargarSaldo(selectedId); }, [selectedId]);

  async function cargarListado() {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ tipo: "RETIRO", page: String(listPage), limit: "50" });
      if (listDesde) params.set("desde", listDesde);
      if (listHasta) params.set("hasta", listHasta);
      const data = await fetch(`/api/movimientos?${params}`, { cache: "no-store" }).then(r => r.json());
      setListado(data.movimientos ?? []);
      setListTotal(data.total ?? 0);
      setListPages(data.pages ?? 1);
      setListTotalMonto(data.totalMonto ?? 0);
    } catch { setListado([]); }
    finally { setLoadingList(false); }
  }

  useEffect(() => { if (tab === "listado") cargarListado(); }, [tab, listPage, listDesde, listHasta]);

  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s))) : socios;
  }, [socios, q]);

  const listadoFiltrado = useMemo(() => {
    const s = listQ.trim().toLowerCase();
    return s ? listado.filter(m => [m.socio?.nombres, m.socio?.apellidos, m.socio?.numeroCuenta].some(v => (v ?? "").toLowerCase().includes(s))) : listado;
  }, [listado, listQ]);

  const montoNum = Number(montoRetiro);
  const puedeRetirar = !checkingRonda && !hayRondaActiva && !!selectedId && montoNum > 0 && montoNum <= saldo && !!fechaRetiro;
  const pct = saldo > 0 && montoNum > 0 ? Math.min((montoNum / saldo) * 100, 100) : 0;

  async function hacerRetiro() {
    if (!puedeRetirar || !selectedId) return;
    try {
      setLoading(true); setError(null); setOk(null);
      const res = await fetch("/api/ahorros/retiro", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  function abrirEdicion(m: MovItem) {
    setEditId(m.id); setEditMonto(String(m.monto));
    setEditFecha(toInputDate(m.fecha)); setEditNota(m.nota ?? ""); setEditError(null);
  }

  async function guardarEdicion() {
    if (!editId) return;
    try {
      setEditSaving(true); setEditError(null);
      const res = await fetch(`/api/movimientos/${editId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto: Number(editMonto), fecha: editFecha, nota: editNota }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al guardar");
      setEditId(null);
      await cargarListado();
    } catch (e: any) { setEditError(e?.message); }
    finally { setEditSaving(false); }
  }

  async function eliminar(id: number) {
    try {
      const res = await fetch(`/api/movimientos/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error");
      setDeleteConfirm(null);
      await cargarListado();
      if (selectedId) await cargarSaldo(selectedId);
    } catch (e: any) { setEditError(e?.message); }
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
            <p className="text-xs sm:text-sm text-gray-500">Registra retiros y consulta el historial completo.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {(["registrar", "listado"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cx("flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t === "registrar" ? "Registrar retiro" : `Listado de retiros${listTotal > 0 ? ` (${listTotal})` : ""}`}
          </button>
        ))}
      </div>

      {/* Tab: Registrar */}
      {tab === "registrar" && (
        <>
          {!checkingRonda && hayRondaActiva && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-amber-600 shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Hay una ronda activa</p>
                <p className="text-xs text-amber-600 mt-0.5">Los retiros solo están disponibles cuando no hay ronda en curso.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <aside className="rounded-xl border bg-white shadow-sm overflow-hidden lg:col-span-1">
              <div className="border-b bg-gray-50 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-700">Seleccionar socio</h2>
              </div>
              <div className="p-3">
                <div className="relative">
                  <input className="w-full rounded-lg border px-3 py-2 pl-8 text-sm focus:border-rose-400 focus:outline-none"
                    placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none">
                    <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.05l3.725 3.725a.75.75 0 1 0 1.06-1.06l-3.724-3.725A6.75 6.75 0 0 0 10.5 3.75Z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
              {loadingSocios ? <div className="px-4 pb-4 text-sm text-gray-400">Cargando socios…</div> : (
                <ul className="max-h-[60vh] overflow-y-auto divide-y">
                  {sociosFiltrados.map(s => {
                    const active = selectedId === s.id;
                    return (
                      <li key={s.id}>
                        <button onClick={() => { setSelectedId(s.id); setSelectedSocio(s); setError(null); }}
                          className={cx("w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-3", active && "bg-rose-50/60 border-l-2 border-rose-400")}>
                          <div className="min-w-0">
                            <p className={cx("truncate text-sm font-medium", active ? "text-rose-800" : "text-gray-900")}>{s.nombres} {s.apellidos}</p>
                            <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                          </div>
                          {active && <span className="shrink-0 inline-flex h-2 w-2 rounded-full bg-rose-400" />}
                        </button>
                      </li>
                    );
                  })}
                  {sociosFiltrados.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">Sin resultados</li>}
                </ul>
              )}
            </aside>

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

                  <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-gray-800">Registrar retiro</h3>
                    <div className="max-w-xs space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Fecha del retiro</label>
                        <div className="relative">
                          <input id="fecha-retiro-input" type="date" value={fechaRetiro}
                            max={new Date().toISOString().slice(0,10)}
                            onChange={e => setFechaRetiro(e.target.value)} disabled={hayRondaActiva}
                            className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-200 disabled:bg-gray-100" />
                          <button type="button" disabled={hayRondaActiva}
                            onClick={() => { const el = document.getElementById("fecha-retiro-input") as HTMLInputElement; el?.showPicker?.(); el?.focus(); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 disabled:opacity-40" tabIndex={-1}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                              <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">Puedes seleccionar una fecha anterior.</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Monto a retirar</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input type="number" min="0.01" step="0.01" placeholder="0.00" value={montoRetiro}
                            onChange={e => setMontoRetiro(e.target.value)} disabled={hayRondaActiva}
                            className="w-full rounded-lg border pl-7 pr-3 py-2.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-200 disabled:bg-gray-100" />
                        </div>
                        {montoNum > saldo && saldo > 0 && <p className="mt-1 text-xs text-rose-600">⚠️ Excede el saldo disponible</p>}
                        {montoNum > 0 && montoNum <= saldo && <p className="mt-1 text-xs text-gray-400">Quedará: {fmt(saldo - montoNum)}</p>}
                      </div>

                      {montoNum > 0 && saldo > 0 && (
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Porcentaje del saldo</span><span>{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div className={cx("h-full rounded-full transition-all", pct >= 100 ? "bg-rose-500" : "bg-amber-400")} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}

                      <button onClick={hacerRetiro} disabled={!puedeRetirar || loading}
                        className={cx("w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2",
                          !puedeRetirar || loading ? "bg-gray-300 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700")}>
                        {loading ? (
                          <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/></svg>Procesando…</>
                        ) : "Registrar retiro"}
                      </button>
                    </div>
                    {ok && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">✓ {ok}</div>}
                    {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
                    {saldo === 0 && !hayRondaActiva && selectedId && (
                      <div className="rounded-lg bg-gray-50 border px-3 py-2 text-sm text-gray-500">Este socio no tiene saldo disponible.</div>
                    )}
                  </div>
                </div>
              )}
            </main>
          </div>
        </>
      )}

      {/* Tab: Listado */}
      {tab === "listado" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Buscar socio</label>
                <input value={listQ} onChange={e => setListQ(e.target.value)} placeholder="Nombre o cuenta…"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-200" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
                <input type="date" value={listDesde} onChange={e => { setListDesde(e.target.value); setListPage(1); }}
                  onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none cursor-pointer" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
                <input type="date" value={listHasta} onChange={e => { setListHasta(e.target.value); setListPage(1); }}
                  onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none cursor-pointer" />
              </div>
              <div className="flex flex-col justify-end">
                <button onClick={() => { setListDesde(""); setListHasta(""); setListQ(""); setListPage(1); }}
                  className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Limpiar</button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">{listTotal} retiro{listTotal !== 1 ? "s" : ""}</p>
              <span className="text-sm font-bold text-rose-600 tabular-nums">Total: {fmt(listTotalMonto)}</span>
            </div>

            {loadingList ? (
              <div className="p-8 text-center text-sm text-gray-400">
                <div className="animate-spin h-6 w-6 border-2 border-rose-500 border-t-transparent rounded-full mx-auto mb-2" />Cargando…
              </div>
            ) : listadoFiltrado.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">No hay retiros registrados.</div>
            ) : (
              <>
                {editError && <div className="mx-4 mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{editError}</div>}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Socio</th>
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-left">Nota</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {listadoFiltrado.map(m => (
                        <tr key={m.id} className={cx("hover:bg-gray-50", editId === m.id && "bg-rose-50/40")}>
                          {editId === m.id ? (
                            <>
                              <td className="px-4 py-2" colSpan={2}>
                                <div className="flex gap-2">
                                  <div>
                                    <label className="text-[10px] text-gray-500">Fecha</label>
                                    <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)}
                                      onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                                      className="block rounded border px-2 py-1 text-xs w-36 cursor-pointer focus:outline-none" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500">Monto ($)</label>
                                    <input type="number" min="0.01" step="0.01" value={editMonto} onChange={e => setEditMonto(e.target.value)}
                                      className="block rounded border px-2 py-1 text-xs w-24 text-right focus:outline-none" />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2" colSpan={2}>
                                <label className="text-[10px] text-gray-500">Nota</label>
                                <input value={editNota} onChange={e => setEditNota(e.target.value)}
                                  className="block w-full rounded border px-2 py-1 text-xs focus:outline-none" placeholder="Nota opcional…" />
                                {editError && <p className="text-[10px] text-red-500 mt-0.5">{editError}</p>}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex justify-center gap-1.5">
                                  <button onClick={guardarEdicion} disabled={editSaving}
                                    className="rounded bg-rose-600 px-2.5 py-1 text-xs text-white disabled:opacity-50">
                                    {editSaving ? "…" : "Guardar"}
                                  </button>
                                  <button onClick={() => setEditId(null)} className="rounded border px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{m.socio?.nombres} {m.socio?.apellidos}</p>
                                <p className="text-xs text-gray-400 font-mono">{m.socio?.numeroCuenta}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(m.fecha)}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{m.nota || "—"}</td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">{fmt(m.monto)}</td>
                              <td className="px-4 py-3">
                                <div className="flex justify-center gap-1.5">
                                  <button onClick={() => abrirEdicion(m)} className="rounded border px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100">Editar</button>
                                  {deleteConfirm === m.id ? (
                                    <>
                                      <button onClick={() => eliminar(m.id)} className="rounded bg-red-600 px-2.5 py-1 text-xs text-white">¿Sí?</button>
                                      <button onClick={() => setDeleteConfirm(null)} className="rounded border px-2.5 py-1 text-xs text-gray-500">No</button>
                                    </>
                                  ) : (
                                    <button onClick={() => setDeleteConfirm(m.id)} className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {listPages > 1 && (
                  <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3">
                    <span className="text-xs text-gray-500">Pág. {listPage} de {listPages}</span>
                    <div className="flex gap-2">
                      <button disabled={listPage === 1} onClick={() => setListPage(p => p-1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">← Anterior</button>
                      <button disabled={listPage >= listPages} onClick={() => setListPage(p => p+1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Siguiente →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RetirosAhorroPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-400">Cargando…</div>}>
      <RetirosAhorroContent />
    </Suspense>
  );
}
