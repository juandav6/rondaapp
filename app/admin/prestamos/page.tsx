// app/admin/prestamos/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");
const toISO = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

type Modal = "editar" | "cancelar" | "eliminar" | "fecha" | null;

export default function AdminPrestamosPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  // Modal activo
  const [modal, setModal] = useState<Modal>(null);
  const [activo, setActivo] = useState<any|null>(null);

  // Forms
  const [formEditar, setFormEditar] = useState<any>({});
  const [notaCancelacion, setNotaCancelacion] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean;efectos?:any[]}|null>(null);
  const [verCuotas, setVerCuotas] = useState<number|null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");

  const showMsg = (text:string, ok:boolean, efectos?:any[]) => { setMsg({text,ok,efectos}); setTimeout(()=>setMsg(null),5000); };
  const cerrarModal = () => { setModal(null); setActivo(null); setSaving(false); };

  useEffect(() => {
    fetch("/api/rondas/historial").then(r=>r.json()).then(d=>setRondas(Array.isArray(d)?d:(d.rondas??[])));
  }, []);

  async function buscar() {
    if (!rondaId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/rondas/${rondaId}/prestamos`, { cache:"no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const d = await res.json();
      setPrestamos(Array.isArray(d)?d:(d.prestamos??[]));
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // ── Editar monto/tasa/plazo ────────────────────────────────────────────────
  async function guardarEdicion() {
    if (!activo) return;
    const recalcula = Number(formEditar.monto)!==Number(activo.monto) ||
      Number(formEditar.tasaAnual)!==Number(activo.tasaAnual) ||
      Number(formEditar.plazoMeses)!==Number(activo.plazoMeses);
    if (!confirm(`¿Confirmar cambios en préstamo de ${activo.socio?.nombres} ${activo.socio?.apellidos}?${recalcula?"\n\n⚡ Se recalcularán las cuotas pendientes.":""}\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos", {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({tipo:"prestamo", id:activo.id, datos:formEditar}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Préstamo actualizado."+(d.efectos?.length?" Cuotas recalculadas.":""), true, d.efectos);
      cerrarModal(); await buscar();
    } catch(e:any) { showMsg(e.message,false); }
    finally { setSaving(false); }
  }

  // ── Cambiar fecha ──────────────────────────────────────────────────────────
  async function guardarFecha() {
    if (!activo||!nuevaFecha) return;
    if (!confirm(`¿Cambiar fecha de inicio del préstamo de ${activo.socio?.nombres} ${activo.socio?.apellidos}?\n\nDe: ${toISO(activo.fechaInicio)}\nA: ${nuevaFecha}\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prestamos/${activo.id}`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({accion:"fecha", fechaInicio:nuevaFecha}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(d.mensaje, true);
      cerrarModal(); await buscar();
    } catch(e:any) { showMsg(e.message,false); }
    finally { setSaving(false); }
  }

  // ── Cancelar préstamo ──────────────────────────────────────────────────────
  async function cancelar() {
    if (!activo) return;
    if (!confirm(`¿Cancelar el préstamo de ${activo.socio?.nombres} ${activo.socio?.apellidos}?\n\nEsto marcará el préstamo como CANCELADO y pondrá el saldo en $0.\nEl registro se mantiene en el historial.\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prestamos/${activo.id}`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({accion:"cancelar", notaCancelacion}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(d.mensaje, true);
      cerrarModal(); await buscar();
    } catch(e:any) { showMsg(e.message,false); }
    finally { setSaving(false); }
  }

  // ── Eliminar completamente ─────────────────────────────────────────────────
  async function eliminar() {
    if (!activo) return;
    if (!confirm(`⚠️ ¿ELIMINAR PERMANENTEMENTE el préstamo de ${activo.socio?.nombres} ${activo.socio?.apellidos}?\n\nEsto borrará el préstamo y TODAS sus cuotas.\nUsar solo si el préstamo fue ingresado con datos incorrectos.\n\nSi el socio ya pagó cuotas, use "Cancelar" en su lugar.\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prestamos/${activo.id}`, { method:"DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Préstamo eliminado permanentemente", true);
      cerrarModal(); await buscar();
    } catch(e:any) { showMsg(e.message,false); }
    finally { setSaving(false); }
  }

  // ── Eliminar última cuota ──────────────────────────────────────────────────
  async function eliminarUltimaCuota(p: any) {
    const pendientes = (p.cuotas??[]).filter((c:any)=>!c.pagada);
    if (pendientes.length===0) { showMsg("No hay cuotas pendientes para eliminar",false); return; }
    const ultima = pendientes[pendientes.length-1];
    if (!confirm(`¿Eliminar la última cuota pendiente (#${ultima.numero} · ${fmt(ultima.cuota)}) de ${p.socio?.nombres} ${p.socio?.apellidos}?\n\nEl saldo del préstamo se recalculará.\nQuedará en bitácora.`)) return;
    try {
      const res = await fetch("/api/admin/movimientos", {
        method:"DELETE", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({tipo:"cuota", id:ultima.id}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(`Cuota #${ultima.numero} eliminada. Saldo recalculado.`, true);
      await buscar();
    } catch(e:any) { showMsg(e.message,false); }
  }

  const ESTADO_CFG: Record<string,{bg:string;text:string}> = {
    ACTIVO:    {bg:"bg-emerald-100", text:"text-emerald-700"},
    CANCELADO: {bg:"bg-gray-100",    text:"text-gray-500"},
    PAGADO:    {bg:"bg-blue-100",    text:"text-blue-700"},
  };

  const filtrados = prestamos
    .filter(p => filtroEstado === "TODOS" || p.estado === filtroEstado)
    .filter(p =>
      `${p.socio?.nombres??""} ${p.socio?.apellidos??""} ${p.socio?.numeroCuenta??""}`.toLowerCase().includes(busqueda.toLowerCase())
    );

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Administrar préstamos</h1>
        <p className="text-xs text-gray-400">Editar, cancelar, eliminar · gestionar cuotas y fechas</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>
          <p>{msg.text}</p>
          {msg.efectos?.map((e:any,i:number)=><p key={i} className="text-xs mt-1 opacity-80">↳ {e.descripcion}</p>)}
        </div>
      )}

      {/* Filtro */}
      <div className="rounded-xl border bg-white p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda</label>
          <select value={rondaId??""} onChange={e=>setRondaId(e.target.value?Number(e.target.value):null)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
            <option value="">— Seleccionar ronda —</option>
            {rondas.map((r:any)=><option key={r.id} value={r.id}>{r.nombre}{r.activa?" ✓":""}</option>)}
          </select>
        </div>
        <button onClick={buscar} disabled={!rondaId||loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-40">
          {loading?"Buscando…":"Buscar"}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && rondaId && prestamos.length===0 && !error && (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">Sin préstamos en esta ronda</div>
      )}

      {prestamos.length>0 && (
        <>
          {/* Filtros buscador + estado */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex gap-1 flex-wrap">
              {["TODOS","ACTIVO","CANCELADO","PAGADO"].map(e => {
                const count = e === "TODOS" ? prestamos.length : prestamos.filter(p=>p.estado===e).length;
                return (
                  <button key={e} onClick={()=>setFiltroEstado(e)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                      filtroEstado===e
                        ? e==="ACTIVO" ? "bg-emerald-600 text-white border-emerald-600"
                          : e==="CANCELADO" ? "bg-orange-500 text-white border-orange-500"
                          : e==="PAGADO" ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-800 text-white border-gray-800"
                        : "text-gray-600 border-gray-200 hover:bg-gray-100")}>
                    {e === "TODOS" ? "Todos" : e.charAt(0) + e.slice(1).toLowerCase()} ({count})
                  </button>
                );
              })}
            </div>
            <input type="text" placeholder="Buscar socio…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 w-full sm:w-44"/>
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-700">{filtrados.length} préstamo{filtrados.length!==1?"s":""}</p>
            </div>
            <div className="divide-y">
              {filtrados.map((p:any) => {
                const cuotasPagadas = p.cuotas?.filter((c:any)=>c.pagada).length??0;
                const cuotasPendientes = p.cuotas?.filter((c:any)=>!c.pagada).length??0;
                const estadoCfg = ESTADO_CFG[p.estado]??{bg:"bg-gray-100",text:"text-gray-500"};
                return (
                  <div key={p.id} className="p-4">
                    {/* Cabecera */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{p.socio?.nombres} {p.socio?.apellidos}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", estadoCfg.bg, estadoCfg.text)}>
                            {p.estado}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{p.socio?.numeroCuenta}</p>
                        {p.notaCancelacion && (
                          <p className="text-xs text-gray-500 mt-1 italic">Nota: {p.notaCancelacion}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-indigo-700">{fmt(p.saldoActual)}</p>
                        <p className="text-xs text-gray-400">saldo · de {fmt(p.monto)}</p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                      <div className="rounded bg-gray-50 px-2 py-1">
                        <span className="text-gray-400">Tasa: </span><span className="font-medium">{Number(p.tasaAnual).toFixed(2)}%</span>
                      </div>
                      <div className="rounded bg-gray-50 px-2 py-1">
                        <span className="text-gray-400">Plazo: </span><span className="font-medium">{p.plazoMeses} meses</span>
                      </div>
                      <div className="rounded bg-gray-50 px-2 py-1">
                        <span className="text-gray-400">Inicio: </span><span className="font-medium">{toISO(p.fechaInicio)}</span>
                      </div>
                      <div className="rounded bg-gray-50 px-2 py-1">
                        <span className="text-gray-400">Cuotas: </span>
                        <span className="font-medium text-emerald-600">{cuotasPagadas}✓</span>
                        <span className="text-gray-400"> / </span>
                        <span className="font-medium text-amber-600">{cuotasPendientes}⏳</span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {/* Editar montos — disponible en todos los estados */}
                      <button onClick={()=>{setActivo(p);setFormEditar({monto:p.monto,tasaAnual:p.tasaAnual,plazoMeses:p.plazoMeses});setModal("editar");}}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700">
                        ✎ Editar montos
                      </button>

                      {/* Cambiar fecha — disponible en todos los estados */}
                      <button onClick={()=>{setActivo(p);setNuevaFecha(toISO(p.fechaInicio));setModal("fecha");}}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
                        📅 Cambiar fecha
                      </button>

                      {/* Eliminar última cuota — solo si hay cuotas pendientes y está ACTIVO */}
                      {p.estado === "ACTIVO" && cuotasPendientes > 0 && (
                        <button onClick={()=>eliminarUltimaCuota(p)}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100">
                          − Última cuota
                        </button>
                      )}

                      {/* Cancelar — solo si está ACTIVO */}
                      {p.estado === "ACTIVO" && (
                        <button onClick={()=>{setActivo(p);setNotaCancelacion("");setModal("cancelar");}}
                          className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-orange-700 hover:bg-orange-100">
                          ✕ Cancelar préstamo
                        </button>
                      )}

                      {/* Eliminar registro — siempre visible, el backend valida si tiene cuotas pagadas */}
                      <button onClick={()=>{setActivo(p);setModal("eliminar");}}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100">
                        🗑 Eliminar registro
                      </button>
                    </div>

                    {/* Cuotas expandibles */}
                    {p.cuotas?.length>0 && (
                      <div className="mt-2">
                        <button onClick={()=>setVerCuotas(verCuotas===p.id?null:p.id)}
                          className="text-xs text-blue-500 hover:underline">
                          {verCuotas===p.id?"▲ Ocultar cuotas":"▼ Ver cuotas"}
                        </button>
                        {verCuotas===p.id && (
                          <div className="mt-2 rounded-xl border overflow-x-auto">
                            <table className="min-w-[640px] text-xs">
                              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
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
                                  <tr key={c.id} className={cn("border-t",c.pagada&&"opacity-50 bg-gray-50")}>
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
                                      {toISO(c.fechaVenc) || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Modal Editar montos ── */}
      {modal==="editar" && activo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Editar préstamo</h3>
            <p className="text-xs text-gray-400 mb-4">{activo.socio?.nombres} {activo.socio?.apellidos}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Monto ($)</label>
                <input type="number" step="0.01" value={formEditar.monto??""} onChange={e=>setFormEditar((p:any)=>({...p,monto:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tasa anual (%)</label>
                  <input type="number" step="0.01" value={formEditar.tasaAnual??""} onChange={e=>setFormEditar((p:any)=>({...p,tasaAnual:e.target.value}))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Plazo (meses)</label>
                  <input type="number" min="1" value={formEditar.plazoMeses??""} onChange={e=>setFormEditar((p:any)=>({...p,plazoMeses:e.target.value}))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
                </div>
              </div>
            </div>
            {(Number(formEditar.monto)!==Number(activo.monto)||Number(formEditar.tasaAnual)!==Number(activo.tasaAnual)||Number(formEditar.plazoMeses)!==Number(activo.plazoMeses)) && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">⚡ Se recalcularán las cuotas no pagadas.</div>
            )}
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">📋 Cambio en bitácora.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={cerrarModal} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardarEdicion} disabled={saving} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving?"Guardando…":"Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cambiar fecha ── */}
      {modal==="fecha" && activo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Cambiar fecha de inicio</h3>
            <p className="text-xs text-gray-400 mb-4">{activo.socio?.nombres} {activo.socio?.apellidos}</p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Fecha de inicio del préstamo</label>
              <div className="relative">
                <input id="fecha-prestamo" type="date" value={nuevaFecha} onChange={e=>setNuevaFecha(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
                <button type="button" tabIndex={-1}
                  onClick={()=>(document.getElementById("fecha-prestamo") as HTMLInputElement)?.showPicker?.()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Fecha actual: {toISO(activo.fechaInicio)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">📋 Cambio en bitácora.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={cerrarModal} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardarFecha} disabled={saving||!nuevaFecha} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving?"Guardando…":"Guardar fecha"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cancelar ── */}
      {modal==="cancelar" && activo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1 text-orange-700">Cancelar préstamo</h3>
            <p className="text-xs text-gray-400 mb-4">{activo.socio?.nombres} {activo.socio?.apellidos} · {fmt(activo.saldoActual)} saldo pendiente</p>
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4 text-xs text-orange-700">
              El préstamo se marcará como <strong>CANCELADO</strong> y el saldo se pondrá en $0. El registro histórico se mantiene. Use esta opción cuando el socio devuelve el dinero y ya no necesita el préstamo.
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Motivo de cancelación (recomendado)</label>
              <textarea value={notaCancelacion} onChange={e=>setNotaCancelacion(e.target.value)}
                placeholder="Ej: El socio devolvió el capital completo el 21/05/2026…"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"/>
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">📋 Cambio en bitácora con la nota.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={cerrarModal} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">No cancelar</button>
              <button onClick={cancelar} disabled={saving} className="flex-1 rounded-lg bg-orange-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving?"Cancelando…":"Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Eliminar ── */}
      {modal==="eliminar" && activo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1 text-red-700">Eliminar registro</h3>
            <p className="text-xs text-gray-400 mb-4">{activo.socio?.nombres} {activo.socio?.apellidos} · {fmt(activo.monto)} · {activo.estado}</p>
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4 text-xs text-red-700">
              <strong>⚠️ Esta acción no se puede deshacer.</strong> Se eliminarán el préstamo y todas sus cuotas del historial.
              {activo.estado === "ACTIVO"
                ? <p className="mt-1">Este préstamo está <strong>ACTIVO</strong> y no tiene cuotas pagadas. Procede con cuidado.</p>
                : <p className="mt-1">El préstamo está <strong>{activo.estado}</strong>. El registro quedará eliminado permanentemente.</p>}
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 text-xs text-gray-500">📋 El evento quedará en bitácora aunque el registro se elimine.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={cerrarModal} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">No eliminar</button>
              <button onClick={eliminar} disabled={saving} className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving?"Eliminando…":"Eliminar permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
