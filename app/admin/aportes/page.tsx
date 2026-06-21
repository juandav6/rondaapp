// app/admin/aportes/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminAportesPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [semana, setSemana] = useState<number|"">("");
  const [tab, setTab] = useState<"aportes"|"ahorros">("ahorros");
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [editando, setEditando] = useState<any|null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);
  const [busqueda, setBusqueda] = useState("");

  const showMsg = (text:string, ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),4000); };

  useEffect(() => {
    fetch("/api/rondas/historial")
      .then(r => r.json())
      .then(d => setRondas(Array.isArray(d) ? d : (d.rondas ?? [])));
  }, []);

  async function buscar() {
    if (!rondaId) { showMsg("Selecciona una ronda", false); return; }
    setLoading(true); setError(null); setRegistros([]);
    try {
      const params = new URLSearchParams({ tipo: tab });
      if (semana) params.set("semana", String(semana));
      const res = await fetch(`/api/admin/rondas/${rondaId}/registros?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const d = await res.json();
      setRegistros(Array.isArray(d) ? d : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Re-buscar cuando cambia el tab
  useEffect(() => { if (rondaId) buscar(); }, [tab]);

  async function guardar() {
    if (!editando) return;
    const esAhorro = tab === "ahorros";
    const tipo = esAhorro ? "ahorro" : "aporte";
    const advertencia = esAhorro ? "\n\n💡 El saldo de ahorros del socio se recalculará automáticamente." : "";
    if (!confirm(`¿Confirmar cambio en ${tipo} de ${editando.nombres} ${editando.apellidos} (Sem. ${editando.semana})?${advertencia}\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: editando.id, datos: form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const efectoMsg = d.efectos?.length ? ` ${d.efectos[0].descripcion}` : "";
      showMsg(`${esAhorro ? "Ahorro" : "Aporte"} actualizado.${efectoMsg}`, true);
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminar(item: any) {
    const tipo = tab === "ahorros" ? "ahorro" : "aporte";
    const advertencia = tab === "ahorros" ? "\n\n💡 El saldo de ahorros del socio se decrementará automáticamente." : "";
    if (!confirm(`¿Eliminar este ${tipo} de ${item.nombres} ${item.apellidos} (Sem. ${item.semana}, ${fmt(item.monto)})?${advertencia}\n\nQuedará en bitácora.`)) return;
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: item.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(`${tab === "ahorros" ? "Ahorro" : "Aporte"} eliminado correctamente`, true);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  const rondaSeleccionada = rondas.find(r => r.id === rondaId);
  const totalSemanas = rondaSeleccionada?.semanaActual ?? 20;
  const filtrados = registros.filter(r =>
    `${r.nombres} ${r.apellidos} ${r.numeroCuenta}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Administrar aportes y ahorros</h1>
        <p className="text-xs text-gray-400">Editar o eliminar cualquier registro · cambios en ahorros recalculan saldo del socio</p>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {(["ahorros","aportes"] as const).map(t=>(
          <button key={t} onClick={()=>{setTab(t);setRegistros([]);setBusqueda("");}}
            className={cn("flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize",
              tab===t?"bg-white shadow text-gray-900":"text-gray-500 hover:text-gray-700")}>
            {t==="ahorros"?"💰 Ahorros":"💵 Aportes"}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda *</label>
            <select value={rondaId??""} onChange={e=>{setRondaId(e.target.value?Number(e.target.value):null);setRegistros([]);setSemana("");}}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">— Seleccionar ronda —</option>
              {rondas.map((r:any)=><option key={r.id} value={r.id}>{r.nombre}{r.activa?" ✓":""}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-36">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Semana (opcional)</label>
            <select value={semana} onChange={e=>setSemana(e.target.value?Number(e.target.value):"")}
              disabled={!rondaId}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100">
              <option value="">Todas</option>
              {Array.from({length: totalSemanas},(_,i)=>i+1).map(s=><option key={s} value={s}>Semana {s}</option>)}
            </select>
          </div>
          <button onClick={buscar} disabled={!rondaId || loading}
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40">
            {loading?"Buscando…":"Buscar"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Resultados */}
      {registros.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {registros.length} {tab === "ahorros" ? "ahorros" : "aportes"} {semana ? `· Semana ${semana}` : "· Todas las semanas"}
              </p>
              <p className="text-xs text-gray-400">
                Total: {fmt(registros.reduce((s,r)=>s+r.monto,0))}
                {tab==="aportes" && registros.some(r=>r.multa>0) && ` · Multas: ${fmt(registros.reduce((s,r)=>s+(r.multa??0),0))}`}
              </p>
            </div>
            <input type="text" placeholder="Buscar socio…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 w-full sm:w-48"/>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[600px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-center">Semana</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  {tab==="aportes" && <th className="px-4 py-3 text-right">Multa</th>}
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item:any) => (
                  <tr key={`${item.id}`} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.nombres} {item.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">{item.semana}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(item.monto)}</td>
                    {tab==="aportes" && (
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.multa>0 ? <span className="text-amber-700 font-semibold">{fmt(item.multa)}</span> : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={()=>{
                          setEditando(item);
                          setForm(tab==="aportes" ? {monto: item.monto, multa: item.multa} : {monto: item.monto});
                        }} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">
                          <span className="sm:hidden">✎</span><span className="hidden sm:inline">Editar</span>
                        </button>
                        <button onClick={()=>eliminar(item)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">
                          <span className="sm:hidden">✕</span><span className="hidden sm:inline">Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtrados.length === 0 && busqueda && (
            <div className="p-6 text-center text-sm text-gray-400">Sin resultados para "{busqueda}"</div>
          )}
        </div>
      )}

      {!loading && registros.length === 0 && rondaId && (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          Sin {tab} registrados{semana ? ` en la semana ${semana}` : ""} para esta ronda
        </div>
      )}

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">
              Editar {tab==="ahorros"?"ahorro":"aporte"} · Semana {editando.semana}
            </h3>
            <p className="text-xs text-gray-400 mb-4">{editando.nombres} {editando.apellidos} · {editando.numeroCuenta}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {tab==="ahorros"?"Monto ahorro ($)":"Monto aporte ($)"}
                </label>
                <input type="number" step="0.01" min="0" value={form.monto??""} onChange={e=>setForm((p:any)=>({...p,monto:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
              </div>
              {tab==="aportes" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Multa ($)</label>
                  <input type="number" step="0.01" min="0" value={form.multa??0} onChange={e=>setForm((p:any)=>({...p,multa:e.target.value}))}
                    className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                </div>
              )}
            </div>
            {tab==="ahorros" && Number(form.monto)!==editando.monto && (
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                💡 El saldo de ahorros del socio cambiará en {fmt(Math.abs(Number(form.monto)-editando.monto))} ({Number(form.monto)>editando.monto?"aumento":"reducción"}).
              </div>
            )}
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">📋 Cambio registrado en bitácora con fecha y hora.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={()=>setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving||!form.monto} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving?"Guardando…":"Guardar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
