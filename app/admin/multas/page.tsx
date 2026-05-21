// app/admin/multas/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d); };
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminMultasPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [multas, setMultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  useEffect(() => {
    fetch("/api/rondas/historial").then(r => r.json()).then(d => setRondas(Array.isArray(d) ? d : d.rondas ?? []));
  }, []);

  async function buscar() {
    if (!rondaId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rondas/${rondaId}/caja`);
      const d = await res.json();
      // Todos los movimientos tipo MULTA (pendientes y cobradas)
      setMultas((d.movimientos ?? []).filter((m: any) => m.tipo === "MULTA"));
    } finally { setLoading(false); }
  }

  async function guardar() {
    if (!editando) return;
    if (!confirm(`¿Confirmar cambio en esta multa?\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "movimientoCaja", id: editando.id, datos: { monto: Number(form.monto), descripcion: form.descripcion, estado: form.estado, semana: Number(form.semana) } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Multa actualizada correctamente", true);
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminar(m: any) {
    if (!confirm(`¿Eliminar esta multa de ${fmt(m.monto)} de ${m.socio?.nombres ?? ""}?\n\nSi estaba COBRADA, el saldo de caja se recalculará.\nQuedará en bitácora.`)) return;
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "movimientoCaja", id: m.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showMsg("Multa eliminada", true);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  async function cambiarEstado(m: any, nuevoEstado: string) {
    if (!rondaId) return;
    const msg2 = nuevoEstado === "COBRADO"
      ? `¿Marcar esta multa como COBRADA? El valor ${fmt(m.monto)} ingresará a la caja.`
      : `¿Revertir esta multa a PENDIENTE? El valor saldrá del saldo de caja.`;
    if (!confirm(msg2 + "\n\nQuedará en bitácora.")) return;
    try {
      const res = await fetch(`/api/rondas/${rondaId}/caja/${m.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "cobrar" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showMsg(`Multa marcada como ${nuevoEstado}`, true);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  const totalPendiente = multas.filter(m => m.estado === "PENDIENTE").reduce((s, m) => s + m.monto, 0);
  const totalCobrado = multas.filter(m => m.estado === "COBRADO").reduce((s, m) => s + m.monto, 0);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Administrar multas</h1>
        <p className="text-xs text-gray-400">Ver, editar y eliminar multas · cambiar estado pendiente/cobrado</p>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      {/* Filtro */}
      <div className="rounded-xl border bg-white p-4 shadow-sm flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda</label>
          <select value={rondaId ?? ""} onChange={e => setRondaId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
            <option value="">— Seleccionar ronda —</option>
            {rondas.map((r: any) => <option key={r.id} value={r.id}>{r.nombre} {r.activa ? "✓" : ""}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={buscar} disabled={!rondaId || loading}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-40">
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {multas.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-[10px] text-amber-600 font-semibold uppercase">Pendientes</p>
            <p className="text-lg font-bold text-amber-700">{fmt(totalPendiente)}</p>
            <p className="text-[10px] text-amber-400">{multas.filter(m => m.estado === "PENDIENTE").length} multas</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase">Cobradas</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(totalCobrado)}</p>
            <p className="text-[10px] text-emerald-400">{multas.filter(m => m.estado === "COBRADO").length} multas</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Total</p>
            <p className="text-lg font-bold text-gray-700">{fmt(totalPendiente + totalCobrado)}</p>
            <p className="text-[10px] text-gray-400">{multas.length} registros</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {multas.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-center">Semana</th>
                  <th className="px-4 py-3 text-left">Observación</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Fecha</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {multas.map((m: any) => (
                  <tr key={m.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.socio?.nombres} {m.socio?.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{m.socio?.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.semana ? <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{m.semana}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{m.descripcion || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">{fmt(m.monto)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                        m.estado === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                        {m.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDate(m.fecha)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {m.estado === "PENDIENTE" && (
                          <button onClick={() => cambiarEstado(m, "COBRADO")}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] text-white hover:bg-emerald-700">Cobrar</button>
                        )}
                        <button onClick={() => { setEditando(m); setForm({ monto: m.monto, descripcion: m.descripcion ?? "", estado: m.estado, semana: m.semana ?? "" }); }}
                          className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700">Editar</button>
                        <button onClick={() => eliminar(m)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700 hover:bg-red-100">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Editar multa</h3>
            <p className="text-xs text-gray-400 mb-4">{editando.socio?.nombres} {editando.socio?.apellidos}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Monto ($)</label>
                  <input type="number" step="0.01" value={form.monto ?? ""} onChange={e => setForm((p: any) => ({ ...p, monto: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Semana</label>
                  <input type="number" min="1" value={form.semana ?? ""} onChange={e => setForm((p: any) => ({ ...p, semana: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Observación</label>
                <input type="text" value={form.descripcion ?? ""} onChange={e => setForm((p: any) => ({ ...p, descripcion: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Estado</label>
                <select value={form.estado ?? ""} onChange={e => setForm((p: any) => ({ ...p, estado: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="COBRADO">COBRADO</option>
                </select>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">📋 Cambio registrado en bitácora.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
