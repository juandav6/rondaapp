// app/caja/multas/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day:"2-digit", month:"short", year:"numeric" }).format(d); };
const todayISO = () => new Date().toISOString().slice(0,10);
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function CajaMulatPage() {
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [ronda, setRonda] = useState<any>(null);
  const [socios, setSocios] = useState<any[]>([]);
  const [multas, setMultas] = useState<any[]>([]);
  const [saldoCaja, setSaldoCaja] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const [socioId, setSocioId] = useState<number|"">("");
  const [semana, setSemana] = useState<number|"">("");
  const [monto, setMonto] = useState("");
  const [obs, setObs] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);
  const showMsg = (text: string, ok: boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),3500); };

  async function cargar(id?: number) {
    const rid = id ?? rondaId;
    if (!rid) return;
    try {
      const res = await fetch(`/api/rondas/${rid}/caja`, { cache:"no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRonda(d.ronda);
      setSocios(d.socios ?? []);
      setMultas(d.movimientos?.filter((m:any)=>m.tipo==="MULTA") ?? []);
      setSaldoCaja(d.resumen?.saldoCaja ?? 0);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    async function init() {
      try {
        const r = await fetch("/api/rondas", { cache:"no-store" });
        if (!r.ok || r.status===204) throw new Error("No hay ronda activa");
        const d = await r.json();
        setRondaId(d.id);
        await cargar(d.id);
      } catch(e:any) { setError(e.message); setLoading(false); }
    }
    init();
  }, []);

  async function registrar() {
    if (!rondaId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rondas/${rondaId}/caja`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ tipo:"MULTA", monto:Number(monto), socioId:Number(socioId), semana:Number(semana), descripcion:obs.trim()||null, fecha }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSocioId(""); setSemana(""); setMonto(""); setObs("");
      showMsg(`Multa de ${fmt(Number(monto))} registrada correctamente`, true);
      await cargar();
    } catch(e:any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminar(id: number) {
    if (!rondaId || !confirm("¿Eliminar esta multa?")) return;
    await fetch(`/api/rondas/${rondaId}/caja/${id}`, { method:"DELETE" });
    await cargar();
  }

  const semanasDisponibles = ronda ? Array.from({length: ronda.semanaActual}, (_,i) => i+1) : [];
  const canSave = !!socioId && !!semana && Number(monto) > 0;

  if (loading) return <div className="p-4 space-y-3">{[...Array(3)].map((_,i)=><div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100"/>)}</div>;
  if (error) return <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Registro de multas</h1>
          <p className="text-xs text-gray-400 mt-0.5">{ronda?.nombre}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs">
          <span className="text-gray-500">Saldo caja: </span>
          <span className="font-bold text-emerald-700">{fmt(saldoCaja)}</span>
        </div>
      </div>

      {/* Formulario */}
      <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Nueva multa</h3>
        {msg && <div className={cn("mb-4 rounded-lg p-3 text-sm", msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Socio *</label>
            <select value={socioId} onChange={e=>setSocioId(e.target.value?Number(e.target.value):"")}
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
              <option value="">— Seleccionar socio —</option>
              {socios.map((s:any)=><option key={s.id} value={s.id}>{s.nombres} {s.apellidos} · {s.numeroCuenta}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Semana *</label>
            <select value={semana} onChange={e=>setSemana(e.target.value?Number(e.target.value):"")}
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
              <option value="">— Seleccionar semana —</option>
              {semanasDisponibles.map(s=><option key={s} value={s}>Semana {s}{s===ronda?.semanaActual?" (actual)":""}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Monto ($) *</label>
            <input type="number" min="0.01" step="0.01" value={monto} onChange={e=>setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Fecha</label>
            <div className="relative">
              <input id="fecha-multa" type="date" value={fecha} max={todayISO()} onChange={e=>setFecha(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/>
              <button type="button" tabIndex={-1}
                onClick={()=>(document.getElementById("fecha-multa") as HTMLInputElement)?.showPicker?.()}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Observaciones</label>
            <input type="text" value={obs} onChange={e=>setObs(e.target.value)}
              placeholder="Motivo de la multa (llegada tarde, ausencia, etc.)"
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"/>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={registrar} disabled={saving||!canSave}
            className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
            {saving?"Registrando…":"Registrar multa"}
          </button>
        </div>
      </div>

      {/* Listado */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Multas registradas</p>
          <span className="text-xs text-gray-400">{multas.length} registro{multas.length!==1?"s":""} · <strong className="text-amber-700">{fmt(multas.reduce((s,m)=>s+m.monto,0))}</strong></span>
        </div>
        {multas.length===0 ? (
          <div className="p-10 text-center text-sm text-gray-400">Sin multas registradas aún</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-center">Semana</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-left">Observaciones</th>
                  <th className="px-4 py-3 text-right">Fecha</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody>
                {multas.map((m:any)=>(
                  <tr key={m.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.socio?.nombres} {m.socio?.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{m.socio?.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{m.semana}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">{fmt(m.monto)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{m.descripcion||<span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDate(m.fecha)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={()=>eliminar(m.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
