// app/admin/socios/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day:"2-digit", month:"short", year:"numeric" }).format(d); };
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

const TIPO_MOV: Record<string,{label:string;color:string;signo:string}> = {
  AHORRO:     { label:"Depósito",    color:"text-emerald-700", signo:"+" },
  RETIRO:     { label:"Retiro",      color:"text-rose-700",    signo:"−" },
  INVERSION:  { label:"Inversión",   color:"text-blue-700",    signo:"−" },
  DEVOLUCION: { label:"Devolución",  color:"text-teal-700",    signo:"+" },
  INTERES:    { label:"Interés",     color:"text-amber-700",   signo:"+" },
};

export default function AdminSociosPage() {
  const [socios, setSocios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [editando, setEditando] = useState<any|null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);

  // Movimientos del socio
  const [verMovs, setVerMovs] = useState<any|null>(null); // socio seleccionado
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);

  const showMsg = (text:string, ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),5000); };

  async function cargar() {
    try {
      const r = await fetch("/api/admin/socios");
      setSocios(await r.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  const filtrados = socios.filter(s =>
    `${s.nombres} ${s.apellidos} ${s.numeroCuenta} ${s.cedula}`.toLowerCase().includes(buscar.toLowerCase())
  );

  function abrirEditar(s: any) {
    setEditando(s);
    setForm({ nombres: s.nombres, apellidos: s.apellidos, cedula: s.cedula, edad: s.edad, numeroCuenta: s.numeroCuenta, saldoAhorros: s.saldoAhorros });
  }

  async function abrirMovimientos(s: any) {
    setVerMovs(s);
    setLoadingMovs(true);
    try {
      const res = await fetch(`/api/admin/movimientos-cuenta?socioId=${s.id}&tipo=TODOS&limit=100`, { cache: "no-store" });
      const d = await res.json();
      setMovimientos(d.movimientos ?? []);
    } catch (e:any) { showMsg(e.message, false); }
    finally { setLoadingMovs(false); }
  }

  async function guardar() {
    if (!editando) return;
    const cambiaAhorros = Number(form.saldoAhorros) !== Number(editando.saldoAhorros);
    const advertencia = cambiaAhorros
      ? `\n\n💰 Saldo de ahorros: ${fmt(editando.saldoAhorros)} → ${fmt(Number(form.saldoAhorros))}`
      : "";
    if (!confirm(`¿Confirmar cambios en ${editando.nombres} ${editando.apellidos}?${advertencia}\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/socios/${editando.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, saldoAhorros: Number(form.saldoAhorros) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Socio actualizado correctamente", true);
      setEditando(null);
      await cargar();
    } catch (e:any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminarSocio(s: any) {
    if (!confirm(`¿ELIMINAR permanentemente a ${s.nombres} ${s.apellidos}?\n\nEsta acción NO se puede deshacer y quedará en bitácora.`)) return;
    try {
      const res = await fetch(`/api/admin/socios/${s.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Socio eliminado", true);
      await cargar();
    } catch (e:any) { showMsg(e.message, false); }
  }

  async function eliminarMovimiento(mov: any) {
    const tipo = TIPO_MOV[mov.tipo]?.label ?? mov.tipo;
    const esSaldoInicial = mov.nota?.toLowerCase().includes("inicial") || mov.nota?.toLowerCase().includes("saldo");
    const advertencia = (["AHORRO","RETIRO"].includes(mov.tipo))
      ? `\n\n💰 El saldo de ahorros del socio se ${mov.tipo === "AHORRO" ? "reducirá" : "aumentará"} en ${fmt(mov.monto)}.`
      : "\n\nEste movimiento es solo lectura — no afecta saldo.";
    if (!confirm(`¿Eliminar este movimiento?\n\nTipo: ${tipo}\nMonto: ${fmt(mov.monto)}\nNota: ${mov.nota ?? "—"}${advertencia}\n\nQuedará en bitácora.`)) return;

    try {
      if (["AHORRO","RETIRO"].includes(mov.tipo)) {
        // Usar el endpoint admin que ajusta saldoAhorros
        const res = await fetch("/api/admin/movimientos-cuenta", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: mov.id }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        showMsg(`Movimiento eliminado. Nuevo saldo: ${fmt(d.nuevoSaldo)}`, true);
      } else {
        // Movimientos de otro tipo (INVERSION, INTERES, etc.) — eliminar directo
        const res = await fetch("/api/admin/movimientos-cuenta", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: mov.id }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        showMsg("Movimiento eliminado", true);
      }
      // Recargar movimientos y socios
      await abrirMovimientos(verMovs);
      await cargar();
    } catch (e:any) { showMsg(e.message, false); }
  }

  if (loading) return <div className="p-4 space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100"/>)}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Administrar socios</h1>
          <p className="text-xs text-gray-400">{socios.length} socios registrados</p>
        </div>
        <input type="text" placeholder="Buscar nombre, cuenta o cédula…" value={buscar} onChange={e=>setBuscar(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-violet-200"/>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      {/* Tabla */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Cuenta</th>
                <th className="px-4 py-3 text-left">Nombre completo</th>
                <th className="px-4 py-3 text-left">Cédula</th>
                <th className="px-4 py-3 text-right">Saldo ahorros</th>
                <th className="px-4 py-3 text-center">Registros</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.numeroCuenta}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.nombres} {s.apellidos}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.cedula}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmt(s.saldoAhorros)}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400">
                    {s._count.aportes}A · {s._count.ahorros}Ah · {s._count.prestamos}P
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1.5 justify-center flex-wrap">
                      <button onClick={()=>abrirEditar(s)}
                        className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-700">Editar</button>
                      <button onClick={()=>abrirMovimientos(s)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100">Movimientos</button>
                      <button onClick={()=>eliminarSocio(s)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Editar socio</h3>
            <p className="text-xs text-gray-400 mb-4">Cuenta: {editando.numeroCuenta}</p>
            <div className="space-y-3">
              {[
                { label:"Nombres",           key:"nombres" },
                { label:"Apellidos",         key:"apellidos" },
                { label:"Cédula",            key:"cedula" },
                { label:"Número de cuenta",  key:"numeroCuenta" },
              ].map(f=>(
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                  <input type="text" value={form[f.key]??""} onChange={e=>setForm((p:any)=>({...p,[f.key]:e.target.value}))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/>
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Edad</label>
                <input type="number" value={form.edad??""} onChange={e=>setForm((p:any)=>({...p,edad:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Saldo de ahorros ($)
                  <span className="ml-1 font-normal text-gray-400">— corregir si fue ingresado incorrectamente</span>
                </label>
                <input type="number" step="0.01" min="0" value={form.saldoAhorros??""} onChange={e=>setForm((p:any)=>({...p,saldoAhorros:e.target.value}))}
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                {Number(form.saldoAhorros)!==Number(editando.saldoAhorros) && (
                  <p className="mt-1 text-xs text-amber-600">
                    Cambio: {fmt(Number(editando.saldoAhorros))} → {fmt(Number(form.saldoAhorros))}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-3 text-xs text-amber-700">
              ⚠️ Si el socio tiene movimientos de "Saldo inicial", usa el botón <strong>Movimientos</strong> para eliminarlos — de lo contrario el saldo podría recalcularse.
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 mt-2 text-xs text-gray-500">📋 Cambios registrados en bitácora.</div>
            <div className="mt-4 flex gap-2">
              <button onClick={()=>setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving?"Guardando…":"Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal movimientos del socio */}
      {verMovs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-base font-semibold">Movimientos de cuenta</h3>
                <p className="text-xs text-gray-400 mt-0.5">{verMovs.nombres} {verMovs.apellidos} · {verMovs.numeroCuenta}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase">Saldo actual</p>
                  <p className="text-sm font-bold text-emerald-700">{fmt(verMovs.saldoAhorros)}</p>
                </div>
                <button onClick={()=>setVerMovs(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto">
              {loadingMovs ? (
                <div className="p-4 space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-10 animate-pulse rounded bg-gray-100"/>)}</div>
              ) : movimientos.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">Sin movimientos de cuenta registrados</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-center">Tipo</th>
                      <th className="px-4 py-3 text-left">Nota</th>
                      <th className="px-4 py-3 text-left">Ronda</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m:any) => {
                      const cfg = TIPO_MOV[m.tipo] ?? {label:m.tipo, color:"text-gray-600", signo:"+"};
                      const canDelete = ["AHORRO","RETIRO"].includes(m.tipo);
                      const esSaldoInicial = m.nota?.toLowerCase().includes("inicial");
                      return (
                        <tr key={m.id} className={cn("border-t hover:bg-gray-50/60", esSaldoInicial && "bg-amber-50/40")}>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-100", cfg.color)}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {m.nota || <span className="text-gray-300">—</span>}
                            {esSaldoInicial && <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold">Saldo inicial</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{m.ronda?.nombre ?? "—"}</td>
                          <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", cfg.color)}>
                            {cfg.signo}{fmt(m.monto)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={()=>eliminarMovimiento(m)}
                              className={cn("rounded-lg border px-2.5 py-1 text-xs",
                                esSaldoInicial
                                  ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold"
                                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              )}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Aviso saldo inicial */}
            {movimientos.some((m:any) => m.nota?.toLowerCase().includes("inicial")) && (
              <div className="border-t bg-amber-50 px-5 py-3 text-xs text-amber-700">
                ⚠️ Este socio tiene un movimiento de <strong>Saldo inicial</strong>. Elimínalo para que el saldo quede en $0.00 limpiamente.
              </div>
            )}
            <div className="border-t px-5 py-3 flex justify-end">
              <button onClick={()=>setVerMovs(null)} className="rounded-lg border px-4 py-2 text-sm text-gray-700">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
