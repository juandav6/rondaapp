// app/admin/express/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d); };
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminExpressCajaPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [express, setExpress] = useState<any[]>([]);
  const [movCaja, setMovCaja] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"express" | "caja">("express");
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
      const [expressRes, cajaRes] = await Promise.all([
        fetch(`/api/prestamos/express?rondaId=${rondaId}`),
        fetch(`/api/rondas/${rondaId}/caja`),
      ]);
      const exp = await expressRes.json();
      const caja = await cajaRes.json();
      setExpress(exp.prestamos ?? []);
      setMovCaja(caja.movimientos ?? []);
    } finally { setLoading(false); }
  }

  async function guardar() {
    if (!editando) return;
    const tipo = tab === "express" ? "express" : "movimientoCaja";
    if (!confirm(`¿Confirmar cambio en ${tipo === "express" ? "préstamo express" : "movimiento de caja"}?\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: editando.id, datos: form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Actualizado correctamente", true);
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminar(id: number, tipo: string, descripcion: string) {
    if (!confirm(`¿Eliminar este ${tipo}?\n${descripcion}\n\nQuedará en bitácora.`)) return;
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Eliminado correctamente", true);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Préstamos express y caja común</h1>
        <p className="text-xs text-gray-400">Editar y eliminar registros de express y movimientos de caja</p>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      {/* Filtro */}
      <div className="rounded-xl border bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex-1 min-w-0 sm:min-w-[200px]">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda</label>
          <select value={rondaId ?? ""} onChange={e => setRondaId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
            <option value="">— Seleccionar ronda —</option>
            {rondas.map((r: any) => <option key={r.id} value={r.id}>{r.nombre} {r.activa ? "✓" : ""}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={buscar} disabled={!rondaId || loading}
            className="w-full sm:w-auto rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-40">
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {(["express", "caja"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t === "express" ? `Préstamos express (${express.length})` : `Movimientos caja (${movCaja.length})`}
          </button>
        ))}
      </div>

      {/* Tabla Express */}
      {tab === "express" && express.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-center">Sem.</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">Interés</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {express.map((e: any) => (
                  <tr key={e.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{e.socio?.nombres} {e.socio?.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{e.socio?.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">{e.semana}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(e.principal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-indigo-700 font-semibold">{fmt(e.interesAcumulado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold">{fmt(e.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                        e.estado === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                        {e.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => { setEditando(e); setForm({ principal: e.principal, interesAcumulado: e.interesAcumulado, estado: e.estado, observaciones: e.observaciones ?? "" }); }}
                          className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs text-white hover:bg-amber-600">Editar</button>
                        <button onClick={() => eliminar(e.id, "express", `${e.socio?.nombres} · Sem.${e.semana}`)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla Movimientos Caja */}
      {tab === "caja" && movCaja.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Socio / Descripción</th>
                  <th className="px-4 py-3 text-center">Sem.</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Fecha</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movCaja.map((m: any) => (
                  <tr key={m.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                        m.tipo === "MULTA" ? "bg-amber-100 text-amber-700" :
                        m.tipo === "INTERES_EXPRESS" ? "bg-indigo-100 text-indigo-700" :
                        "bg-red-100 text-red-700")}>
                        {m.tipo === "MULTA" ? "Multa" : m.tipo === "INTERES_EXPRESS" ? "Interés exp." : "Gasto"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.socio ? <p className="font-medium text-gray-900">{m.socio.nombres} {m.socio.apellidos}</p> : null}
                      {m.descripcion && <p className="text-xs text-gray-400">{m.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">{m.semana ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                        m.estado === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                        {m.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(m.monto)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDate(m.fecha)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => { setEditando(m); setForm({ monto: m.monto, descripcion: m.descripcion ?? "", estado: m.estado, semana: m.semana ?? "" }); }}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">Editar</button>
                        <button onClick={() => eliminar(m.id, "movimientoCaja", m.descripcion ?? m.tipo)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">Eliminar</button>
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
            <h3 className="text-base font-semibold mb-1">
              {tab === "express" ? "Editar préstamo express" : "Editar movimiento de caja"}
            </h3>
            <p className="text-xs text-gray-400 mb-4">ID #{editando.id}</p>
            <div className="space-y-3">
              {tab === "express" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Principal ($)</label>
                      <input type="number" step="0.01" value={form.principal ?? ""} onChange={e => setForm((p: any) => ({ ...p, principal: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Interés ($)</label>
                      <input type="number" step="0.01" value={form.interesAcumulado ?? ""} onChange={e => setForm((p: any) => ({ ...p, interesAcumulado: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Estado</label>
                    <select value={form.estado ?? ""} onChange={e => setForm((p: any) => ({ ...p, estado: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="COBRADO">COBRADO</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Observaciones</label>
                    <input type="text" value={form.observaciones ?? ""} onChange={e => setForm((p: any) => ({ ...p, observaciones: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Monto ($)</label>
                    <input type="number" step="0.01" value={form.monto ?? ""} onChange={e => setForm((p: any) => ({ ...p, monto: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Descripción</label>
                    <input type="text" value={form.descripcion ?? ""} onChange={e => setForm((p: any) => ({ ...p, descripcion: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Estado</label>
                      <select value={form.estado ?? ""} onChange={e => setForm((p: any) => ({ ...p, estado: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                        <option value="PENDIENTE">PENDIENTE</option>
                        <option value="COBRADO">COBRADO</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Semana</label>
                      <input type="number" min="1" value={form.semana ?? ""} onChange={e => setForm((p: any) => ({ ...p, semana: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">📋 Cambio registrado en bitácora.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
