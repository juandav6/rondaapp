// app/admin/socios/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminSociosPage() {
  const [socios, setSocios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const showMsg = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

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

  async function guardar() {
    if (!editando) return;
    const cambiaAhorros = Number(form.saldoAhorros) !== Number(editando.saldoAhorros);
    const advertencia = cambiaAhorros
      ? `\n\n💰 Saldo de ahorros: ${fmt(editando.saldoAhorros)} → ${fmt(Number(form.saldoAhorros))}`
      : "";
    if (!confirm(`¿Confirmar cambios en el socio ${editando.nombres} ${editando.apellidos}?${advertencia}\n\nEsta acción quedará registrada en la bitácora.`)) return;
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
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminar(s: any) {
    if (!confirm(`¿ELIMINAR permanentemente a ${s.nombres} ${s.apellidos}?\n\nEsta acción NO se puede deshacer y quedará en bitácora.`)) return;
    try {
      const res = await fetch(`/api/admin/socios/${s.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Socio eliminado", true);
      setConfirmDelete(null);
      await cargar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  if (loading) return <div className="p-4 space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100"/>)}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Administrar socios</h1>
          <p className="text-xs text-gray-400">{socios.length} socios registrados</p>
        </div>
        <input type="text" placeholder="Buscar nombre, cuenta o cédula…" value={buscar} onChange={e => setBuscar(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-violet-200"/>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

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
              {filtrados.map((s, i) => (
                <tr key={s.id} className="border-t hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.numeroCuenta}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.nombres} {s.apellidos}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.cedula}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmt(s.saldoAhorros)}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400">
                    {s._count.aportes}A · {s._count.ahorros}Ah · {s._count.prestamos}P
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={() => abrirEditar(s)}
                        className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-700">Editar</button>
                      <button onClick={() => eliminar(s)}
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
                { label: "Nombres", key: "nombres" },
                { label: "Apellidos", key: "apellidos" },
                { label: "Cédula", key: "cedula" },
                { label: "Número de cuenta", key: "numeroCuenta" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                  <input type="text" value={form[f.key] ?? ""} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/>
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Edad</label>
                <input type="number" value={form.edad ?? ""} onChange={e => setForm((p: any) => ({ ...p, edad: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Saldo de ahorros ($)
                  <span className="ml-1 font-normal text-gray-400">— editar solo si el valor fue ingresado incorrectamente</span>
                </label>
                <input type="number" step="0.01" min="0" value={form.saldoAhorros ?? ""} onChange={e => setForm((p: any) => ({ ...p, saldoAhorros: e.target.value }))}
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                {Number(form.saldoAhorros) !== Number(editando.saldoAhorros) && (
                  <p className="mt-1 text-xs text-amber-600">
                    Cambio: {fmt(Number(editando.saldoAhorros))} → {fmt(Number(form.saldoAhorros))}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-4 text-xs text-amber-700">
              ⚠️ Los cambios quedarán registrados en la bitácora con fecha y hora.
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
