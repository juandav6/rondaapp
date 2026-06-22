// app/admin/usuarios/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day:"2-digit", month:"short", year:"numeric" }).format(d); };
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [socios, setSocios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);
  const [buscar, setBuscar] = useState("");

  // Modal crear/editar
  const [modal, setModal] = useState<"crear"|"editar"|null>(null);
  const [editandoId, setEditandoId] = useState<number|null>(null);
  const [form, setForm] = useState<any>({ email: "", password: "", nombre: "", rol: "SOCIO", socioId: "" });
  const [saving, setSaving] = useState(false);

  const showMsg = (text:string, ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),5000); };

  async function cargar() {
    try {
      const [rU, rS] = await Promise.all([
        fetch("/api/admin/usuarios"),
        fetch("/api/admin/socios"),
      ]);
      const dU = await rU.json();
      setUsuarios(dU.usuarios ?? []);
      setSocios(await rS.json());
    } catch (e:any) { showMsg(e.message, false); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  const filtrados = usuarios.filter(u =>
    `${u.email} ${u.nombre ?? ""} ${u.socio?.nombres ?? ""} ${u.socio?.apellidos ?? ""}`.toLowerCase().includes(buscar.toLowerCase())
  );

  function abrirCrear() {
    setModal("crear");
    setEditandoId(null);
    setForm({ email: "", password: "", nombre: "", rol: "SOCIO", socioId: "" });
  }

  function abrirEditar(u: any) {
    setModal("editar");
    setEditandoId(u.id);
    setForm({ email: u.email, password: "", nombre: u.nombre ?? "", rol: u.rol, socioId: u.socioId ? String(u.socioId) : "" });
  }

  async function guardar() {
    setSaving(true);
    try {
      if (modal === "crear") {
        if (!form.email || !form.password || !form.rol) {
          showMsg("Email, password y rol son obligatorios", false);
          setSaving(false);
          return;
        }
        const res = await fetch("/api/admin/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            nombre: form.nombre || null,
            rol: form.rol,
            socioId: form.socioId ? Number(form.socioId) : null,
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        showMsg("Usuario creado correctamente", true);
      } else if (modal === "editar" && editandoId) {
        const body: any = {
          email: form.email,
          nombre: form.nombre || null,
          rol: form.rol,
          socioId: form.socioId ? Number(form.socioId) : null,
        };
        if (form.password) body.password = form.password;
        const res = await fetch(`/api/admin/usuarios/${editandoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        showMsg("Usuario actualizado correctamente", true);
      }
      setModal(null);
      await cargar();
    } catch (e:any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminar(u: any) {
    if (!confirm(
      `¿ELIMINAR permanentemente al usuario "${u.email}"?\n\n` +
      `Nombre: ${u.nombre ?? "—"}\n` +
      `Rol: ${u.rol}\n` +
      `Socio vinculado: ${u.socio ? `${u.socio.nombres} ${u.socio.apellidos}` : "Ninguno"}\n\n` +
      `Esta accion NO se puede deshacer.`
    )) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Usuario eliminado", true);
      await cargar();
    } catch (e:any) { showMsg(e.message, false); }
  }

  if (loading) return <div className="p-4 space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100"/>)}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Administrar usuarios</h1>
          <p className="text-xs text-gray-400">{usuarios.length} usuarios registrados</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" placeholder="Buscar email o nombre..." value={buscar} onChange={e=>setBuscar(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-violet-200"/>
          <button onClick={abrirCrear}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700">
            + Crear usuario
          </button>
        </div>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      {/* Tabla */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[600px] w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-center">Rol</th>
                <th className="px-4 py-3 text-left">Socio vinculado</th>
                <th className="px-4 py-3 text-left">Creado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Sin usuarios encontrados</td></tr>
              ) : filtrados.map(u => (
                <tr key={u.id} className="border-t hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{u.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.nombre ?? <span className="text-gray-300">--</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      u.rol === "ADMIN" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.socio ? (
                      <span>{u.socio.nombres} {u.socio.apellidos} <span className="text-gray-400">({u.socio.numeroCuenta})</span></span>
                    ) : (
                      <span className="text-gray-300">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1.5 justify-center flex-wrap">
                      <button onClick={() => abrirEditar(u)}
                        className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-700">Editar</button>
                      <button onClick={() => eliminar(u)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl bg-white p-4 sm:p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">{modal === "crear" ? "Crear usuario" : "Editar usuario"}</h3>
            <p className="text-xs text-gray-400 mb-4">
              {modal === "crear" ? "Completa los datos del nuevo usuario" : `Editando usuario #${editandoId}`}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={e=>setForm((p:any)=>({...p,email:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="usuario@ejemplo.com"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {modal === "crear" ? "Password" : "Password (dejar vacio para no cambiar)"}
                </label>
                <input type="password" value={form.password} onChange={e=>setForm((p:any)=>({...p,password:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder={modal === "editar" ? "Sin cambios" : ""}/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nombre</label>
                <input type="text" value={form.nombre} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="Nombre completo (opcional)"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Rol</label>
                <select value={form.rol} onChange={e=>setForm((p:any)=>({...p,rol:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                  <option value="SOCIO">SOCIO</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Vincular a socio (opcional)</label>
                <select value={form.socioId} onChange={e=>setForm((p:any)=>({...p,socioId:e.target.value}))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200">
                  <option value="">-- Sin vincular --</option>
                  {socios.map((s:any) => (
                    <option key={s.id} value={s.id}>{s.nombres} {s.apellidos} ({s.numeroCuenta})</option>
                  ))}
                </select>
              </div>
            </div>
            {form.rol === "ADMIN" && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-3 text-xs text-amber-700">
                Los usuarios con rol ADMIN tienen acceso completo al panel de administracion.
              </div>
            )}
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button onClick={() => setModal(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving}
                className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm text-white disabled:opacity-50 hover:bg-violet-700">
                {saving ? "Guardando..." : modal === "crear" ? "Crear usuario" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
