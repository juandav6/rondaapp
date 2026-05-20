// app/caja/historial/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n:number) => new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(n||0));
const fmtDate = (iso:string) => { const d=new Date(iso); return isNaN(d.getTime())?"—":new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short",year:"numeric"}).format(d); };
const cn = (...c:(string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

const TIPO_CFG: Record<string,{label:string;color:string;bg:string;border:string;signo:string}> = {
  MULTA:           {label:"Multa",          color:"text-amber-700",  bg:"bg-amber-50",  border:"border-amber-200",  signo:"+"},
  INTERES_EXPRESS: {label:"Interés express", color:"text-indigo-700", bg:"bg-indigo-50", border:"border-indigo-200", signo:"+"},
  GASTO:           {label:"Gasto",           color:"text-red-700",    bg:"bg-red-50",    border:"border-red-200",    signo:"−"},
};

export default function CajaHistorialPage() {
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [ronda, setRonda] = useState<any>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [porSocio, setPorSocio] = useState<any[]>([]);
  const [cobrados, setCobrados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [tabDetalle, setTabDetalle] = useState<"movimientos"|"porSocio"|"express">("movimientos");

  async function cargar(id?:number) {
    const rid=id??rondaId;
    if (!rid) return;
    try {
      const [cajaRes, expressRes] = await Promise.all([
        fetch(`/api/rondas/${rid}/caja`,{cache:"no-store"}),
        fetch(`/api/prestamos/express?rondaId=${rid}`,{cache:"no-store"}),
      ]);
      const caja = await cajaRes.json();
      const express = await expressRes.json();
      if (!cajaRes.ok) throw new Error(caja.error);
      setRonda(caja.ronda);
      setResumen(caja.resumen);
      setMovimientos(caja.movimientos??[]);
      setPorSocio(caja.porSocio??[]);
      setCobrados(express.prestamos?.filter((p:any)=>p.estado==="COBRADO")??[]);
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

  const filtrados = filtroTipo==="TODOS" ? movimientos : movimientos.filter(m=>m.tipo===filtroTipo);

  if (loading) return <div className="p-4 space-y-3">{[...Array(4)].map((_,i)=><div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100"/>)}</div>;
  if (error) return <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Historial completo</h1>
        <p className="text-xs text-gray-400 mt-0.5">{ronda?.nombre} · Préstamos express, multas y gastos</p>
      </div>

      {/* KPIs */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            {label:"Multas",value:fmt(resumen.totalMultas),color:"text-amber-700",bg:"bg-amber-50",border:"border-amber-100"},
            {label:"Intereses express",value:fmt(resumen.totalIntereses),color:"text-indigo-700",bg:"bg-indigo-50",border:"border-indigo-100"},
            {label:"Total ingresos",value:fmt(resumen.totalIngresos),color:"text-blue-700",bg:"bg-blue-50",border:"border-blue-100"},
            {label:"Gastos",value:fmt(resumen.totalGastos),color:"text-red-700",bg:"bg-red-50",border:"border-red-100"},
            {label:"Saldo en caja",value:fmt(resumen.saldoCaja),color:resumen.saldoCaja>0?"text-emerald-700":"text-gray-400",bg:resumen.saldoCaja>0?"bg-emerald-50":"bg-gray-50",border:resumen.saldoCaja>0?"border-emerald-200":"border-gray-200"},
          ].map(k=>(
            <div key={k.label} className={cn("rounded-xl border p-3",k.bg,k.border)}>
              <p className={cn("text-[10px] font-semibold uppercase tracking-wide",k.color)}>{k.label}</p>
              <p className={cn("text-lg font-bold tabular-nums mt-0.5",k.color)}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {([
          {key:"movimientos",label:`Todos los movimientos (${movimientos.length})`},
          {key:"porSocio",label:`Por socio (${porSocio.length})`},
          {key:"express",label:`Express cobrados (${cobrados.length})`},
        ] as const).map(t=>(
          <button key={t.key} onClick={()=>setTabDetalle(t.key)}
            className={cn("flex-1 rounded-lg py-2 text-xs sm:text-sm font-medium transition-colors",
              tabDetalle===t.key?"bg-white shadow text-gray-900":"text-gray-500 hover:text-gray-700")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Movimientos */}
      {tabDetalle==="movimientos" && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 mr-1">Filtrar:</span>
            {["TODOS","MULTA","INTERES_EXPRESS","GASTO"].map(t=>(
              <button key={t} onClick={()=>setFiltroTipo(t)}
                className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                  filtroTipo===t?"bg-gray-800 text-white border-gray-800":"text-gray-600 border-gray-200 hover:bg-gray-100")}>
                {t==="TODOS"?"Todos":TIPO_CFG[t]?.label??t}
              </button>
            ))}
          </div>
          {filtrados.length===0?(
            <div className="p-10 text-center text-sm text-gray-400">Sin movimientos</div>
          ):(
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Socio / Descripción</th>
                    <th className="px-4 py-3 text-center">Sem.</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((m:any)=>{
                    const cfg = TIPO_CFG[m.tipo]??TIPO_CFG.GASTO;
                    return (
                      <tr key={m.id} className="border-t hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border",cfg.bg,cfg.color,cfg.border)}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {m.socio?(<div><p className="font-medium text-gray-900">{m.socio.nombres} {m.socio.apellidos}</p>{m.descripcion&&<p className="text-xs text-gray-400">{m.descripcion}</p>}</div>)
                            :<p className="text-gray-700">{m.descripcion}</p>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.semana?<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">{m.semana}</span>:<span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          <span className={m.tipo==="GASTO"?"text-red-600":"text-emerald-600"}>{cfg.signo}{fmt(m.monto)}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDate(m.fecha)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Por socio */}
      {tabDetalle==="porSocio" && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {porSocio.length===0?(
            <div className="p-10 text-center text-sm text-gray-400">Sin ingresos por socio</div>
          ):(
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-right">Multas</th>
                    <th className="px-4 py-3 text-right">Interés express</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Semanas</th>
                  </tr>
                </thead>
                <tbody>
                  {porSocio.map((ps:any,i:number)=>(
                    <tr key={i} className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ps.socio.nombres} {ps.socio.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{ps.socio.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ps.totalMultas>0?<span className="font-semibold text-amber-700">{fmt(ps.totalMultas)}</span>:<span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {ps.totalIntereses>0?<span className="font-semibold text-indigo-700">{fmt(ps.totalIntereses)}</span>:<span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">{fmt(ps.totalMultas+ps.totalIntereses)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {ps.multas.map((m:any,j:number)=>(
                            <span key={`m${j}`} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Sem.{m.semana} {fmt(m.monto)}</span>
                          ))}
                          {ps.intereses.map((m:any,j:number)=>(
                            <span key={`i${j}`} className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">Express {fmt(m.monto)}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-sm">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700 tabular-nums">{fmt(resumen?.totalMultas??0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700 tabular-nums">{fmt(resumen?.totalIntereses??0)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(resumen?.totalIngresos??0)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Express cobrados */}
      {tabDetalle==="express" && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">Préstamos express cobrados</p>
            <p className="text-xs text-gray-400 mt-0.5">Interés total generado: <strong className="text-indigo-700">{fmt(cobrados.reduce((s:number,p:any)=>s+p.interesAcumulado,0))}</strong></p>
          </div>
          {cobrados.length===0?(
            <div className="p-10 text-center text-sm text-gray-400">Sin express cobrados aún</div>
          ):(
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-center">Sem. origen</th>
                    <th className="px-4 py-3 text-center">Sem. cobro</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Interés</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cobrados.map((p:any)=>(
                    <tr key={p.id} className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.socio.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">{p.semana}</span></td>
                      <td className="px-4 py-3 text-center"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{p.semanaCobro}</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(p.principal)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-indigo-700">{fmt(p.interesAcumulado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-semibold text-sm">Total</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(cobrados.reduce((s:number,p:any)=>s+p.principal,0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700 tabular-nums">{fmt(cobrados.reduce((s:number,p:any)=>s+p.interesAcumulado,0))}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(cobrados.reduce((s:number,p:any)=>s+p.total,0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
