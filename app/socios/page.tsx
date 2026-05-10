// app/socios/page.tsx
"use client";
import { useEffect, useState } from "react";

interface SocioRow {
  id: number; numeroCuenta: string; nombres: string;
  apellidos: string; cedula: string; edad: number;
  ahorros: number; multas: number;
}
interface CreateSocioPayload {
  cedula: string; nombres: string; apellidos: string;
  edad: number; multas?: number; ahorroInicial?: number;
}
interface EditSocioPayload {
  cedula?: string; nombres?: string; apellidos?: string;
  edad?: number; multas?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export default function SociosPage() {
  const [socios, setSocios] = useState<SocioRow[]>([]);
  const [form, setForm] = useState<Partial<CreateSocioPayload>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"lista" | "formulario">("lista");
  const [editing, setEditing] = useState<SocioRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<EditSocioPayload>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { fetchSocios(); }, []);

  const fetchSocios = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/socios");
      if (!r.ok) throw new Error("Error al obtener socios");
      setSocios(await r.json());
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/socios", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cedula: form.cedula!.trim(), nombres: form.nombres!.trim(),
          apellidos: form.apellidos!.trim(), edad: Number(form.edad) || 0,
          ...(form.multas != null ? { multas: Number(form.multas) } : {}),
          ...(form.ahorroInicial ? { ahorroInicial: Number(form.ahorroInicial) } : {}),
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || "Error"); }
      setForm({}); setSuccess("Socio agregado correctamente");
      setTimeout(() => setSuccess(null), 3000);
      await fetchSocios(); setActiveTab("lista");
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este socio?")) return;
    try {
      const r = await fetch(`/api/socios/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Error al eliminar");
      setSocios(prev => prev.filter(s => s.id !== id));
      setSuccess("Socio eliminado"); setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
  };

  const openEdit = (s: SocioRow) => {
    setEditing(s);
    setEditForm({ cedula: s.cedula, nombres: s.nombres, apellidos: s.apellidos, edad: s.edad, multas: s.multas });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      setSavingEdit(true);
      const res = await fetch(`/api/socios/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cedula: editForm.cedula?.trim(), nombres: editForm.nombres?.trim(),
          apellidos: editForm.apellidos?.trim(),
          ...(editForm.edad != null ? { edad: Number(editForm.edad) } : {}),
          ...(editForm.multas != null ? { multas: Number(editForm.multas) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error");
      setSuccess("Cambios guardados"); setTimeout(() => setSuccess(null), 2500);
      setEditing(null); setEditForm({}); await fetchSocios();
    } catch (e: any) { setError(e?.message); }
    finally { setSavingEdit(false); }
  };

  const sociosFiltrados = socios.filter(s => {
    const sq = q.trim().toLowerCase();
    if (!sq) return true;
    return [s.nombres, s.apellidos, s.numeroCuenta, s.cedula].some(v => v.toLowerCase().includes(sq));
  });

  const totalAhorros = socios.reduce((s, x) => s + x.ahorros, 0);
  const totalMultas = socios.reduce((s, x) => s + x.multas, 0);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="text-sm text-gray-500">Cargando socios...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/>
            </svg>
          </span>
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Gestión de Socios</h1>
            <p className="text-xs sm:text-sm text-gray-500">Administra los socios de la cooperativa</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-5">
          <p className="text-xs text-gray-500">Socios</p>
          <p className="mt-1 text-xl sm:text-3xl font-bold text-gray-900">{socios.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-5">
          <p className="text-xs text-gray-500">Ahorros</p>
          <p className="mt-1 text-base sm:text-2xl font-bold text-emerald-600 tabular-nums">{fmt(totalAhorros)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-5">
          <p className="text-xs text-gray-500">Multas</p>
          <p className="mt-1 text-base sm:text-2xl font-bold text-rose-600 tabular-nums">{fmt(totalMultas)}</p>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Tabs */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b flex">
          {(["lista", "formulario"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab ? "text-blue-700 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              {tab === "lista" ? "Lista de Socios" : "Agregar Socio"}
            </button>
          ))}
        </div>

        {/* FORM */}
        {activeTab === "formulario" && (
          <div className="p-4 sm:p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Agregar Nuevo Socio</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Cédula", key: "cedula", placeholder: "001-1234567-8", type: "text", required: true },
                { label: "Nombres", key: "nombres", placeholder: "Nombres del socio", type: "text", required: true },
                { label: "Apellidos", key: "apellidos", placeholder: "Apellidos del socio", type: "text", required: true },
                { label: "Edad", key: "edad", placeholder: "Edad", type: "number", required: true },
                { label: "Ahorro inicial ($)", key: "ahorroInicial", placeholder: "0.00", type: "number", required: false },
                { label: "Multas ($)", key: "multas", placeholder: "0.00", type: "number", required: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} required={f.required}
                    value={(form as any)[f.key] ?? ""}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none" />
                </div>
              ))}
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setActiveTab("lista")}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Agregar Socio</button>
              </div>
            </form>
          </div>
        )}

        {/* LISTA */}
        {activeTab === "lista" && (
          <div>
            <div className="px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b bg-gray-50">
              <div className="relative flex-1 sm:max-w-xs">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar socio…"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none pl-8" />
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none">
                  <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.05l3.725 3.725a.75.75 0 1 0 1.06-1.06l-3.724-3.725A6.75 6.75 0 0 0 10.5 3.75Z" clipRule="evenodd"/>
                </svg>
              </div>
              <button onClick={() => setActiveTab("formulario")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                Nuevo
              </button>
            </div>

            {sociosFiltrados.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-500">No hay socios registrados.</div>
            ) : (
              <>
                {/* Tabla — solo desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-gray-100">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Cuenta</th>
                        <th className="px-4 py-3 text-left">Nombre</th>
                        <th className="px-4 py-3 text-left">Cédula</th>
                        <th className="px-4 py-3 text-left">Edad</th>
                        <th className="px-4 py-3 text-right">Ahorros</th>
                        <th className="px-4 py-3 text-right">Multas</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {sociosFiltrados.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.numeroCuenta}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{s.nombres} {s.apellidos}</td>
                          <td className="px-4 py-3 text-gray-500">{s.cedula}</td>
                          <td className="px-4 py-3 text-gray-500">{s.edad}</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums">{fmt(s.ahorros)}</td>
                          <td className="px-4 py-3 text-right font-medium text-rose-600 tabular-nums">{fmt(s.multas)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                              <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tarjetas — solo móvil */}
                <ul className="sm:hidden divide-y">
                  {sociosFiltrados.map(s => (
                    <li key={s.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{s.nombres} {s.apellidos}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{s.numeroCuenta}</p>
                          <p className="text-xs text-gray-400 mt-0.5">CI: {s.cedula} · {s.edad} años</p>
                          <div className="flex gap-3 mt-2">
                            <span className="text-xs font-semibold text-emerald-600">{fmt(s.ahorros)}</span>
                            {s.multas > 0 && <span className="text-xs font-semibold text-rose-600">Multa: {fmt(s.multas)}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => openEdit(s)}
                            className="rounded-md border px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 font-medium">Editar</button>
                          <button onClick={() => handleDelete(s.id)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 font-medium">Eliminar</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal edición */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => !savingEdit && setEditing(null)} />
          <div className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Editar socio</h3>
                <p className="text-xs text-gray-500 font-mono">{editing.numeroCuenta}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 p-1 text-lg">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
                <input type="text" value={editForm.cedula ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, cedula: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
                <input type="number" value={editForm.edad ?? ""} min={1}
                  onChange={e => setEditForm(f => ({ ...f, edad: Number(e.target.value) }))}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                <input type="text" value={editForm.nombres ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, nombres: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                <input type="text" value={editForm.apellidos ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, apellidos: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Multas ($)</label>
                <input type="number" step="0.01" min={0} value={editForm.multas ?? 0}
                  onChange={e => setEditForm(f => ({ ...f, multas: Number(e.target.value) }))}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={saveEdit} disabled={savingEdit}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white ${savingEdit ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}>
                {savingEdit ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
