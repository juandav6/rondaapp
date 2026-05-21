// app/admin/aportes/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminAportesPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [semana, setSemana] = useState<number|"">("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [tab, setTab] = useState<"aportes"|"ahorros">("aportes");
  const [editando, setEditando] = useState<any|null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);

  const showMsg = (text:string, ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),4000); };

  useEffect(() => {
    fetch("/api/rondas/historial")
      .then(r => r.json())
      .then(d => setRondas(Array.isArray(d) ? d : (d.rondas ?? [])));
  }, []);

  async function buscar() {
    if (!rondaId || !semana) { showMsg("Selecciona una ronda y una semana", false); return; }
    setLoading(true); setError(null); setRows([]);
    try {
      // Ruta real: /api/rondas/[id]/semanas/[semana]/detalle
      const res = await fetch(`/api/rondas/${rondaId}/semanas/${semana}/detalle`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const d = await res.json();
      setRows(d.rows ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function guardar() {
    if (!editando || !rondaId) return;
    const tipo = tab === "aportes" ? "aporte" : "ahorro";
    const advertencia = tipo === "ahorro" ? "\n\n💡 Esto recalculará el saldo de ahorros del socio automáticamente." : "";
    if (!confirm(`¿Confirmar cambio en ${tipo} de ${editando.nombres} ${editando.apellidos} (Sem. ${semana})?${advertencia}\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      // Usamos el endpoint de semana/detalle con PUT que ya existe
      const updates = rows.map(r => ({
        socioId: r.socioId,
        aporteSemana: r.socioId === editando.socioId && tab === "aportes" ? Number(form.monto) : r.aporteSemana,
        ahorroSemana: r.socioId === editando.socioId && tab === "ahorros" ? Number(form.monto) : r.ahorroSemana,
        multaSemana: r.multaSemana,
      }));

      const res = await fetch(`/api/rondas/${rondaId}/semanas/${semana}/detalle`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      // También registrar en bitácora via admin API
      await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          id: editando.socioId, // usamos socioId como referencia
          datos: { monto: Number(form.monto) },
        }),
      });

      showMsg(`${tipo === "aportes" ? "Aporte" : "Ahorro"} actualizado correctamente.${tipo === "ahorro" ? " Saldo del socio recalculado." : ""}`, true);
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  const rondaSeleccionada = rondas.find(r => r.id === rondaId);
  const semanasDisponibles = rondaSeleccionada ? Array.from({length: rondaSeleccionada.semanaActual ?? 20}, (_,i) => i + 1) : [];

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Administrar aportes y ahorros</h1>
        <p className="text-xs text-gray-400">Selecciona ronda y semana · cambios en ahorros recalculan saldo del socio</p>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda *</label>
            <select value={rondaId??""} onChange={e=>{setRondaId(e.target.value?Number(e.target.value):null);setSemana(""); setRows([]);}}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">— Seleccionar ronda —</option>
              {rondas.map((r:any)=><option key={r.id} value={r.id}>{r.nombre}{r.activa?" ✓":""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Semana *</label>
            <select value={semana} onChange={e=>setSemana(e.target.value?Number(e.target.value):"")}
              className="w-32 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={!rondaId}>
              <option value="">— Semana —</option>
              {semanasDisponibles.map(s=><option key={s} value={s}>Semana {s}</option>)}
            </select>
          </div>
          <button onClick={buscar} disabled={!rondaId || !semana || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40">
            {loading?"Buscando…":"Buscar"}
          </button>
        </div>
        {!rondaId && <p className="mt-2 text-xs text-gray-400">Selecciona una ronda para ver las semanas disponibles.</p>}
        {rondaId && !semana && <p className="mt-2 text-xs text-gray-400">Selecciona la semana que quieres editar.</p>}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && rows.length === 0 && rondaId && semana && !error && (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          Sin registros para la semana {semana} de esta ronda
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
            {(["aportes","ahorros"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={cn("flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize",
                  tab===t?"bg-white shadow text-gray-900":"text-gray-500 hover:text-gray-700")}>
                {t==="aportes"?"Aportes":"Ahorros"}
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-700">
                {tab==="aportes"?"Aportes":"Ahorros"} · Semana {semana} · {rondaSeleccionada?.nombre}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{rows.length} socios</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-right">{tab==="aportes"?"Aporte ($)":"Ahorro ($)"}</th>
                    {tab==="aportes" && <th className="px-4 py-3 text-right">Multa ($)</th>}
                    <th className="px-4 py-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r:any) => (
                    <tr key={r.socioId} className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.nombres} {r.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{r.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {fmt(tab==="aportes" ? r.aporteSemana : r.ahorroSemana)}
                      </td>
                      {tab==="aportes" && (
                        <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                          {r.multaSemana > 0 ? fmt(r.multaSemana) : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={()=>{
                            setEditando(r);
                            setForm({monto: tab==="aportes" ? r.aporteSemana : r.ahorroSemana});
                          }}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">
              Editar {tab==="aportes"?"aporte":"ahorro"} · Semana {semana}
            </h3>
            <p className="text-xs text-gray-400 mb-4">{editando.nombres} {editando.apellidos} · {editando.numeroCuenta}</p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                {tab==="aportes"?"Monto aporte ($)":"Monto ahorro ($)"}
              </label>
              <input type="number" step="0.01" value={form.monto??""} onChange={e=>setForm((p:any)=>({...p,monto:e.target.value}))}
                className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
            </div>
            {tab==="ahorros" && (
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                💡 El saldo de ahorros del socio se recalculará automáticamente con la diferencia.
              </div>
            )}
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">📋 Cambio registrado en bitácora.</div>
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
