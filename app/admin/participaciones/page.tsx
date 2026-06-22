// app/admin/participaciones/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminParticipacionesPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [participaciones, setParticipaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPart, setLoadingPart] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);

  // Modal agregar
  const [modalAgregar, setModalAgregar] = useState(false);
  const [socios, setSocios] = useState<any[]>([]);
  const [buscarSocio, setBuscarSocio] = useState("");
  const [socioSel, setSocioSel] = useState<any|null>(null);
  const [nuevoOrden, setNuevoOrden] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal editar orden
  const [editandoId, setEditandoId] = useState<number|null>(null);
  const [editOrden, setEditOrden] = useState("");

  const showMsg = (text:string, ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),5000); };

  async function cargarRondas() {
    try {
      const r = await fetch("/api/rondas/historial");
      const data = await r.json();
      setRondas(data);
      if (data.length > 0 && !rondaId) setRondaId(data[0].id);
    } finally { setLoading(false); }
  }

  async function cargarParticipaciones() {
    if (!rondaId) return;
    setLoadingPart(true);
    try {
      const r = await fetch(`/api/admin/participaciones?rondaId=${rondaId}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setParticipaciones(d.participaciones ?? []);
    } catch (e:any) { showMsg(e.message, false); }
    finally { setLoadingPart(false); }
  }

  async function cargarSocios() {
    try {
      const r = await fetch("/api/admin/socios");
      setSocios(await r.json());
    } catch {}
  }

  useEffect(() => { cargarRondas(); }, []);
  useEffect(() => { if (rondaId) cargarParticipaciones(); }, [rondaId]);

  function abrirModalAgregar() {
    setModalAgregar(true);
    setBuscarSocio("");
    setSocioSel(null);
    setNuevoOrden(String((participaciones.length || 0) + 1));
    cargarSocios();
  }

  const sociosFiltrados = socios.filter(s => {
    const yaParticipa = participaciones.some(p => p.socioId === s.id);
    if (yaParticipa) return false;
    if (!buscarSocio) return true;
    return `${s.nombres} ${s.apellidos} ${s.numeroCuenta} ${s.cedula}`.toLowerCase().includes(buscarSocio.toLowerCase());
  });

  async function agregarParticipante() {
    if (!socioSel || !rondaId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/participaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rondaId, socioId: socioSel.id, orden: Number(nuevoOrden) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(`Socio ${socioSel.nombres} ${socioSel.apellidos} agregado`, true);
      setModalAgregar(false);
      await cargarParticipaciones();
    } catch (e:any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function guardarOrden(partId: number) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/participaciones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: partId, orden: Number(editOrden) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Orden actualizado", true);
      setEditandoId(null);
      await cargarParticipaciones();
    } catch (e:any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminar(p: any) {
    if (!confirm(
      `¿Eliminar a ${p.socio.nombres} ${p.socio.apellidos} de esta ronda?\n\n` +
      `Orden actual: ${p.orden}\nCuenta: ${p.socio.numeroCuenta}\n\n` +
      `Si el socio tiene aportes, ahorros o préstamos en esta ronda, no se podrá eliminar.`
    )) return;
    try {
      const res = await fetch("/api/admin/participaciones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Participación eliminada", true);
      await cargarParticipaciones();
    } catch (e:any) { showMsg(e.message, false); }
  }

  if (loading) return <div className="p-4 space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100"/>)}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Participaciones por ronda</h1>
          <p className="text-xs text-gray-400">{participaciones.length} participantes en la ronda seleccionada</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={rondaId ?? ""}
            onChange={e => setRondaId(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            <option value="" disabled>Seleccionar ronda...</option>
            {rondas.map(r => (
              <option key={r.id} value={r.id}>
                {r.nombre} {r.activa ? "(Activa)" : ""}
              </option>
            ))}
          </select>
          {rondaId && (
            <button onClick={abrirModalAgregar}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700">
              + Agregar participante
            </button>
          )}
        </div>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      {!rondaId ? (
        <div className="rounded-xl border bg-white shadow-sm p-8 text-center text-sm text-gray-400">Selecciona una ronda para ver sus participantes</div>
      ) : loadingPart ? (
        <div className="p-4 space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100"/>)}</div>
      ) : participaciones.length === 0 ? (
        <div className="rounded-xl border bg-white shadow-sm p-8 text-center text-sm text-gray-400">No hay participantes en esta ronda</div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[600px] w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-center">Orden</th>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-left">Cuenta</th>
                  <th className="px-4 py-3 text-center">Activo</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {participaciones.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-center">
                      {editandoId === p.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <input type="number" min="1" value={editOrden}
                            onChange={e => setEditOrden(e.target.value)}
                            className="w-16 rounded-lg border px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-200"/>
                          <button onClick={() => guardarOrden(p.id)} disabled={saving}
                            className="rounded-lg bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">OK</button>
                          <button onClick={() => setEditandoId(null)}
                            className="rounded-lg border px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">X</button>
                        </div>
                      ) : (
                        <span className="font-mono font-semibold text-gray-900">{p.orden}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.socio.numeroCuenta}</td>
                    <td className="px-4 py-3 text-center">
                      {p.activo ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">ACTIVO</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">INACTIVO</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        <button onClick={() => { setEditandoId(p.id); setEditOrden(String(p.orden)); }}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">Editar orden</button>
                        <button onClick={() => eliminar(p)}
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

      {/* Modal agregar participante */}
      {modalAgregar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl bg-white p-4 sm:p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Agregar participante</h3>
            <p className="text-xs text-gray-400 mb-4">Selecciona un socio y asigna su orden en la ronda</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Buscar socio</label>
                <input type="text" placeholder="Nombre, cuenta o cedula..." value={buscarSocio}
                  onChange={e => setBuscarSocio(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                {sociosFiltrados.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">Sin resultados</div>
                ) : sociosFiltrados.map(s => (
                  <button key={s.id} onClick={() => setSocioSel(s)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-violet-50 transition-colors",
                      socioSel?.id === s.id && "bg-violet-100 font-semibold"
                    )}>
                    <span className="text-gray-900">{s.nombres} {s.apellidos}</span>
                    <span className="ml-2 text-xs text-gray-400">{s.numeroCuenta}</span>
                  </button>
                ))}
              </div>
              {socioSel && (
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-xs text-violet-700">
                  Seleccionado: <strong>{socioSel.nombres} {socioSel.apellidos}</strong> ({socioSel.numeroCuenta})
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Orden</label>
                <input type="number" min="1" value={nuevoOrden} onChange={e => setNuevoOrden(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button onClick={() => setModalAgregar(false)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={agregarParticipante} disabled={saving || !socioSel}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm text-white disabled:opacity-50 hover:bg-emerald-700">
                {saving ? "Agregando..." : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
