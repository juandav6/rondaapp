// app/admin/fondo/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtPct = (n: number) => `${Number(n).toFixed(2)}%`;
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminFondoPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [ronda, setRonda] = useState<any>(null);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean; efectos?: any[] } | null>(null);

  const showMsg = (text: string, ok: boolean, efectos?: any[]) => {
    setMsg({ text, ok, efectos }); setTimeout(() => setMsg(null), 5000);
  };

  useEffect(() => {
    fetch("/api/rondas/historial")
      .then(r => r.json())
      .then(d => setRondas(Array.isArray(d) ? d : (d.rondas ?? [])));
  }, []);

  async function buscar() {
    if (!rondaId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/rondas/${rondaId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const d = await res.json();
      setRonda(d);
      setCuentas(d.cuentasInversion ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function guardar() {
    if (!editando) return;
    const datos: any = {};
    if (form.montoInvertido !== undefined) datos.montoInvertido = Number(form.montoInvertido);
    if (form.interesesAcumulados !== undefined) datos.interesesAcumulados = Number(form.interesesAcumulados);

    const cambiaFondo = datos.montoInvertido !== undefined &&
      Number(form.montoInvertido) !== Number(editando.montoInvertido);
    if (!confirm(
      `¿Confirmar cambios en cuenta de ${editando.socio?.nombres} ${editando.socio?.apellidos}?` +
      (cambiaFondo ? `\n\n⚡ Cambiar el monto recalculará el % de participación de TODOS los inversores de la ronda.` : "") +
      `\n\nQuedará en bitácora.`
    )) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "cuentaInversion", id: editando.id, datos }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(
        "Cuenta de inversión actualizada." +
        (d.efectos?.length ? ` ${d.efectos[0].descripcion}` : ""),
        true, d.efectos
      );
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  const totalFondo = cuentas.reduce((s, c) => s + Number(c.montoInvertido), 0);
  const totalIntereses = cuentas.reduce((s, c) => s + Number(c.interesesAcumulados), 0);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Fondo de inversión</h1>
        <p className="text-xs text-gray-400">Editar montos invertidos por socio · recalcula porcentajes automáticamente</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
          <p>{msg.text}</p>
          {msg.efectos?.map((e: any, i: number) => <p key={i} className="text-xs mt-1 opacity-80">↳ {e.descripcion}</p>)}
        </div>
      )}

      {/* Filtro */}
      <div className="rounded-xl border bg-white p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda</label>
          <select value={rondaId ?? ""} onChange={e => setRondaId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="">— Seleccionar ronda —</option>
            {rondas.map((r: any) => <option key={r.id} value={r.id}>{r.nombre}{r.activa ? " ✓" : ""}</option>)}
          </select>
        </div>
        <button onClick={buscar} disabled={!rondaId || loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40">
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* KPIs */}
      {cuentas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
            <p className="text-[10px] text-blue-600 font-semibold uppercase">Fondo total</p>
            <p className="text-lg font-bold text-blue-700 tabular-nums">{fmt(totalFondo)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase">Inversores</p>
            <p className="text-lg font-bold text-emerald-700">{cuentas.length}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-[10px] text-amber-600 font-semibold uppercase">Intereses acum.</p>
            <p className="text-lg font-bold text-amber-700 tabular-nums">{fmt(totalIntereses)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Saldo disponible</p>
            <p className="text-lg font-bold text-gray-700 tabular-nums">{fmt(ronda?.saldoFondoDisponible ?? 0)}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {cuentas.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-700">{ronda?.nombre}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              ⚡ Al editar un monto, los porcentajes de todos los inversores se recalculan automáticamente
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-right">Monto invertido</th>
                  <th className="px-4 py-3 text-right">% Participación</th>
                  <th className="px-4 py-3 text-right">Intereses acum.</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {cuentas
                  .sort((a, b) => Number(b.montoInvertido) - Number(a.montoInvertido))
                  .map((c: any) => (
                    <tr key={c.id} className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.socio?.nombres} {c.socio?.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{c.socio?.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-700">
                        {fmt(c.montoInvertido)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(Number(c.porcentajeParticipacion), 100)}%` }} />
                          </div>
                          <span className="tabular-nums text-xs font-semibold">
                            {fmtPct(c.porcentajeParticipacion)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700 font-semibold">
                        {Number(c.interesesAcumulados) > 0 ? fmt(c.interesesAcumulados) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                          c.devuelto ? "bg-gray-100 text-gray-500" : "bg-emerald-100 text-emerald-700")}>
                          {c.devuelto ? "Devuelto" : "Activo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setEditando(c);
                            setForm({ montoInvertido: Number(c.montoInvertido), interesesAcumulados: Number(c.interesesAcumulados) });
                          }}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td className="px-4 py-3 font-semibold text-sm">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 tabular-nums">{fmt(totalFondo)}</td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-500">100%</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700 tabular-nums">{fmt(totalIntereses)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && cuentas.length === 0 && rondaId && !error && (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          Sin cuentas de inversión registradas en esta ronda
        </div>
      )}

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Editar inversión</h3>
            <p className="text-xs text-gray-400 mb-1">{editando.socio?.nombres} {editando.socio?.apellidos}</p>
            <p className="text-xs text-gray-400 mb-4">
              Participación actual: <strong>{fmtPct(editando.porcentajeParticipacion)}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Monto invertido ($)</label>
                <input type="number" step="0.01" min="0"
                  value={form.montoInvertido ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, montoInvertido: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Intereses acumulados ($)</label>
                <input type="number" step="0.01" min="0"
                  value={form.interesesAcumulados ?? ""}
                  onChange={e => setForm((p: any) => ({ ...p, interesesAcumulados: e.target.value }))}
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
              </div>
            </div>
            {Number(form.montoInvertido) !== Number(editando.montoInvertido) && (
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                ⚡ Al cambiar el monto se recalcularán los porcentajes de participación de todos los inversores de la ronda.
              </div>
            )}
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">
              📋 Cambio registrado en bitácora con fecha y hora.
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
