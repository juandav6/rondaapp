// app/ahorros/registro/page.tsx
"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };
type MovItem = {
  id: string | number; tipo?: string; rondaId?: number | null; rondaNombre?: string | null;
  semana?: number | null; monto: number; nota?: string | null; fecha: string;
  socio?: { nombres: string; apellidos: string; numeroCuenta: string };
};

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const toInputDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; };
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const tipoConfig: Record<string, { label: string; color: string; bg: string; signo: string }> = {
  ronda: { label: "Ahorro ronda", color: "text-emerald-700", bg: "bg-emerald-100", signo: "+" },
  deposito: { label: "Depósito libre", color: "text-blue-700", bg: "bg-blue-100", signo: "+" },
  AHORRO: { label: "Depósito libre", color: "text-blue-700", bg: "bg-blue-100", signo: "+" },
  retiro: { label: "Retiro", color: "text-rose-700", bg: "bg-rose-100", signo: "−" },
};

function AhorrosRegistroContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"registrar" | "listado">("registrar");

  // Leer tab del URL después del montaje
  useEffect(() => {
    if (searchParams.get("tab") === "listado") setTab("listado");
  }, [searchParams]);

  // Registrar tab
  const [socios, setSocios] = useState<Socio[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSocio, setSelectedSocio] = useState<Socio | null>(null);
  const [items, setItems] = useState<MovItem[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevoMonto, setNuevoMonto] = useState("");
  const [nuevaNota, setNuevaNota] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

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
  const [listSocioId, setListSocioId] = useState<number | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  // Edición
  const [editId, setEditId] = useState<number | null>(null);
  const [editMonto, setEditMonto] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editNota, setEditNota] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | string | null>(null);

  useEffect(() => {
    fetch("/api/socios").then(r => r.json()).then(l => setSocios(Array.isArray(l) ? l : [])).catch(() => setSocios([])).finally(() => setLoadingSocios(false));
  }, []);

  async function cargarHistorial(socioId: number, d?: string, h?: string) {
    setLoadingHist(true);
    try {
      const params = new URLSearchParams({ socioId: String(socioId) });
      if (d) params.set("desde", d);
      if (h) params.set("hasta", h);
      const data = await fetch(`/api/ahorros?${params}`, { cache: "no-store" }).then(r => r.json());
      setItems(Array.isArray(data) ? data : (data.items ?? []));
      setSaldo(!Array.isArray(data) && data.saldo != null ? Number(data.saldo) : 0);
    } catch { setItems([]); setSaldo(0); }
    finally { setLoadingHist(false); }
  }

  useEffect(() => {
    if (!selectedId) { setItems([]); setSaldo(0); return; }
    cargarHistorial(selectedId, desde, hasta);
  }, [selectedId, desde, hasta]);

  async function cargarListado() {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ tipo: "AHORRO", page: String(listPage), limit: "50" });
      if (listDesde) params.set("desde", listDesde);
      if (listHasta) params.set("hasta", listHasta);
      if (listSocioId) params.set("socioId", String(listSocioId));
      const data = await fetch(`/api/movimientos?${params}`, { cache: "no-store" }).then(r => r.json());
      setListado(data.movimientos ?? []);
      setListTotal(data.total ?? 0);
      setListPages(data.pages ?? 1);
      setListTotalMonto(data.totalMonto ?? 0);
    } catch { setListado([]); }
    finally { setLoadingList(false); }
  }

  useEffect(() => { cargarListado(); }, [listPage, listDesde, listHasta, listSocioId]);

  useEffect(() => { if (tab === "listado") cargarListado(); }, [tab]);

  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s))) : socios;
  }, [socios, q]);

  const listadoFiltrado = useMemo(() => {
    const s = listQ.trim().toLowerCase();
    return s ? listado.filter(m => [m.socio?.nombres, m.socio?.apellidos, m.socio?.numeroCuenta].some(v => (v ?? "").toLowerCase().includes(s))) : listado;
  }, [listado, listQ]);

  async function agregarDeposito() {
    if (!selectedId) return;
    const monto = Number(nuevoMonto);
    if (!monto || monto <= 0) { setError("Ingresa un monto válido mayor a 0"); return; }
    try {
      setSaving(true); setError(null); setOkMsg(null);
      const res = await fetch("/api/ahorros/deposito", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId: selectedId, monto, nota: nuevaNota.trim() || undefined, ...(nuevaFecha ? { fecha: nuevaFecha } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al registrar");
      setOkMsg("Depósito registrado correctamente");
      setNuevaFecha(""); setNuevoMonto(""); setNuevaNota("");
      setTimeout(() => setOkMsg(null), 3000);
      await cargarHistorial(selectedId, desde, hasta);
    } catch (e: any) { setError(e?.message); }
    finally { setSaving(false); }
  }

  function abrirEdicion(m: MovItem) {
    setEditId(m.id);
    setEditMonto(String(m.monto));
    setEditFecha(toInputDate(m.fecha));
    setEditNota(m.nota ?? "");
    setEditError(null);
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
      if (selectedId) await cargarHistorial(selectedId, desde, hasta);
    } catch (e: any) { setEditError(e?.message); }
    finally { setEditSaving(false); }
  }

  async function eliminar(id: string | number) {
    try {
      const strId = String(id);
      let res: Response;

      if (strId.startsWith("r_")) {
        // Es un registro de tabla Ahorro — eliminar via admin que ajusta saldoAhorros
        const ahorroId = Number(strId.replace("r_", ""));
        res = await fetch("/api/admin/movimientos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "ahorro", id: ahorroId }),
        });
      } else if (strId.startsWith("m_")) {
        // Es un MovimientoCuenta libre
        const movId = Number(strId.replace("m_", ""));
        res = await fetch(`/api/movimientos/${movId}`, { method: "DELETE" });
      } else {
        // ID numérico directo (listado)
        res = await fetch(`/api/movimientos/${id}`, { method: "DELETE" });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error ${res.status} al eliminar`);
      setDeleteConfirm(null);
      setListError(null);
      await cargarListado();
      if (selectedId) await cargarHistorial(selectedId, desde, hasta);
    } catch (e: any) {
      setListError(e?.message ?? "Error al eliminar");
      setDeleteConfirm(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"/>
            </svg>
          </span>
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Depósitos de ahorros</h1>
            <p className="text-xs sm:text-sm text-gray-500">Registra depósitos libres y consulta el listado completo.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {(["registrar", "listado"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cx("flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize",
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t === "registrar" ? "Registrar depósito" : `Listado de depósitos${listTotal > 0 ? ` (${listTotal})` : ""}`}
          </button>
        ))}
      </div>

      {/* Tab: Registrar */}
      {tab === "registrar" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            {loadingSocios ? <div className="px-4 pb-4 text-sm text-gray-400">Cargando socios…</div> : (
              <ul className="max-h-[60vh] overflow-y-auto divide-y">
                {sociosFiltrados.map(s => {
                  const active = selectedId === s.id;
                  return (
                    <li key={s.id}>
                      <button onClick={() => { setSelectedId(s.id); setSelectedSocio(s); }}
                        className={cx("w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-3", active && "bg-emerald-50/60 border-l-2 border-emerald-500")}>
                        <div className="min-w-0">
                          <p className={cx("truncate text-sm font-medium", active ? "text-emerald-800" : "text-gray-900")}>{s.nombres} {s.apellidos}</p>
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

                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs">+</span>
                    Registrar depósito libre
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Fecha (opcional)</label>
                      <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                        onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Monto ($)</label>
                      <input type="number" min="0.01" step="0.01" placeholder="0.00" value={nuevoMonto}
                        onChange={e => setNuevoMonto(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <button onClick={agregarDeposito} disabled={saving || !Number(nuevoMonto)}
                        className={cx("rounded-lg px-4 py-2 text-sm font-medium text-white",
                          saving || !Number(nuevoMonto) ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700")}>
                        {saving ? "Guardando…" : "Registrar depósito"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Comentario (opcional)</label>
                    <input type="text" placeholder="Descripción del depósito…" value={nuevaNota}
                      onChange={e => setNuevaNota(e.target.value)}
                      maxLength={200}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  {okMsg && <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">✓ {okMsg}</div>}
                  {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
                </div>

                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Historial de movimientos</p>
                    <span className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(items.reduce((a,i) => a + Number(i.monto||0), 0))}</span>
                  </div>
                  {loadingHist ? (
                    <div className="p-8 text-center text-sm text-gray-400"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />Cargando…</div>
                  ) : items.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400">No hay movimientos registrados.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-4 py-3 text-left">Fecha</th>
                            <th className="px-4 py-3 text-left">Tipo</th>
                            <th className="px-4 py-3 text-left">Origen / Nota</th>
                            <th className="px-4 py-3 text-right">Monto</th>
                            <th className="px-4 py-3 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {items.map((it, i) => {
                            const tipo = it.tipo ?? "ronda";
                            const cfg = tipoConfig[tipo] ?? tipoConfig.ronda;
                            const esSaldoInicial = it.nota?.toLowerCase().includes("inicial") || it.nota?.toLowerCase().includes("saldo");
                            return (
                              <tr key={`${it.id}_${i}`} className={cx("hover:bg-gray-50", esSaldoInicial && "bg-amber-50/40")}>
                                <td className="px-4 py-3 text-gray-600">{fmtDate(it.fecha)}</td>
                                <td className="px-4 py-3"><span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cfg.bg, cfg.color)}>{cfg.label}</span></td>
                                <td className="px-4 py-3 text-gray-500 text-xs">
                                  {it.rondaNombre ?? (it.nota ?? "—")}
                                  {esSaldoInicial && <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold">Saldo inicial</span>}
                                </td>
                                <td className={cx("px-4 py-3 text-right font-semibold tabular-nums", cfg.color)}>{cfg.signo}{fmt(Math.abs(Number(it.monto)))}</td>
                                <td className="px-4 py-3 text-center">
                                  {it.id && (
                                    <button
                                      onClick={() => {
                                        const desc = esSaldoInicial
                                          ? `¿Eliminar el movimiento de "Saldo inicial" (${fmt(Number(it.monto))})?\n\nEl saldo de ahorros del socio se reducirá en ${fmt(Number(it.monto))}.`
                                          : `¿Eliminar este movimiento de ${fmt(Number(it.monto))}?`;
                                        if (confirm(desc + "\n\nQuedará en bitácora.")) eliminar(it.id as string | number);
                                      }}
                                      className={cx(
                                        "rounded-lg border px-2 py-1 text-xs",
                                        esSaldoInicial
                                          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold"
                                          : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                      )}>
                                      {esSaldoInicial ? "⚠ Eliminar" : "Eliminar"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {/* Tab: Listado */}
      {tab === "listado" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Buscar socio</label>
                <input value={listQ} onChange={e => setListQ(e.target.value)} placeholder="Nombre o cuenta…"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
                <input type="date" value={listDesde} onChange={e => { setListDesde(e.target.value); setListPage(1); }}
                  onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200 cursor-pointer" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
                <input type="date" value={listHasta} onChange={e => { setListHasta(e.target.value); setListPage(1); }}
                  onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-200 cursor-pointer" />
              </div>
              <div className="flex flex-col justify-end">
                <button onClick={() => { setListDesde(""); setListHasta(""); setListQ(""); setListSocioId(null); setListPage(1); }}
                  className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>

          {/* Tabla listado */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                {listTotal} depósito{listTotal !== 1 ? "s" : ""}
              </p>
              <span className="text-sm font-bold text-blue-700 tabular-nums">Total: {fmt(listTotalMonto)}</span>
            </div>
            {listError && (
              <div className="border-b bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
                <span>⚠ {listError}</span>
                <button onClick={() => setListError(null)} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            )}

            {loadingList ? (
              <div className="p-8 text-center text-sm text-gray-400">
                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                Cargando…
              </div>
            ) : listadoFiltrado.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">No hay depósitos registrados.</div>
            ) : (
              <>
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
                      {listadoFiltrado.map(m => {
                        const esSaldoInicial = m.nota?.toLowerCase().includes("inicial") || m.nota?.toLowerCase().includes("saldo inicial");
                        return (
                        <tr key={m.id} className={cx("hover:bg-gray-50", editId === m.id && "bg-blue-50/40", esSaldoInicial && "bg-amber-50/40")}>
                          {editId === m.id ? (
                            <>
                              <td className="px-4 py-2" colSpan={2}>
                                <div className="flex gap-2">
                                  <div>
                                    <label className="text-[10px] text-gray-500">Fecha</label>
                                    <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)}
                                      onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                                      className="block rounded border px-2 py-1 text-xs focus:outline-none w-36 cursor-pointer" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500">Monto ($)</label>
                                    <input type="number" min="0.01" step="0.01" value={editMonto} onChange={e => setEditMonto(e.target.value)}
                                      className="block rounded border px-2 py-1 text-xs focus:outline-none w-24 text-right" />
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
                                    className="rounded bg-blue-600 px-2.5 py-1 text-xs text-white disabled:opacity-50">
                                    {editSaving ? "…" : "Guardar"}
                                  </button>
                                  <button onClick={() => setEditId(null)} className="rounded border px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
                                    Cancelar
                                  </button>
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
                              <td className="px-4 py-3 text-gray-400 text-xs">
                                {m.nota || "—"}
                                {esSaldoInicial && <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold">Saldo inicial</span>}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-blue-700">{fmt(m.monto)}</td>
                              <td className="px-4 py-3">
                                <div className="flex justify-center gap-1.5">
                                  <button onClick={() => abrirEdicion(m)}
                                    className="rounded border px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100">
                                    Editar
                                  </button>
                                  {deleteConfirm === m.id ? (
                                    <>
                                      <button onClick={() => eliminar(m.id)} className="rounded bg-red-600 px-2.5 py-1 text-xs text-white">¿Sí?</button>
                                      <button onClick={() => setDeleteConfirm(null)} className="rounded border px-2.5 py-1 text-xs text-gray-500">No</button>
                                    </>
                                  ) : (
                                    <button onClick={() => setDeleteConfirm(m.id)} className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {listPages > 1 && (
                  <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3 text-sm">
                    <span className="text-xs text-gray-500">Pág. {listPage} de {listPages}</span>
                    <div className="flex gap-2">
                      <button disabled={listPage === 1} onClick={() => setListPage(p => p - 1)}
                        className="rounded border px-3 py-1 text-xs disabled:opacity-40">← Anterior</button>
                      <button disabled={listPage >= listPages} onClick={() => setListPage(p => p + 1)}
                        className="rounded border px-3 py-1 text-xs disabled:opacity-40">Siguiente →</button>
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

export default function AhorrosRegistroPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-400">Cargando…</div>}>
      <AhorrosRegistroContent />
    </Suspense>
  );
}
