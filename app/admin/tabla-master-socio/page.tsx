// app/admin/tabla-master-socio/page.tsx
"use client";
import { useEffect, useState, useRef } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ── Column group config ───────────────────────────────────── */

const COL_GROUPS = [
  { key: "ahorros", label: "Ahorros", color: "bg-emerald-100 text-emerald-800", cellBg: "bg-emerald-50/50", headerBg: "bg-emerald-50", default: true },
  { key: "aportes", label: "Aportes", color: "bg-blue-100 text-blue-800", cellBg: "bg-blue-50/50", headerBg: "bg-blue-50", default: true },
  { key: "multas", label: "Multas", color: "bg-orange-100 text-orange-800", cellBg: "bg-orange-50/50", headerBg: "bg-orange-50", default: true },
  { key: "express", label: "P. Express", color: "bg-amber-100 text-amber-800", cellBg: "bg-amber-50/50", headerBg: "bg-amber-50", default: false },
  { key: "inversion", label: "Fondo Inversión", color: "bg-indigo-100 text-indigo-800", cellBg: "bg-indigo-50/50", headerBg: "bg-indigo-50", default: false },
] as const;

type ColKey = typeof COL_GROUPS[number]["key"];

/* ── Editable Cell ─────────────────────────────────────────── */

function EditCell({ value, onSave, bgClass }: { value: number | null; onSave: (v: number) => void; bgClass: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  function start() { setVal(value != null ? String(value) : "0"); setEditing(true); setTimeout(() => ref.current?.select(), 10); }
  function save() {
    const n = parseFloat(val);
    if (!isNaN(n) && n !== value) onSave(n);
    setEditing(false);
  }

  if (editing) return (
    <td className={cn("px-1 py-0.5", bgClass)}>
      <input ref={ref} type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)}
        onBlur={save} onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="w-16 rounded border border-blue-400 px-1 py-0.5 text-[11px] text-right focus:outline-none bg-white" autoFocus />
    </td>
  );

  const empty = value == null;
  const zero = value === 0;
  return (
    <td onClick={start} className={cn("px-1 py-0.5 text-right cursor-pointer hover:ring-1 hover:ring-blue-300 hover:ring-inset transition-shadow whitespace-nowrap", bgClass)} title="Click para editar">
      <span className={cn("tabular-nums text-[11px]", empty && "text-gray-300", zero && !empty && "text-gray-400", !empty && !zero && "text-gray-800 font-medium")}>
        {empty ? "—" : fmt(value)}
      </span>
    </td>
  );
}

/* ── Read-only cell ────────────────────────────────────────── */

function ReadCell({ value, bgClass }: { value: number | null | string; bgClass: string }) {
  const empty = value == null || value === "";
  const isNum = typeof value === "number";
  const zero = isNum && value === 0;
  return (
    <td className={cn("px-1 py-0.5 text-right whitespace-nowrap", bgClass)}>
      <span className={cn("tabular-nums text-[11px]", empty && "text-gray-300", zero && "text-gray-400", !empty && !zero && "text-gray-800 font-medium")}>
        {empty ? "—" : isNum ? fmt(value) : value}
      </span>
    </td>
  );
}

/* ── Main ──────────────────────────────────────────────────── */

