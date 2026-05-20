// app/caja/gastos/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n:number) => new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(n||0));
const fmtDate = (iso:string) => { const d=new Date(iso); return isNaN(d.getTime())?"—":new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short",year:"numeric"}).format(d); };
const todayISO = () => new Date().toISOString().slice(0,10);
const cn = (...c:(string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function CajaGastosPage() {
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [ronda, setRonda] = useState<any>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const [desc, setDesc] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);
  const showMsg = (text:string,ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),3500); };

  const [editId, setEditId] = useState<number|null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editMonto, setEditMonto] = useState("");

  async function cargar(id?:number) {
    const rid = id??rondaId;
    if (!rid) return;
    try {
      const res = await fetch(`/api/rondas/${rid}/caja`,{cache:"no-store"});
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setRonda(d.ronda);
      setResumen(d.resumen);
      setGastos(d.movimientos?.filter((m:any)=>m.tipo==="GASTO")??[]);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(()=>{
    async function init() {
      try {
        const r = await fetch("/api/rondas",{cache:"no-store"});
        if (!r.ok||r.status===204) throw new Error("No hay ronda activa");
        const d = await r.json();
        setRondaId(d.id);
        await cargar(d.id);
      } catch(e:any) { setError(e.message); setLoading(false); }
    }
    init();
  },[]);

  async function registrar() {
    if (!rondaId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rondas/${rondaId}/caja`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({tipo:"GASTO",monto:Number(monto),descripcion:desc.trim(),fecha}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDesc(""); setMonto("");
      showMsg(`Gasto de ${fmt(Number(monto))} registrado.`,true);
      await cargar();
    } catch(e:any) { showMsg(e.message,false); }
    finally { setSaving(false); }
  }

  async function eliminar(id:number) {
    if (!rondaId||!confirm("¿Eliminar este gasto?")) return;
    await fetch(`/api/rondas/${rondaId}/caja/${id}`,{method:"DELETE"});
    await cargar();
  }

  async function guardarEdit(id:number) {
    if (!rondaId) return;
    try {
      const res = await fetch(`/api/rondas/${rondaId}/caja/${id}`,{
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({monto:Number(editMonto),descripcion:editDesc}),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditId(null);
      await cargar();
    } catch(e:any) { showMsg(e.message,false); }
  }

  if (loading) return <div className="p-4 space-y-3">{[...Array(3)].map((_,i)=><div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100"/>)}</div>;
  if (error) return <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Registro de gastos</h1>
          <p className="text-xs text-gray-400 mt-0.5">{ronda?.nombre}</p>
        </div>
        {resumen && (
          <div className="flex gap-2 text-xs shrink-0">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5">
              <span className="text-gray-500">Saldo: </span>
              <span className={cn("font-bold",resumen.saldoCaja>0?"text-emerald-700":"text-red-600")}>{fmt(resumen.saldoCaja)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Nuevo gasto</h3>
        {msg&&<div className={cn("mb-4 rounded-lg p-3 text-sm",msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

        {resumen&&(
          <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
            {[
              {label:"Total ingresos",value:fmt(resumen.totalIngresos),color:"text-blue-700",bg:"bg-blue-50",border:"border-blue-100"},
              {label:"Total gastos",value:fmt(resumen.totalGastos),color:"text-red-700",bg:"bg-red-50",border:"border-red-100"},
              {label:"Disponible",value:fmt(resumen.saldoCaja),color:resumen.saldoCaja>0?"text-emerald-700":"text-gray-400",bg:resumen.saldoCaja>0?"bg-emerald-50":"bg-gray-50",border:resumen.saldoCaja>0?"border-emerald-200":"border-gray-200"},
            ].map(k=>(
              <div key={k.label} className={cn("rounded-lg border p-2.5",k.bg,k.border)}>
                <p className={cn("text-[10px] font-semibold uppercase",k.color)}>{k.label}</p>
                <p className={cn("text-sm font-bold tabular-nums mt-0.5",k.color)}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Descripción *</label>
            <input type="text" value={desc} onChange={e=>setDesc(e.target.value)}
              placeholder="Ej: Café reunión semana 5, útiles de oficina…"
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Monto ($) *</label>
            <input type="number" min="0.01" step="0.01" value={monto} onChange={e=>setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Fecha</label>
            <div className="relative">
              <input id="fecha-gasto" type="date" value={fecha} max={todayISO()} onChange={e=>setFecha(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
              <button type="button" tabIndex={-1}
                onClick={()=>(document.getElementById("fecha-gasto") as HTMLInputElement)?.showPicker?.()}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={registrar} disabled={saving||!desc.trim()||!monto||Number(monto)<=0}
            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
            {saving?"Registrando…":"Registrar gasto"}
          </button>
        </div>
      </div>

      {/* Listado */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Gastos registrados</p>
          <span className="text-xs text-gray-400">Total: <strong className="text-red-600">{fmt(resumen?.totalGastos??0)}</strong></span>
        </div>
        {gastos.length===0?(
          <div className="p-10 text-center text-sm text-gray-400">Sin gastos registrados</div>
        ):(
          <ul className="divide-y">
            {gastos.map((g:any)=>(
              <li key={g.id} className="p-4">
                {editId===g.id?(
                  <div className="space-y-2">
                    <input type="text" value={editDesc} onChange={e=>setEditDesc(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
                    <div className="flex gap-2">
                      <input type="number" step="0.01" value={editMonto} onChange={e=>setEditMonto(e.target.value)}
                        className="w-32 rounded-lg border px-3 py-2 text-sm text-right"/>
                      <button onClick={()=>guardarEdit(g.id)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Guardar</button>
                      <button onClick={()=>setEditId(null)} className="rounded-lg border px-3 py-2 text-xs text-gray-600">Cancelar</button>
                    </div>
                  </div>
                ):(
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">−</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{g.descripcion}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(g.fecha)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-red-700 tabular-nums">{fmt(g.monto)}</span>
                      <button onClick={()=>{setEditId(g.id);setEditDesc(g.descripcion??"");setEditMonto(String(g.monto));}}
                        className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50">Editar</button>
                      <button onClick={()=>eliminar(g.id)}
                        className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50">Eliminar</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
