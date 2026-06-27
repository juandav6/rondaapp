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
  { key: "transferencias", label: "Transferencias", color: "bg-purple-100 text-purple-800", cellBg: "bg-purple-50/50", headerBg: "bg-purple-50", default: false },
] as const;

type ColKey = typeof COL_GROUPS[number]["key"];

/* ── Types ─────────────────────────────────────────────────── */

type ChangeHistoryEntry = {
  id: number; timestamp: Date; tipo: string; campo: string; socioNombre: string;
  valorAntes: number | null; valorDespues: number; ok: boolean; error?: string; efectos?: string[];
};

type PendingChange = {
  tipo: string; recordId: number | null; nuevoValor: number; valorAnterior: number | null;
  socioNombre: string; semana?: number; campo: string;
};

/* ── Editable Cell ─────────────────────────────────────────── */

function EditCell({ value, onSave, bgClass, pendingValue, isPending }: {
  value: number | null; onSave: (v: number) => void; bgClass: string;
  pendingValue?: number; isPending?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const displayVal = isPending ? pendingValue! : value;

  function start() { setVal(displayVal != null ? String(displayVal) : "0"); setEditing(true); setTimeout(() => ref.current?.select(), 10); }
  function save() {
    const n = parseFloat(val);
    if (!isNaN(n) && n !== displayVal) onSave(n);
    setEditing(false);
  }

  if (editing) return (
    <td className={cn("px-1 py-0.5", bgClass)}>
      <input ref={ref} type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)}
        onBlur={save} onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="w-16 rounded border border-blue-400 px-1 py-0.5 text-[11px] text-right focus:outline-none bg-white" autoFocus />
    </td>
  );

  const empty = displayVal == null;
  const zero = displayVal === 0;
  return (
    <td onClick={start} className={cn(
      "px-1 py-0.5 text-right cursor-pointer hover:ring-1 hover:ring-blue-300 hover:ring-inset transition-shadow whitespace-nowrap",
      bgClass, isPending && "ring-2 ring-red-400 bg-red-50"
    )} title="Click para editar">
      <span className={cn("tabular-nums text-[11px]", empty && "text-gray-300", zero && !empty && "text-gray-400", !empty && !zero && "text-gray-800 font-medium")}>
        {empty ? "—" : fmt(displayVal)}
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

  // F4: Change history
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyCounter = useRef(0);

  // F2: Batch editing
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);

  // F3: Delete participations
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());
  const [deletePreview, setDeletePreview] = useState<any>(null);
  const [showDeletePreview, setShowDeletePreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  /* ── Silent API (for batch mode) ─────────────────────────── */

  async function editarValorSilent(tipo: string, recordId: number | null, monto: number): Promise<{ ok: boolean; error?: string }> {
    if (!recordId) return { ok: false, error: "No existe registro para editar" };
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: recordId, datos: { monto } }),
      });
      if (!res.ok) { const d = await res.json(); return { ok: false, error: d.error }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }

  async function editarInversionSilent(cuentaId: number, montoInvertido: number): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "cuentaInversion", id: cuentaId, datos: { montoInvertido } }),
      });
      if (!res.ok) { const d = await res.json(); return { ok: false, error: d.error }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }

  /* ── Batch edit helpers ────────────────────────────────────── */

  function handleCellEdit(changeKey: string, change: PendingChange) {
    setPendingChanges(prev => {
      const next = new Map(prev);
      next.set(changeKey, change);
      return next;
    });
  }

  async function executeBatchSave() {
    setBatchSaving(true);
    const entries = Array.from(pendingChanges.entries());
    const results: ChangeHistoryEntry[] = [];

    for (const [, change] of entries) {
      let result: { ok: boolean; error?: string };
      if (change.tipo === "cuentaInversion") {
        result = await editarInversionSilent(change.recordId!, change.nuevoValor);
      } else {
        result = await editarValorSilent(change.tipo, change.recordId, change.nuevoValor);
      }
      historyCounter.current += 1;
      results.push({
        id: historyCounter.current, timestamp: new Date(), tipo: change.tipo,
        campo: change.campo, socioNombre: change.socioNombre,
        valorAntes: change.valorAnterior, valorDespues: change.nuevoValor,
        ok: result.ok, error: result.error,
        efectos: change.tipo === "cuentaInversion" && result.ok ? ["% interés recalculado"] : undefined,
      });
    }

    setChangeHistory(prev => [...results, ...prev]);
    setPendingChanges(new Map());
    setShowConfirmSave(false);
    setBatchSaving(false);

    const failed = results.filter(r => !r.ok).length;
    if (failed > 0) showMsg(`${results.length - failed} guardados, ${failed} errores`, false);
    else showMsg(`${results.length} cambios guardados correctamente`, true);

    cargar();
  }

  /* ── Delete participations helpers ─────────────────────────── */

  function toggleSelectSocio(socioId: number) {
    setSelectedForDelete(prev => {
      const next = new Set(prev);
      if (next.has(socioId)) next.delete(socioId); else next.add(socioId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    const allIds = data.socios.map((s: any) => s.socioId);
    if (selectedForDelete.size === allIds.length) setSelectedForDelete(new Set());
    else setSelectedForDelete(new Set(allIds));
  }

  async function fetchDeletePreview() {
    if (!rondaId || selectedForDelete.size === 0) return;
    try {
      const res = await fetch(`/api/admin/rondas/${rondaId}/eliminar-participaciones`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioIds: Array.from(selectedForDelete), preview: true }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al obtener vista previa"); }
      const preview = await res.json();
      setDeletePreview(preview);
      setShowDeletePreview(true);
    } catch (e: any) { showMsg(e.message, false); }
  }

  async function executeDelete() {
    if (!rondaId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/rondas/${rondaId}/eliminar-participaciones`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioIds: Array.from(selectedForDelete) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al eliminar"); }
      const result = await res.json();
      historyCounter.current += 1;
      setChangeHistory(prev => [{
        id: historyCounter.current, timestamp: new Date(), tipo: "eliminacion",
        campo: "participaciones", socioNombre: `${selectedForDelete.size} socios`,
        valorAntes: null, valorDespues: 0, ok: true,
        efectos: result.detalles?.map((d: any) => `${d.socio}: ${d.registrosEliminados} registros`) ?? [],
      }, ...prev]);
      showMsg(`Participaciones eliminadas correctamente`, true);
      setSelectedForDelete(new Set());
      setDeleteMode(false);
      setShowDeleteConfirm(false);
      setShowDeletePreview(false);
      setDeletePreview(null);
      cargar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setDeleting(false); }
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

  function getRecordId(socio: any, sem: number, key: ColKey): number | null {
    const s = socio.semanas?.[String(sem)];
    if (!s) return null;
    if (key === "ahorros") return s.ahorroId ?? null;
    if (key === "aportes") return s.aporteId ?? null;
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

        {/* Column toggles + delete mode */}
        <div className="flex flex-wrap gap-2 pt-1 items-center">
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
          {data && (
            <button onClick={() => { setDeleteMode(!deleteMode); if (deleteMode) { setSelectedForDelete(new Set()); } }}
              className={cn("ml-auto rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors",
                deleteMode ? "border-red-500 bg-red-50 text-red-700" : "border-red-300 text-red-600 hover:bg-red-50"
              )}>
              {deleteMode ? "Cancelar eliminacion" : "Eliminar participaciones"}
            </button>
          )}
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
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600">
            Socios: {data.socios.filter((s: any) => !s.soloInversor).length}
            {data.socios.some((s: any) => s.soloInversor) && (
              <span className="text-indigo-600"> + {data.socios.filter((s: any) => s.soloInversor).length} inversores</span>
            )}
          </span>
        </div>
      )}

      {/* F3: Delete mode action bar */}
      {deleteMode && selectedForDelete.size > 0 && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 shadow-sm flex items-center gap-3">
          <span className="text-sm font-semibold text-red-700">{selectedForDelete.size} seleccionados</span>
          <button onClick={fetchDeletePreview}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700">
            Vista previa
          </button>
          <button onClick={() => { setDeleteMode(false); setSelectedForDelete(new Set()); }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      )}

      {/* Main table */}
      {data && data.socios.length > 0 && colsPerWeek > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div ref={tableRef} className="overflow-x-auto" style={{ maxHeight: "75vh" }}>
            <table className="border-collapse text-[11px]">
              {/* Header row 1: Socio + Inversión + week groups */}
              <thead className="sticky top-0 z-20">
                <tr>
                  {/* F3: Select-all checkbox */}
                  {deleteMode && (
                    <th rowSpan={2} className="sticky left-0 z-30 bg-gray-200 border border-gray-300 px-2 py-2 text-center w-8">
                      <input type="checkbox" checked={data && selectedForDelete.size === data.socios.length}
                        onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-gray-300 text-red-600" />
                    </th>
                  )}
                  <th rowSpan={2} className={cn("z-30 bg-gray-200 border border-gray-300 px-3 py-2 text-left text-xs font-bold text-gray-800 min-w-[180px]", deleteMode ? "" : "sticky left-0")}>
                    Socio
                  </th>

                  {/* Inversión columns header (if visible) */}
                  {visibles.inversion && (
                    <th colSpan={2} className="bg-indigo-100 border border-indigo-200 px-2 py-1.5 text-center text-xs font-bold text-indigo-800">
                      Fondo de Inversión
                    </th>
                  )}

                  {/* Transferencias header (if visible) */}
                  {visibles.transferencias && (
                    <th colSpan={5} className="bg-purple-100 border border-purple-200 px-2 py-1.5 text-center text-xs font-bold text-purple-800">
                      Transferencias de Fondo
                    </th>
                  )}

                  {/* Week group headers */}
                  {semanaKeys.map(sem => {
                    const weekCols = activeGroups.filter(g => g.key !== "inversion" && g.key !== "transferencias");
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
                <tr>
                  {/* Inversión sub-headers */}
                  {visibles.inversion && (
                    <>
                      <th className="bg-indigo-100 border border-indigo-200 px-1 py-1 text-center text-[10px] font-semibold text-indigo-700 min-w-[75px]">Valor</th>
                      <th className="bg-indigo-100 border border-indigo-200 px-1 py-1 text-center text-[10px] font-semibold text-indigo-700 min-w-[60px]">% Interés</th>
                    </>
                  )}

                  {/* Transferencias sub-headers */}
                  {visibles.transferencias && (
                    <>
                      <th className="bg-purple-100 border border-purple-200 px-1 py-1 text-center text-[10px] font-semibold text-purple-700 min-w-[80px]">Inv. Inicial</th>
                      <th className="bg-purple-100 border border-purple-200 px-1 py-1 text-center text-[10px] font-semibold text-purple-700 min-w-[80px]">Transf. (+)</th>
                      <th className="bg-purple-100 border border-purple-200 px-1 py-1 text-center text-[10px] font-semibold text-purple-800 min-w-[80px] font-bold">Total Inv.</th>
                      <th className="bg-purple-100 border border-purple-200 px-1 py-1 text-center text-[10px] font-semibold text-purple-700 min-w-[80px]">Devolución</th>
                      <th className="bg-purple-100 border border-purple-200 px-1 py-1 text-center text-[10px] font-semibold text-purple-700 min-w-[80px]">Intereses</th>
                    </>
                  )}

                  {/* Per-week sub-headers */}
                  {semanaKeys.map(sem =>
                    activeGroups.filter(g => g.key !== "inversion" && g.key !== "transferencias").map(g => (
                      <th key={`${sem}-${g.key}`} className={cn("border border-gray-200 px-1 py-1 text-center text-[10px] font-semibold min-w-[80px] bg-white", g.color)}>
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
                  const socioFullName = `${socio.nombres} ${socio.apellidos}`;

                  return (
                    <tr key={socio.socioId} className={cn("border-b border-gray-200 hover:bg-yellow-50/30", rowBg)}>
                      {/* F3: Delete checkbox */}
                      {deleteMode && (
                        <td className={cn("border-r border-gray-300 px-2 py-1.5 text-center", even ? "bg-white" : "bg-gray-50")}>
                          <input type="checkbox" checked={selectedForDelete.has(socio.socioId)}
                            onChange={() => toggleSelectSocio(socio.socioId)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-red-600" />
                        </td>
                      )}
                      {/* Sticky name */}
                      <td className={cn("z-10 border-r border-gray-300 px-2 py-1.5", deleteMode ? "" : "sticky left-0", even ? "bg-white" : "bg-gray-50")}>
                        <div className="flex items-center gap-1">
                          <p className="font-semibold text-gray-900 text-xs leading-tight truncate max-w-[170px]">{socioFullName}</p>
                          {socio.soloInversor && <span className="shrink-0 rounded bg-indigo-100 text-indigo-700 px-1 py-0.5 text-[8px] font-bold">Inversor</span>}
                        </div>
                        <p className="text-[9px] text-gray-400 font-mono">{socio.numeroCuenta}</p>
                      </td>

                      {/* Inversión cells */}
                      {visibles.inversion && (() => {
                        const invKey = `inv-${socio.socioId}`;
                        const pending = pendingChanges.get(invKey);
                        return (
                          <>
                            {socio.inversion?.id ? (
                              <EditCell value={socio.inversion.montoInvertido} bgClass="bg-indigo-50/50 border-r border-indigo-100"
                                isPending={!!pending} pendingValue={pending?.nuevoValor}
                                onSave={(v) => handleCellEdit(invKey, {
                                  tipo: "cuentaInversion", recordId: socio.inversion.id, nuevoValor: v,
                                  valorAnterior: socio.inversion.montoInvertido, socioNombre: socioFullName, campo: "Inversion",
                                })} />
                            ) : (
                              <ReadCell value={null} bgClass="bg-indigo-50/50 border-r border-indigo-100" />
                            )}
                            <ReadCell value={socio.inversion ? `${socio.inversion.porcentaje}%` : null} bgClass="bg-indigo-50/50 border-r border-indigo-100" />
                          </>
                        );
                      })()}

                      {/* Transferencias cells */}
                      {visibles.transferencias && (() => {
                        const t = socio.transferencias ?? {};
                        const transfIntermedias = (t.transferenciasIntermedias ?? []).reduce((s: number, x: any) => s + x.monto, 0);
                        return (
                          <>
                            <ReadCell value={t.inversionInicial || null} bgClass="bg-purple-50/50 border-r border-purple-100" />
                            <ReadCell value={transfIntermedias || null} bgClass="bg-purple-50/40 border-r border-purple-100" />
                            <ReadCell value={t.totalInvertido || null} bgClass="bg-purple-100/60 border-r border-purple-200" />
                            <ReadCell value={t.devolucion || null} bgClass="bg-purple-50/50 border-r border-purple-100" />
                            <ReadCell value={t.intereses || null} bgClass="bg-purple-50/50 border-r border-purple-100" />
                          </>
                        );
                      })()}

                      {/* Per-week data cells */}
                      {semanaKeys.map(sem =>
                        activeGroups.filter(g => g.key !== "inversion" && g.key !== "transferencias").map(g => {
                          const val = getVal(socio, sem, g.key);
                          const editable = (g.key === "ahorros" || g.key === "aportes") && !socio.soloInversor;
                          if (editable) {
                            const recId = getRecordId(socio, sem, g.key);
                            const cellKey = `${g.key}-${socio.socioId}-${sem}`;
                            const pending = pendingChanges.get(cellKey);
                            const tipo = g.key === "ahorros" ? "ahorro" : "aporte";
                            return (
                              <EditCell key={`${sem}-${g.key}`} value={val}
                                isPending={!!pending} pendingValue={pending?.nuevoValor}
                                onSave={(v) => handleCellEdit(cellKey, {
                                  tipo, recordId: recId, nuevoValor: v, valorAnterior: val,
                                  socioNombre: socioFullName, semana: sem, campo: `${g.label} S${sem}`,
                                })}
                                bgClass={cn(g.cellBg, "border-r border-gray-100") as string} />
                            );
                          }
                          return <ReadCell key={`${sem}-${g.key}`} value={val} bgClass={cn(g.cellBg, "border-r border-gray-100") as string} />;
                        })
                      )}

                      {/* Row total */}
                      <td className="bg-gray-100 border-l border-gray-300 px-2 py-0.5 text-right font-bold tabular-nums text-xs text-gray-800 sticky right-0 z-10">
                        {fmt(
                          activeGroups.filter(g => g.key !== "inversion" && g.key !== "transferencias").reduce((sum, g) => sum + socioTotal(socio, g.key), 0)
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* TOTALS row */}
                <tr className="border-t-2 border-gray-400 font-bold bg-gray-100">
                  {deleteMode && <td className="bg-gray-200 border-r border-gray-300" />}
                  <td className={cn("z-10 bg-gray-200 border-r border-gray-300 px-2 py-2 text-xs font-bold text-gray-800", deleteMode ? "" : "sticky left-0")}>
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

                  {visibles.transferencias && (() => {
                    const all = data.socios.map((s: any) => s.transferencias ?? {});
                    const sumField = (f: string) => all.reduce((s: number, t: any) => s + (t[f] ?? 0), 0);
                    const sumTransf = all.reduce((s: number, t: any) => s + (t.transferenciasIntermedias ?? []).reduce((a: number, x: any) => a + x.monto, 0), 0);
                    return (
                      <>
                        <td className="bg-purple-100 border-r border-purple-200 px-1 py-2 text-right text-xs font-bold tabular-nums text-purple-800">
                          {fmt(sumField("inversionInicial"))}
                        </td>
                        <td className="bg-purple-100 border-r border-purple-200 px-1 py-2 text-right text-xs font-bold tabular-nums text-purple-800">
                          {fmt(sumTransf)}
                        </td>
                        <td className="bg-purple-200 border-r border-purple-300 px-1 py-2 text-right text-xs font-extrabold tabular-nums text-purple-900">
                          {fmt(sumField("totalInvertido"))}
                        </td>
                        <td className="bg-purple-100 border-r border-purple-200 px-1 py-2 text-right text-xs font-bold tabular-nums text-purple-800">
                          {fmt(sumField("devolucion"))}
                        </td>
                        <td className="bg-purple-100 border-r border-purple-200 px-1 py-2 text-right text-xs font-bold tabular-nums text-purple-800">
                          {fmt(sumField("intereses"))}
                        </td>
                      </>
                    );
                  })()}

                  {semanaKeys.map(sem =>
                    activeGroups.filter(g => g.key !== "inversion" && g.key !== "transferencias").map(g => (
                      <td key={`t-${sem}-${g.key}`} className={cn("px-1 py-2 text-right tabular-nums text-xs border-r border-gray-200", g.headerBg)}>
                        <span className={colTotal(sem, g.key) === 0 ? "text-gray-400" : "text-gray-900 font-bold"}>
                          {fmt(colTotal(sem, g.key))}
                        </span>
                      </td>
                    ))
                  )}

                  <td className="bg-gray-200 px-2 py-2 text-right text-xs font-extrabold tabular-nums text-gray-900 sticky right-0 z-10">
                    {fmt(
                      activeGroups.filter(g => g.key !== "inversion" && g.key !== "transferencias").reduce((sum, g) => sum + grandTotal(g.key), 0)
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

      {/* Historial de transferencias */}
      {data && visibles.transferencias && (() => {
        const allHistorial = data.socios.flatMap((s: any) =>
          (s.transferencias?.historial ?? []).map((h: any) => ({ ...h, socio: `${s.nombres} ${s.apellidos}`, cuenta: s.numeroCuenta }))
        ).sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        if (allHistorial.length === 0) return null;
        const fmtD = (iso: string) => new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
        const tipoCfg: Record<string, { label: string; color: string }> = {
          INVERSION: { label: "Inversión", color: "text-blue-700 bg-blue-50" },
          DEVOLUCION: { label: "Devolución", color: "text-emerald-700 bg-emerald-50" },
          INTERES: { label: "Interés", color: "text-amber-700 bg-amber-50" },
        };
        return (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-purple-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-purple-800">Historial de transferencias de fondo ({allHistorial.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Socio</th>
                    <th className="px-3 py-2 text-center">Tipo</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-left">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {allHistorial.map((h: any, i: number) => {
                    const cfg = tipoCfg[h.tipo] ?? { label: h.tipo, color: "text-gray-600 bg-gray-50" };
                    return (
                      <tr key={h.id} className={i % 2 === 0 ? "" : "bg-gray-50/40"}>
                        <td className="px-3 py-1.5 text-gray-600">{fmtD(h.fecha)}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-800">{h.socio}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.color)}>{cfg.label}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmt(h.monto)}</td>
                        <td className="px-3 py-1.5 text-gray-500 truncate max-w-[200px]">{h.nota ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* F4: Session change history */}
      {changeHistory.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <button onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between border-b bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors">
            <h2 className="text-sm font-semibold text-gray-800">
              Cambios en esta sesion ({changeHistory.length})
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setChangeHistory([]); }}
                className="text-[10px] text-red-500 hover:text-red-700 font-medium">Limpiar historial</button>
              <span className="text-xs text-gray-400">{historyOpen ? "▲" : "▼"}</span>
            </div>
          </button>
          {historyOpen && (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {changeHistory.map(entry => (
                <div key={entry.id} className={cn("px-4 py-2 text-xs", entry.ok ? "" : "bg-red-50/50")}>
                  <div className="flex items-center gap-2">
                    <span className={cn("shrink-0 w-1.5 h-1.5 rounded-full", entry.ok ? "bg-emerald-500" : "bg-red-500")} />
                    <span className="text-gray-400 tabular-nums">
                      {entry.timestamp.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className="font-medium text-gray-800">{entry.socioNombre}</span>
                    <span className="text-gray-500">{entry.campo}</span>
                    <span className="ml-auto tabular-nums text-gray-600">
                      {entry.valorAntes != null ? fmt(entry.valorAntes) : "—"} → {fmt(entry.valorDespues)}
                    </span>
                    {!entry.ok && <span className="text-red-600 text-[10px]">{entry.error}</span>}
                  </div>
                  {entry.efectos && entry.efectos.length > 0 && (
                    <div className="ml-5 mt-0.5 space-y-0.5">
                      {entry.efectos.map((ef, i) => (
                        <p key={i} className="text-[10px] text-gray-400">↳ {ef}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* F2: Floating action bar for pending changes */}
      {pendingChanges.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-white shadow-2xl border-2 border-red-300 px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-semibold text-red-700">{pendingChanges.size} cambio{pendingChanges.size !== 1 ? "s" : ""} sin guardar</span>
          <button onClick={() => setPendingChanges(new Map())}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            Descartar
          </button>
          <button onClick={() => setShowConfirmSave(true)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            Guardar cambios
          </button>
        </div>
      )}

      {/* F2: Confirm save dialog */}
      {showConfirmSave && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-2xl shadow-xl max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b">
              <h3 className="text-base font-bold text-gray-900">Confirmar {pendingChanges.size} cambio{pendingChanges.size !== 1 ? "s" : ""}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Revisa los cambios antes de guardar</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-gray-100">
              {Array.from(pendingChanges.values()).map((c, i) => (
                <div key={i} className="py-2 flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-800 truncate max-w-[200px]">{c.socioNombre}</span>
                  <span className="text-gray-400">{c.campo}</span>
                  <span className="ml-auto tabular-nums whitespace-nowrap">
                    <span className="text-red-500 line-through">{c.valorAnterior != null ? fmt(c.valorAnterior) : "—"}</span>
                    {" → "}
                    <span className="text-emerald-700 font-semibold">{fmt(c.nuevoValor)}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t flex gap-3 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowConfirmSave(false)} disabled={batchSaving}
                className="flex-1 rounded-xl border bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={executeBatchSave} disabled={batchSaving}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {batchSaving ? "Guardando..." : "Confirmar y guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F3: Delete preview modal */}
      {showDeletePreview && deletePreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-2xl shadow-xl max-h-[80vh] flex flex-col">
            <div className="bg-red-500 px-5 py-4 rounded-t-2xl">
              <h3 className="text-base font-bold text-white">Eliminar participaciones</h3>
              <p className="text-xs text-red-100 mt-0.5">{deletePreview.detalles?.length ?? 0} socio(s) seleccionados</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Socio</th>
                    <th className="px-3 py-2 text-center">Aportes</th>
                    <th className="px-3 py-2 text-center">Ahorros</th>
                    <th className="px-3 py-2 text-center">Express</th>
                    <th className="px-3 py-2 text-center">Inversión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(deletePreview.detalles ?? []).map((d: any) => (
                    <tr key={d.socioId}>
                      <td className="px-3 py-2 font-medium text-gray-800">{d.socio}</td>
                      <td className="px-3 py-2 text-center">{d.aportes}</td>
                      <td className="px-3 py-2 text-center">{d.ahorros}</td>
                      <td className="px-3 py-2 text-center">{d.express}</td>
                      <td className="px-3 py-2 text-center">{d.inversion ? fmt(d.inversionMonto) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deletePreview.efectos && deletePreview.efectos.length > 0 && (
                <div className="px-5 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
                  <p className="font-semibold mb-1">Efectos en cascada:</p>
                  {deletePreview.efectos.map((ef: string, i: number) => (
                    <p key={i} className="text-[11px]">↳ {ef}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t flex gap-3 bg-gray-50 rounded-b-2xl">
              <button onClick={() => { setShowDeletePreview(false); setDeletePreview(null); }}
                className="flex-1 rounded-xl border bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => { setShowDeletePreview(false); setShowDeleteConfirm(true); }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F3: Delete final confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full sm:max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm.75 5.5a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6ZM12 17.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
                </svg>
              </span>
              <div>
                <h4 className="text-base font-bold text-gray-900">¿Estás seguro?</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Se eliminarán <strong>{selectedForDelete.size}</strong> participaciones con todos sus datos asociados.
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={executeDelete} disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
