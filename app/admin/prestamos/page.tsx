// app/admin/prestamos/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminPrestamosPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [editando, setEditando] = useState<any|null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean;efectos?:any[]}|null>(null);
  const [verCuotas, setVerCuotas] = useState<number|null>(null);

  const showMsg = (text:string, ok:boolean, efectos?:any[]) => { setMsg({text,ok,efectos}); setTimeout(()=>setMsg(null),5000); };

  useEffect(() => {
    fetch("/api/rondas/historial")
      .then(r => r.json())
      .then(d => setRondas(Array.isArray(d) ? d : (d.rondas ?? [])));
  }, []);

  async function buscar() {
    if (!rondaId) return;
    setLoading(true); setError(null);
    try {
      // Ruta real: /api/rondas/[id]/prestamos-activos
      const res = await fetch(`/api/rondas/${rondaId}/prestamos-activos`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const d = await res.json();
      // Puede venir como array directo o como { prestamos: [] }
      setPrestamos(Array.isArray(d) ? d : (d.prestamos ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function guardar() {
    if (!editando) return;
    const recalcula = Number(form.monto) !== Number(editando.monto) ||
      Number(form.tasaAnual) !== Number(editando.tasaAnual) ||
      Number(form.plazoMeses) !== Number(editando.plazoMeses);
    if (!confirm(`¿Confirmar cambios en préstamo de ${editando.socio?.nombres} ${editando.socio?.apellidos}?${recalcula ? "\n\n⚡ Se recalcularán las cuotas pendientes." : ""}\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "prestamo", id: editando.id, datos: form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Préstamo actualizado." + (d.efectos?.length ? " Cuotas recalculadas." : ""), true, d.efectos);
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Administrar préstamos</h1>
        <p className="text-xs text-gray-400">Editar monto, tasa y plazo · recalcula cuotas automáticamente</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
          <p>{msg.text}</p>
          {msg.efectos?.map((e:any,i:number) => <p key={i} className="text-xs mt-1 opacity-80">↳ {e.descripcion}</p>)}
        </div>
      )}

      {/* Filtro */}
      <div className="rounded-xl border bg-white p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda</label>
          <select value={rondaId ?? ""} onChange={e => setRondaId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
            <option value="">— Seleccionar ronda —</option>
            {rondas.map((r:any) => <option key={r.id} value={r.id}>{r.nombre}{r.activa?" ✓":""}</option>)}
          </select>
        </div>
        <button onClick={buscar} disabled={!rondaId || loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-40">
          {loading ? "Buscando…" : "Buscar préstamos"}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && rondaId && prestamos.length === 0 && !error && (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          Sin préstamos activos en esta ronda
        </div>
      )}

      {prestamos.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-700">{prestamos.length} préstamo{prestamos.length!==1?"s":""} encontrado{prestamos.length!==1?"s":""}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Tasa</th>
                  <th className="px-4 py-3 text-center">Plazo</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Cuotas</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prestamos.map((p:any) => (
                  <>
                    <tr key={p.id} className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.socio?.nombres} {p.socio?.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.socio?.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(p.monto)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{Number(p.tasaAnual).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-center">{p.plazoMeses} m.</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-indigo-700">{fmt(p.saldoActual)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                          p.estado==="ACTIVO"?"bg-emerald-100 text-emerald-700":"bg-gray-100 text-gray-500")}>
                          {p.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {p.cuotas?.filter((c:any)=>c.pagada).length??0}/{p.cuotas?.length??p.plazoMeses}
                        {p.cuotas?.length>0 && (
                          <button onClick={()=>setVerCuotas(verCuotas===p.id?null:p.id)}
                            className="ml-1 text-blue-500 hover:underline">{verCuotas===p.id?"▲":"▼"}</button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={()=>{setEditando(p);setForm({monto:p.monto,tasaAnual:p.tasaAnual,plazoMeses:p.plazoMeses});}}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs text-white hover:bg-indigo-700">Editar</button>
                      </td>
                    </tr>
                    {verCuotas===p.id && p.cuotas && (
                      <tr key={`c-${p.id}`}>
                        <td colSpan={8} className="px-4 pb-3">
                          <div className="rounded-xl border bg-gray-50 overflow-hidden">
                            <table className="min-w-full text-xs">
                              <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase">
                                <tr>
                                  <th className="px-3 py-2 text-center">#</th>
                                  <th className="px-3 py-2 text-right">Cuota</th>
                                  <th className="px-3 py-2 text-right">Capital</th>
                                  <th className="px-3 py-2 text-right">Interés</th>
                                  <th className="px-3 py-2 text-right">Saldo</th>
                                  <th className="px-3 py-2 text-center">Estado</th>
                                  <th className="px-3 py-2 text-right">Vence</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.cuotas.map((c:any)=>(
                                  <tr key={c.id} className={cn("border-t",c.pagada&&"opacity-50")}>
                                    <td className="px-3 py-1.5 text-center font-bold">{c.numero}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(c.cuota)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(c.capital)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-amber-600">{fmt(c.interes)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(c.saldo)}</td>
                                    <td className="px-3 py-1.5 text-center">
                                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                        c.pagada?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700")}>
                                        {c.pagada?"Pagada":"Pendiente"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-gray-400">
                                      {new Date(c.fechaVenc).toLocaleDateString("es-EC")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
            <h3 className="text-base font-semibold mb-1">Editar préstamo</h3>
            <p className="text-xs text-gray-400 mb-4">{editando.socio?.nombres} {editando.socio?.apellidos}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Monto ($)</label>
                <input type="number" step="0.01" value={form.monto??""} onChange={e=>setForm((p:any)=>({...p,monto:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tasa anual (%)</label>
                  <input type="number" step="0.01" value={form.tasaAnual??""} onChange={e=>setForm((p:any)=>({...p,tasaAnual:e.target.value}))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Plazo (meses)</label>
                  <input type="number" min="1" value={form.plazoMeses??""} onChange={e=>setForm((p:any)=>({...p,plazoMeses:e.target.value}))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
                </div>
              </div>
            </div>
            {(Number(form.monto)!==Number(editando.monto)||Number(form.tasaAnual)!==Number(editando.tasaAnual)||Number(form.plazoMeses)!==Number(editando.plazoMeses)) && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                ⚡ Se recalcularán las cuotas no pagadas con los nuevos valores.
              </div>
            )}
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">📋 Cambio registrado en bitácora.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={()=>setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving?"Guardando…":"Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
