// app/admin/tabla-master/page.tsx
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

export default function TablaMasterPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

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

  useEffect(() => {
    fetch("/api/rondas/historial").then(r => r.json()).then(d => setRondas(Array.isArray(d) ? d : d.rondas ?? []));
  }, []);

  async function cargar() {
    if (!rondaId) return;
    setLoading(true); setData(null);
    try {
      const res = await fetch(`/api/admin/rondas/${rondaId}/tabla-master`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const d = await res.json();
      setData(d);
      setSemanaNav(1);
    } catch (e: any) { showMsg(e.message, false); }
    finally { setLoading(false); }
  }

  async function editarValor(tipo: string, socioId: number, semana: number, monto: number) {
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: socioId, datos: { monto }, semana, rondaId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      showMsg("Valor actualizado", true);
      cargar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  const semanaKeys = data ? Array.from({ length: data.totalSemanas }, (_, i) => i + 1) : [];
  const activeGroups = COL_GROUPS.filter(g => visibles[g.key]);
  const colsPerWeek = activeGroups.length;

  // Navigate to week
  function irASemana(sem: number) {
    setSemanaNav(sem);
    if (!tableRef.current) return;
    const stickyW = 180;
    const colW = 85;
    const offset = stickyW + (sem - 1) * colsPerWeek * colW;
    tableRef.current.scrollLeft = Math.max(0, offset - stickyW);
  }

  // Totals helpers
  function getVal(socio: any, sem: number, key: ColKey): number | null {
    const s = socio.semanas?.[String(sem)];
    if (!s) return null;
    if (key === "ahorros") return s.ahorro ?? null;
    if (key === "aportes") return s.aporte ?? null;
    if (key === "multas") return s.multa ?? null;
    if (key === "express") return s.express ?? null;
    return null;
  }

  function colTotal(sem: number, key: ColKey): number {
    if (!data) return 0;
    return data.socios.reduce((s: number, socio: any) => s + (getVal(socio, sem, key) ?? 0), 0);
  }

  function socioTotal(socio: any, key: ColKey): number {
    return semanaKeys.reduce((s, sem) => s + (getVal(socio, sem, key) ?? 0), 0);
  }

  function grandTotal(key: ColKey): number {
    return semanaKeys.reduce((s, sem) => s + colTotal(sem, key), 0);
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Tabla Master</h1>
        <p className="text-xs text-gray-400">Vista completa de la ronda · click en cualquier celda para editar</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
          {msg.text}
        </div>
      )}

      {/* Selector + filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda</label>
            <select value={rondaId ?? ""} onChange={e => { setRondaId(e.target.value ? Number(e.target.value) : null); setData(null); }}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">-- Seleccionar --</option>
              {rondas.map((r: any) => <option key={r.id} value={r.id}>{r.nombre}{r.activa ? " ✓" : ""}</option>)}
            </select>
          </div>
          <button onClick={cargar} disabled={!rondaId || loading}
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40">
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
                className="rounded border-gray-300 text-blue-600 h-3 w-3" />
              {g.label}
            </label>
          ))}
        </div>
      </div>

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
                      ? "bg-blue-600 text-white"
                      : sem < (data.ronda.semanaActual) ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-gray-50 text-gray-400"
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

      {/* Info badges */}
      {data && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-blue-700 font-medium">{data.ronda.nombre}</span>
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600">Semana actual: {data.ronda.semanaActual}</span>
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600">Aporte: {fmt(data.ronda.montoAporte)}</span>
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600">Socios: {data.socios.length}</span>
        </div>
      )}

      {/* Main table */}
      {data && data.socios.length > 0 && colsPerWeek > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div ref={tableRef} className="overflow-x-auto" style={{ maxHeight: "75vh" }}>
            <table className="border-collapse text-[11px]">
              {/* Header row 1: Socio + Inversión + week groups */}
              <thead>
                <tr className="sticky top-0 z-20">
                  <th rowSpan={2} className="sticky left-0 z-30 bg-gray-200 border border-gray-300 px-3 py-2 text-left text-xs font-bold text-gray-800 min-w-[180px]">
                    Socio
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
                        {data.semanas?.[String(sem)]?.responsable && (
                          <div className="text-[9px] font-normal text-gray-400 truncate">{data.semanas[String(sem)].responsable}</div>
                        )}
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
                {data.socios.map((socio: any, idx: number) => {
                  const even = idx % 2 === 0;
                  const rowBg = even ? "" : "bg-gray-50/40";

                  return (
                    <tr key={socio.socioId} className={cn("border-b border-gray-200 hover:bg-yellow-50/30", rowBg)}>
                      {/* Sticky name */}
                      <td className={cn("sticky left-0 z-10 border-r border-gray-300 px-2 py-1.5", even ? "bg-white" : "bg-gray-50")}>
                        <p className="font-semibold text-gray-900 text-xs leading-tight truncate max-w-[170px]">{socio.nombres} {socio.apellidos}</p>
                        <p className="text-[9px] text-gray-400 font-mono">{socio.numeroCuenta}</p>
                      </td>

                      {/* Inversión cells */}
                      {visibles.inversion && (
                        <>
                          <ReadCell value={socio.inversion?.montoInvertido ?? null} bgClass="bg-indigo-50/50 border-r border-indigo-100" />
                          <ReadCell value={socio.inversion ? `${socio.inversion.porcentaje}%` : null} bgClass="bg-indigo-50/50 border-r border-indigo-100" />
                        </>
                      )}

                      {/* Per-week data cells */}
                      {semanaKeys.map(sem =>
                        activeGroups.filter(g => g.key !== "inversion").map(g => {
                          const val = getVal(socio, sem, g.key);
                          const editable = g.key === "ahorros" || g.key === "aportes";
                          if (editable) {
                            return (
                              <EditCell key={`${sem}-${g.key}`} value={val}
                                onSave={(v) => editarValor(g.key === "ahorros" ? "ahorro" : "aporte", socio.socioId, sem, v)}
                                bgClass={cn(g.cellBg, "border-r border-gray-100") as string} />
                            );
                          }
                          return <ReadCell key={`${sem}-${g.key}`} value={val} bgClass={cn(g.cellBg, "border-r border-gray-100") as string} />;
                        })
                      )}

                      {/* Row total */}
                      <td className="bg-gray-100 border-l border-gray-300 px-2 py-0.5 text-right font-bold tabular-nums text-xs text-gray-800 sticky right-0 z-10">
                        {fmt(
                          activeGroups.filter(g => g.key !== "inversion").reduce((sum, g) => sum + socioTotal(socio, g.key), 0)
                        )}
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
                        {fmt(data.socios.reduce((s: number, soc: any) => s + (soc.inversion?.montoInvertido ?? 0), 0))}
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
      {!loading && data && data.socios.length === 0 && <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No hay socios en esta ronda</div>}

      {/* Summary cards */}
      {data && data.socios.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Resumen por socio</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.socios.map((socio: any) => (
              <div key={socio.socioId} className="rounded-xl border bg-white p-3 shadow-sm text-xs">
                <p className="font-semibold text-gray-900 text-sm">{socio.nombres} {socio.apellidos}</p>
                <p className="text-[10px] text-gray-400 font-mono mb-2">{socio.numeroCuenta}</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-emerald-700">Ahorros</span><span className="font-semibold tabular-nums">{fmt(socio.totales.ahorros)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-700">Aportes</span><span className="font-semibold tabular-nums">{fmt(socio.totales.aportes)}</span></div>
                  {socio.totales.multas > 0 && <div className="flex justify-between"><span className="text-orange-700">Multas</span><span className="font-semibold tabular-nums">{fmt(socio.totales.multas)}</span></div>}
                  {socio.prestamos?.length > 0 && (
                    <div className="pt-1 border-t mt-1">
                      {socio.prestamos.map((p: any) => (
                        <div key={p.id} className="flex justify-between text-[11px]">
                          <span className="text-purple-700">Préstamo {fmt(p.monto)} <span className="text-[9px]">({p.estado})</span></span>
                          <span className="tabular-nums">Saldo: {fmt(p.saldoActual)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {socio.inversion && (
                    <div className="pt-1 border-t mt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-indigo-700">Inversión {fmt(socio.inversion.montoInvertido)} ({socio.inversion.porcentaje}%)</span>
                        <span className="tabular-nums">Int: {fmt(socio.inversion.intereses)}</span>
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