export default function TablaMasterSocioPage() {
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [sociosBuscados, setSociosBuscados] = useState<any[]>([]);
  const [socioId, setSocioId] = useState<number | null>(null);
  const [socioSeleccionado, setSocioSeleccionado] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSocios, setLoadingSocios] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Column visibility
  const [visibles, setVisibles] = useState<Record<ColKey, boolean>>(() => {
    const init: any = {};
    COL_GROUPS.forEach(g => { init[g.key] = g.default; });
    return init;
  });

  // Week navigation
  const [semanaNav, setSemanaNav] = useState(1);
  const tableRef = useRef<HTMLDivElement>(null);

  const showMsg = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };
  const toggle = (key: ColKey) => setVisibles(prev => ({ ...prev, [key]: !prev[key] }));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch socios list on mount
  useEffect(() => {
    setLoadingSocios(true);
    fetch("/api/admin/socios")
      .then(r => r.json())
      .then(d => { setSociosBuscados(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoadingSocios(false));
  }, []);

  // Filter socios based on search input
  useEffect(() => {
    if (!busqueda.trim()) {
      setSugerencias([]);
      return;
    }
    const q = busqueda.toLowerCase();
    const filtered = sociosBuscados.filter((s: any) => {
      const fullName = `${s.nombres ?? ""} ${s.apellidos ?? ""}`.toLowerCase();
      const cuenta = (s.numeroCuenta ?? "").toLowerCase();
      return fullName.includes(q) || cuenta.includes(q);
    }).slice(0, 10);
    setSugerencias(filtered);
  }, [busqueda, sociosBuscados]);

  function seleccionarSocio(socio: any) {
    setSocioId(socio.id);
    setSocioSeleccionado(socio);
    setBusqueda(`${socio.nombres} ${socio.apellidos}`);
    setShowDropdown(false);
    setData(null);
  }

  async function cargar() {
    if (!socioId) return;
    setLoading(true); setData(null);
    try {
      const res = await fetch(`/api/admin/socios/${socioId}/tabla-master`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const d = await res.json();
      setData(d);
      setSocioSeleccionado(d.socio);
      setSemanaNav(1);
    } catch (e: any) { showMsg(e.message, false); }
    finally { setLoading(false); }
  }

  async function editarValor(tipo: string, recordId: number | null, monto: number) {
    if (!recordId) { showMsg("No existe registro para editar. El registro debe existir primero.", false); return; }
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: recordId, datos: { monto } }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      showMsg("Valor actualizado", true);
      cargar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  async function editarInversion(cuentaId: number, montoInvertido: number) {
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "cuentaInversion", id: cuentaId, datos: { montoInvertido } }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      showMsg("Inversión actualizada · % recalculados", true);
      cargar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  // Compute max weeks across all rondas
  const maxSemanas = data ? Math.max(...data.rondas.map((r: any) => r.totalSemanas || 0), 0) : 0;
  const semanaKeys = Array.from({ length: maxSemanas }, (_, i) => i + 1);
  const activeGroups = COL_GROUPS.filter(g => visibles[g.key]);
  const colsPerWeek = activeGroups.filter(g => g.key !== "inversion").length;

  // Navigate to week
  function irASemana(sem: number) {
    setSemanaNav(sem);
    if (!tableRef.current) return;
    const stickyW = 200;
    const colW = 85;
    const invCols = visibles.inversion ? 2 * colW : 0;
    const offset = stickyW + invCols + (sem - 1) * colsPerWeek * colW;
    tableRef.current.scrollLeft = Math.max(0, offset - stickyW);
  }

  // Value helpers
  function getVal(ronda: any, sem: number, key: ColKey): number | null {
    const s = ronda.semanas?.[String(sem)];
    if (!s) return null;
    if (key === "ahorros") return s.ahorro ?? null;
    if (key === "aportes") return s.aporte ?? null;
    if (key === "multas") return s.multa ?? null;
    if (key === "express") return s.express ?? null;
    return null;
  }

  function getRecordId(ronda: any, sem: number, key: ColKey): number | null {
    const s = ronda.semanas?.[String(sem)];
    if (!s) return null;
    if (key === "ahorros") return s.ahorroId ?? null;
    if (key === "aportes") return s.aporteId ?? null;
    return null;
  }

  function rondaWeekTotal(ronda: any, key: ColKey): number {
    return semanaKeys.reduce((s, sem) => s + (getVal(ronda, sem, key) ?? 0), 0);
  }

  function rondaRowTotal(ronda: any): number {
    return activeGroups.filter(g => g.key !== "inversion").reduce((sum, g) => sum + rondaWeekTotal(ronda, g.key), 0);
  }

  function colTotal(sem: number, key: ColKey): number {
    if (!data) return 0;
    return data.rondas.reduce((s: number, ronda: any) => s + (getVal(ronda, sem, key) ?? 0), 0);
  }

  function grandTotal(key: ColKey): number {
    return semanaKeys.reduce((s, sem) => s + colTotal(sem, key), 0);
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Master por Socio</h1>
        <p className="text-xs text-gray-400">Vista completa de un socio en todas sus rondas · click en cualquier celda para editar</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
          {msg.text}
        </div>
      )}

      {/* Selector + filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-[220px] relative" ref={dropdownRef}>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Buscar Socio</label>
            <input
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setShowDropdown(true); setSocioId(null); setSocioSeleccionado(null); setData(null); }}
              onFocus={() => { if (busqueda.trim()) setShowDropdown(true); }}
              placeholder={loadingSocios ? "Cargando socios..." : "Nombre o número de cuenta..."}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            {showDropdown && sugerencias.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-y-auto">
                {sugerencias.map((s: any) => (
                  <button key={s.id} onClick={() => seleccionarSocio(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors border-b border-gray-100 last:border-0">
                    <p className="font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{s.numeroCuenta}</p>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && busqueda.trim() && sugerencias.length === 0 && !loadingSocios && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg p-3 text-sm text-gray-400">
                No se encontraron socios
              </div>
            )}
          </div>
          <button onClick={cargar} disabled={!socioId || loading}
            className="w-full sm:w-auto rounded-lg bg-violet-600 px-5 py-2 text-sm text-white hover:bg-violet-700 disabled:opacity-40">
            {loading ? "Cargando..." : "Cargar"}
          </button>
        </div>

        {/* Column toggles */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-xs text-gray-500 self-center mr-1">Columnas:</span>
          {COL_GROUPS.map(g => (
            <label key={g.key} className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors select-none",
              visibles[g.key] ? `${g.color} border-current` : "bg-gray-50 text-gray-400 border-gray-200"
            )}>
              <input type="checkbox" checked={visibles[g.key]} onChange={() => toggle(g.key)}
                className="rounded border-gray-300 text-violet-600 h-3 w-3" />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      {/* Socio info badges */}
      {socioSeleccionado && data && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-1.5 text-violet-700 font-medium">
            {socioSeleccionado.nombres} {socioSeleccionado.apellidos}
          </span>
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600 font-mono">
            {socioSeleccionado.numeroCuenta}
          </span>
          <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-700">
            Saldo: {fmt(socioSeleccionado.saldoAhorros ?? 0)}
          </span>
          <span className={cn(
            "rounded-lg border px-3 py-1.5 font-medium",
            socioSeleccionado.activo ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
          )}>
            {socioSeleccionado.activo ? "Activo" : "Inactivo"}
          </span>
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600">
            Rondas: {data.rondas.length}
          </span>
        </div>
      )}

      {/* Week nav */}
      {data && semanaKeys.length > 0 && (
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-600">Ir a semana:</span>
            <div className="flex gap-1 flex-wrap">
              {semanaKeys.map(sem => (
                <button key={sem} onClick={() => irASemana(sem)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    sem === semanaNav
                      ? "bg-violet-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}>
                  {sem}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1">
              <button onClick={() => irASemana(Math.max(1, semanaNav - 1))} disabled={semanaNav <= 1}
                className="rounded-md border px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                ← Anterior
              </button>
              <button onClick={() => irASemana(Math.min(semanaKeys.length, semanaNav + 1))} disabled={semanaNav >= semanaKeys.length}
                className="rounded-md border px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main table */}
      {data && data.rondas.length > 0 && (colsPerWeek > 0 || visibles.inversion) && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div ref={tableRef} className="overflow-x-auto" style={{ maxHeight: "75vh" }}>
            <table className="border-collapse text-[11px]">
              {/* Header row 1: Ronda + Inversión + week groups */}
              <thead>
                <tr className="sticky top-0 z-20">
                  <th rowSpan={2} className="sticky left-0 z-30 bg-gray-200 border border-gray-300 px-3 py-2 text-left text-xs font-bold text-gray-800 min-w-[200px]">
                    Ronda
                  </th>

                  {/* Inversión columns header (if visible) */}
                  {visibles.inversion && (
                    <th colSpan={2} className="bg-indigo-100 border border-indigo-200 px-2 py-1.5 text-center text-xs font-bold text-indigo-800">
                      Fondo de Inversión
                    </th>
                  )}

                  {/* Week group headers */}
                  {semanaKeys.map(sem => {
                    const weekCols = activeGroups.filter(g => g.key !== "inversion");
                    return (
                      <th key={sem} colSpan={weekCols.length} className="bg-gray-100 border border-gray-300 px-2 py-1.5 text-center text-xs font-bold text-gray-700">
                        Semana {sem}
                      </th>
                    );
                  })}

                  {/* Total */}
                  <th rowSpan={2} className="bg-gray-200 border border-gray-300 px-3 py-2 text-center text-xs font-bold text-gray-800 min-w-[80px] sticky right-0 z-20">
                    Total
                  </th>
                </tr>

                {/* Header row 2: sub-column labels */}
                <tr className="sticky top-[33px] z-20">
                  {/* Inversión sub-headers */}
                  {visibles.inversion && (
                    <>
                      <th className="bg-indigo-50 border border-indigo-200 px-1 py-1 text-center text-[10px] font-semibold text-indigo-700 min-w-[75px]">Valor</th>
                      <th className="bg-indigo-50 border border-indigo-200 px-1 py-1 text-center text-[10px] font-semibold text-indigo-700 min-w-[60px]">% Interés</th>
                    </>
                  )}

                  {/* Per-week sub-headers */}
                  {semanaKeys.map(sem =>
                    activeGroups.filter(g => g.key !== "inversion").map(g => (
                      <th key={`${sem}-${g.key}`} className={cn("border border-gray-200 px-1 py-1 text-center text-[10px] font-semibold min-w-[80px]", g.headerBg, g.color)}>
                        {g.label}
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              <tbody>
                {data.rondas.map((ronda: any, idx: number) => {
                  const even = idx % 2 === 0;
                  const rowBg = even ? "" : "bg-gray-50/40";

                  return (
                    <tr key={ronda.rondaId} className={cn("border-b border-gray-200 hover:bg-yellow-50/30", rowBg)}>
                      {/* Sticky ronda name */}
                      <td className={cn("sticky left-0 z-10 border-r border-gray-300 px-2 py-1.5", even ? "bg-white" : "bg-gray-50")}>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-gray-900 text-xs leading-tight">{ronda.nombre}</p>
                          <span className={cn(
                            "inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                            ronda.activa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          )}>
                            {ronda.activa ? "Activa" : "Cerrada"}
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-400">Sem {ronda.semanaActual}/{ronda.totalSemanas}</p>
                      </td>

                      {/* Inversión cells */}
                      {visibles.inversion && (
                        <>
                          {ronda.inversion?.id ? (
                            <EditCell value={ronda.inversion.montoInvertido} bgClass="bg-indigo-50/50 border-r border-indigo-100"
                              onSave={(v) => editarInversion(ronda.inversion.id, v)} />
                          ) : (
                            <ReadCell value={null} bgClass="bg-indigo-50/50 border-r border-indigo-100" />
                          )}
                          <ReadCell value={ronda.inversion ? `${ronda.inversion.porcentaje}%` : null} bgClass="bg-indigo-50/50 border-r border-indigo-100" />
                        </>
                      )}

                      {/* Per-week data cells */}
                      {semanaKeys.map(sem => {
                        const rondaHasWeek = sem <= ronda.totalSemanas;
                        return activeGroups.filter(g => g.key !== "inversion").map(g => {
                          if (!rondaHasWeek) {
                            return <ReadCell key={`${sem}-${g.key}`} value={null} bgClass={cn(g.cellBg, "border-r border-gray-100") as string} />;
                          }
                          const val = getVal(ronda, sem, g.key);
                          const editable = g.key === "ahorros" || g.key === "aportes";
                          if (editable) {
                            const recId = getRecordId(ronda, sem, g.key);
                            return (
                              <EditCell key={`${sem}-${g.key}`} value={val}
                                onSave={(v) => editarValor(g.key === "ahorros" ? "ahorro" : "aporte", recId, v)}
                                bgClass={cn(g.cellBg, "border-r border-gray-100") as string} />
                            );
                          }
                          return <ReadCell key={`${sem}-${g.key}`} value={val} bgClass={cn(g.cellBg, "border-r border-gray-100") as string} />;
                        });
                      })}

                      {/* Row total */}
                      <td className="bg-gray-100 border-l border-gray-300 px-2 py-0.5 text-right font-bold tabular-nums text-xs text-gray-800 sticky right-0 z-10">
                        {fmt(rondaRowTotal(ronda))}
                      </td>
                    </tr>
                  );
                })}

                {/* TOTALS row */}
                <tr className="border-t-2 border-gray-400 font-bold bg-gray-100">
                  <td className="sticky left-0 z-10 bg-gray-200 border-r border-gray-300 px-2 py-2 text-xs font-bold text-gray-800">
                    TOTAL
                  </td>

                  {visibles.inversion && (
                    <>
                      <td className="bg-indigo-100 border-r border-indigo-200 px-1 py-2 text-right text-xs font-bold tabular-nums text-indigo-800">
                        {fmt(data.rondas.reduce((s: number, r: any) => s + (r.inversion?.montoInvertido ?? 0), 0))}
                      </td>
                      <td className="bg-indigo-100 border-r border-indigo-200 px-1 py-2 text-right text-xs text-indigo-600">—</td>
                    </>
                  )}

                  {semanaKeys.map(sem =>
                    activeGroups.filter(g => g.key !== "inversion").map(g => (
                      <td key={`t-${sem}-${g.key}`} className={cn("px-1 py-2 text-right tabular-nums text-xs border-r border-gray-200", g.headerBg)}>
                        <span className={colTotal(sem, g.key) === 0 ? "text-gray-400" : "text-gray-900 font-bold"}>
                          {fmt(colTotal(sem, g.key))}
                        </span>
                      </td>
                    ))
                  )}

                  <td className="bg-gray-200 px-2 py-2 text-right text-xs font-extrabold tabular-nums text-gray-900 sticky right-0 z-10">
                    {fmt(
                      activeGroups.filter(g => g.key !== "inversion").reduce((sum, g) => sum + grandTotal(g.key), 0)
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-400">Cargando datos...</div>}
      {!loading && data && data.rondas.length === 0 && <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">Este socio no tiene rondas</div>}

      {/* Summary cards per ronda */}
      {data && data.rondas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Resumen por ronda</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.rondas.map((ronda: any) => (
              <div key={ronda.rondaId} className="rounded-xl border bg-white p-3 shadow-sm text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-sm">{ronda.nombre}</p>
                  <span className={cn(
                    "inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                    ronda.activa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  )}>
                    {ronda.activa ? "Activa" : "Cerrada"}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mb-2">Semana {ronda.semanaActual} de {ronda.totalSemanas}</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-emerald-700">Ahorros</span><span className="font-semibold tabular-nums">{fmt(ronda.totales?.ahorros ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-700">Aportes</span><span className="font-semibold tabular-nums">{fmt(ronda.totales?.aportes ?? 0)}</span></div>
                  {(ronda.totales?.multas ?? 0) > 0 && <div className="flex justify-between"><span className="text-orange-700">Multas</span><span className="font-semibold tabular-nums">{fmt(ronda.totales.multas)}</span></div>}
                  {ronda.prestamos?.length > 0 && (
                    <div className="pt-1 border-t mt-1">
                      {ronda.prestamos.map((p: any) => (
                        <div key={p.id} className="flex justify-between text-[11px]">
                          <span className="text-purple-700">Préstamo {fmt(p.monto)} <span className="text-[9px]">({p.estado})</span></span>
                          <span className="tabular-nums">Saldo: {fmt(p.saldoActual)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ronda.inversion && (
                    <div className="pt-1 border-t mt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-indigo-700">Inversión {fmt(ronda.inversion.montoInvertido)} ({ronda.inversion.porcentaje}%)</span>
                        <span className="tabular-nums">Int: {fmt(ronda.inversion.intereses)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
