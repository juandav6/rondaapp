// app/admin/rondas/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminRondasPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean; efectos?: any[] } | null>(null);

  const showMsg = (text: string, ok: boolean, efectos?: any[]) => { setMsg({ text, ok, efectos }); setTimeout(() => setMsg(null), 6000); };

  async function cargar() {
    try {
      const r = await fetch("/api/rondas/historial");
      const d = await r.json();
      setRondas(Array.isArray(d) ? d : d.rondas ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  function abrirEditar(r: any) {
    setEditando(r);
    setForm({
      nombre: r.nombre ?? "",
      montoAporte: Number(r.montoAporte) || "",
      ahorroObjetivoPorSocio: Number(r.ahorroObjetivoPorSocio) || "",
      semanaActual: r.semanaActual ?? "",
      intervaloDiasCobro: r.intervaloDiasCobro ?? 7,
      fechaInicio: r.fechaInicio ? new Date(r.fechaInicio).toISOString().slice(0, 10) : "",
      fechaFin: r.fechaFin ? new Date(r.fechaFin).toISOString().slice(0, 10) : "",
    });
  }

  async function guardar() {
    if (!editando) return;
    const advertencia = Number(form.montoAporte) !== Number(editando.montoAporte)
      ? `\n⚡ ATENCIÓN: Cambiar el monto de aporte recalculará los préstamos express pendientes.` : "";
    if (!confirm(`¿Confirmar cambios en "${editando.nombre}"?${advertencia}\n\nQuedará registrado en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rondas/${editando.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const efectosMsg = d.efectos?.length ? `\n\nProcesos recalculados: ${d.efectos.map((e: any) => e.descripcion).join(", ")}` : "";
      showMsg(`Ronda actualizada correctamente.${efectosMsg}`, true, d.efectos);
      setEditando(null);
      await cargar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function revertirSemana(r: any) {
    const semanaRevertir = r.semanaActual - 1;
    if (r.semanaActual <= 1) { showMsg("No hay semana que revertir (semanaActual = 1)", false); return; }
    const esCierreFinal = !r.activa;
    const lineas = [
      `¿Revertir la semana ${semanaRevertir} de "${r.nombre}"?`,
      ``,
      `Se ELIMINARÁN todos los datos de esa semana:`,
      `  • Aportes registrados en semana ${semanaRevertir}`,
      `  • Ahorros registrados (se ajustarán los saldos)`,
      `  • Responsable asignado`,
      `  • Intereses express acumulados`,
      esCierreFinal ? `\n⚠️ ADEMÁS se revertirá el CIERRE FINAL:\n  • La ronda se reactivará\n  • Las devoluciones de inversión se revertirán\n  • El reporte Excel se eliminará` : ``,
      `\nEsta acción NO se puede deshacer.`,
    ].filter(Boolean).join("\n");
    if (!confirm(lineas)) return;
    if (esCierreFinal && !confirm("⚠️ Confirmación adicional: estás revirtiendo un CIERRE FINAL. ¿Continuar?")) return;
    try {
      const res = await fetch(`/api/admin/rondas/${r.id}/revertir-semana`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const resumen = d.resumen ?? {};
      showMsg(`Semana ${semanaRevertir} revertida. Eliminados: ${resumen.aportesEliminados ?? 0} aportes, ${resumen.ahorrosEliminados ?? 0} ahorros, ${resumen.expressRevertidos ?? 0} express revertidos.`, true);
      await cargar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  async function eliminar(r: any) {
    const lineas = [
      `⚠️ ¿ELIMINAR PERMANENTEMENTE la ronda "${r.nombre}"?`,
      ``,
      `Se eliminará TODO lo asociado a esta ronda:`,
      `  • Todos los aportes y ahorros`,
      `  • Todos los préstamos y sus cuotas`,
      `  • Todos los préstamos express`,
      `  • Movimientos de caja (multas, gastos, intereses)`,
      `  • Cuentas de inversión y movimientos del fondo`,
      `  • Participaciones de socios`,
      ``,
      `Los saldos de ahorros de los socios se revertirán automáticamente.`,
      r.activa ? `\n🟢 Esta es la ronda ACTIVA. La ronda anterior quedará como activa.` : ``,
      ``,
      `Esta acción NO se puede deshacer.`,
    ].filter(l => l !== null).join("\n");

    if (!confirm(lineas)) return;

    // Segunda confirmación para rondas activas
    if (r.activa) {
      if (!confirm(`⚠️ Confirmación adicional requerida.\n\nEstás eliminando la ronda ACTIVA "${r.nombre}".\n\n¿Estás completamente seguro?`)) return;
    }

    try {
      const res = await fetch(`/api/admin/rondas/${r.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const resumenMsg = d.resumen
        ? ` Eliminados: ${d.resumen.aportes} aportes, ${d.resumen.ahorros} ahorros, ${d.resumen.prestamos} préstamos.`
        : "";
      showMsg(`Ronda "${r.nombre}" eliminada.${resumenMsg}`, true);
      await cargar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  if (loading) return <div className="p-4 space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100"/>)}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Administrar rondas</h1>
        <p className="text-xs text-gray-400">Orden cronológico — solo se puede eliminar la más reciente</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
          <p>{msg.text}</p>
          {msg.efectos && msg.efectos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {msg.efectos.map((e: any, i: number) => (
                <li key={i} className="text-xs">↳ {e.descripcion}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-[600px] w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Ronda</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rondas.map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{r.nombre}</p>
                  <p className="text-xs text-gray-400">{r.fechaInicio ? new Date(r.fechaInicio).toLocaleDateString("es-EC") : "—"}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", r.activa ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                    {r.activa ? "Activa" : "Cerrada"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1.5 justify-center flex-wrap">
                    <button onClick={() => abrirEditar(r)}
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">Editar</button>
                    {r.semanaActual > 1 && (
                      <button onClick={() => revertirSemana(r)}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100">
                        Revertir sem.
                      </button>
                    )}
                    <button onClick={() => eliminar(r)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs hover:bg-red-100",
                        r.activa
                          ? "border-orange-300 bg-orange-50 text-orange-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      )}>
                      {r.activa ? "⚠️ Eliminar" : "Eliminar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl bg-white p-4 sm:p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Editar ronda</h3>
            <p className="text-xs text-gray-400 mb-4">ID #{editando.id} · {editando.activa ? "🟢 Activa" : "⚪ Cerrada"}</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre</label>
                <input type="text" value={form.nombre ?? ""} onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Fecha inicio</label>
                  <input type="date" value={form.fechaInicio ?? ""} onChange={e => setForm((p: any) => ({ ...p, fechaInicio: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Fecha fin {!editando.activa && <span className="text-amber-500 font-normal">editable</span>}
                  </label>
                  <input type="date" value={form.fechaFin ?? ""} onChange={e => setForm((p: any) => ({ ...p, fechaFin: e.target.value }))}
                    disabled={editando.activa}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-400"/>
                  {editando.activa
                    ? <p className="text-[10px] text-gray-400 mt-0.5">Se calcula al cerrar la ronda</p>
                    : <p className="text-[10px] text-amber-600 mt-0.5">Corrige si se guardó la fecha de hoy en vez de la fecha real</p>}
                </div>
              </div>
            </div>
            {Number(form.montoAporte) !== Number(editando.montoAporte) && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                ⚡ Cambiar el monto de aporte recalculará el principal de todos los préstamos express pendientes.
              </div>
            )}
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">
              📋 Cambios registrados en bitácora con fecha y hora.
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
