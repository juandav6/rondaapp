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
    setForm({ nombre: r.nombre, montoAporte: r.montoAporte, ahorroObjetivoPorSocio: r.ahorroObjetivoPorSocio, semanaActual: r.semanaActual, intervaloDiasCobro: r.intervaloDiasCobro ?? 7 });
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
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Ronda</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Monto aporte</th>
              <th className="px-4 py-3 text-center">Semana</th>
              <th className="px-4 py-3 text-center">Participantes</th>
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
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(r.montoAporte)}</td>
                <td className="px-4 py-3 text-center text-sm font-medium">{r.semanaActual}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-500">{r._count?.participaciones ?? r.participaciones?.length ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1.5 justify-center">
                    <button onClick={() => abrirEditar(r)}
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">Editar</button>
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

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Editar ronda</h3>
            <p className="text-xs text-gray-400 mb-4">ID #{editando.id} · {editando.activa ? "🟢 Activa" : "⚪ Cerrada"}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre</label>
                <input type="text" value={form.nombre ?? ""} onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Monto aporte ($)</label>
                  <input type="number" step="0.01" value={form.montoAporte ?? ""} onChange={e => setForm((p: any) => ({ ...p, montoAporte: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Objetivo ahorro ($)</label>
                  <input type="number" step="0.01" value={form.ahorroObjetivoPorSocio ?? ""} onChange={e => setForm((p: any) => ({ ...p, ahorroObjetivoPorSocio: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Semana actual</label>
                  <input type="number" min="1" value={form.semanaActual ?? ""} onChange={e => setForm((p: any) => ({ ...p, semanaActual: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Intervalo días</label>
                  <input type="number" min="1" value={form.intervaloDiasCobro ?? 7} onChange={e => setForm((p: any) => ({ ...p, intervaloDiasCobro: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
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
            <div className="mt-4 flex gap-2">
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
