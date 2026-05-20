// app/caja/pendientes/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function CajaPendientesPage() {
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [ronda, setRonda] = useState<any>(null);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [saldoCaja, setSaldoCaja] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [accionando, setAccionando] = useState<number|null>(null);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);
  const showMsg = (text:string,ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),4000); };

  async function cargar(rid?: number) {
    const id = rid ?? rondaId;
    if (!id) return;
    try {
      const [expressRes, cajaRes] = await Promise.all([
        fetch(`/api/prestamos/express?rondaId=${id}`, { cache:"no-store" }),
        fetch(`/api/rondas/${id}/caja`, { cache:"no-store" }),
      ]);
      const express = await expressRes.json();
      const caja = await cajaRes.json();
      setRonda(express.ronda ?? caja.ronda);
      setPendientes(express.prestamos?.filter((p:any)=>p.estado==="PENDIENTE") ?? []);
      setSaldoCaja(caja.resumen?.saldoCaja ?? 0);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
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

  async function cobrar(id: number) {
    if (!confirm("¿Confirmar cobro? El interés se registrará en la caja y se distribuirá entre inversores.")) return;
    setAccionando(id);
    try {
      const res = await fetch(`/api/prestamos/express/${id}`,{
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({accion:"cobrar"}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(d.mensaje ?? "Cobro registrado correctamente", true);
      await cargar();
    } catch(e:any) { showMsg(e.message,false); }
    finally { setAccionando(null); }
  }

  if (loading) return <div className="p-4 space-y-3">{[...Array(3)].map((_,i)=><div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100"/>)}</div>;
  if (error) return <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {msg && (
        <div className={cn("fixed bottom-4 right-4 z-50 rounded-xl px-4 py-3 text-sm shadow-lg ring-1 max-w-sm",
          msg.ok?"bg-emerald-50 text-emerald-800 ring-emerald-200":"bg-red-50 text-red-800 ring-red-200")}>
          {msg.text}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Valores pendientes de cobro</h1>
          <p className="text-xs text-gray-400 mt-0.5">{ronda?.nombre} · Préstamos express pendientes</p>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs shrink-0">
          <span className="text-gray-500">Saldo en caja: </span>
          <span className="font-bold text-emerald-700">{fmt(saldoCaja)}</span>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 mt-0.5 text-blue-500">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
        </svg>
        <span>Al cobrar un préstamo express, el interés generado entra automáticamente a la <strong>caja común</strong> y queda disponible para gastos de la ronda.</span>
      </div>

      {pendientes.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">¡Sin pendientes!</p>
          <p className="text-xs text-gray-400 mt-1">Todos los préstamos express están cobrados.</p>
        </div>
      ) : (
        <>
          {/* Alerta vencidos */}
          {pendientes.some((p:any)=>p.semanasVencidas>0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2 items-start">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 mt-0.5 text-amber-500">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
              </svg>
              Hay préstamos vencidos. El interés aumenta $1 por cada semana de retraso automáticamente al cerrar semana.
            </div>
          )}

          {/* Desktop */}
          <div className="hidden sm:block rounded-xl border bg-white shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-center">Sem. origen</th>
                  <th className="px-4 py-3 text-center">Vence sem.</th>
                  <th className="px-4 py-3 text-center">Retraso</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">Interés</th>
                  <th className="px-4 py-3 text-right">Total a cobrar</th>
                  <th className="px-4 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p:any)=>(
                  <tr key={p.id} className={cn("border-t", p.semanasVencidas>0&&"bg-amber-50/40")}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.socio.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-xs font-bold">{p.semana}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", p.semanasVencidas>0?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700")}>{p.semanaVencimiento}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.semanasVencidas>0
                        ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">+{p.semanasVencidas} sem.</span>
                        : <span className="text-xs text-emerald-600 font-medium">Al día</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(p.principal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-indigo-700">{fmt(p.interesAcumulado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">{fmt(p.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={()=>cobrar(p.id)} disabled={accionando===p.id}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {accionando===p.id?"…":"Cobrar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold">Total pendiente</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(pendientes.reduce((s:number,p:any)=>s+p.principal,0))}</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-700 tabular-nums">{fmt(pendientes.reduce((s:number,p:any)=>s+p.interesAcumulado,0))}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(pendientes.reduce((s:number,p:any)=>s+p.total,0))}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Móvil */}
          <div className="sm:hidden space-y-3">
            {pendientes.map((p:any)=>(
              <div key={p.id} className={cn("rounded-xl border bg-white p-4 shadow-sm", p.semanasVencidas>0&&"border-amber-200")}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</p>
                    <p className="text-xs text-gray-400 font-mono">{p.socio.numeroCuenta}</p>
                  </div>
                  {p.semanasVencidas>0&&<span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">+{p.semanasVencidas} sem.</span>}
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs mb-3">
                  <div className="rounded bg-gray-50 p-2 text-center"><p className="text-gray-400">Origen</p><p className="font-bold text-gray-700">Sem. {p.semana}</p></div>
                  <div className="rounded bg-indigo-50 p-2 text-center"><p className="text-indigo-400">Interés</p><p className="font-bold text-indigo-700">{fmt(p.interesAcumulado)}</p></div>
                  <div className="rounded bg-gray-50 p-2 text-center"><p className="text-gray-400">Principal</p><p className="font-bold">{fmt(p.principal)}</p></div>
                </div>
                <div className="flex items-center justify-between">
                  <div><span className="text-xs text-gray-500">Total: </span><span className="text-sm font-bold text-gray-900">{fmt(p.total)}</span></div>
                  <button onClick={()=>cobrar(p.id)} disabled={accionando===p.id}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {accionando===p.id?"…":"Cobrar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
