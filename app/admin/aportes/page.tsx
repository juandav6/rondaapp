// app/admin/aportes/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminAportesPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number|null>(null);
  const [semana, setSemana] = useState<number|"">("");
  const [aportes, setAportes] = useState<any[]>([]);
  const [ahorros, setAhorros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"aportes"|"ahorros">("aportes");
  const [editando, setEditando] = useState<any|null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  useEffect(() => {
    fetch("/api/rondas/historial").then(r => r.json()).then(d => setRondas(Array.isArray(d) ? d : d.rondas ?? []));
  }, []);

  async function buscar() {
    if (!rondaId) return;
    setLoading(true);
    try {
      const url = semana ? `/api/rondas/${rondaId}/semanas/${semana}/detalle` : `/api/rondas/${rondaId}/semanas`;
      const res = await fetch(url);
      const d = await res.json();
      if (semana && d.rows) {
        setAportes(d.rows.map((r: any) => ({ socio: { nombres: r.nombres, apellidos: r.apellidos, numeroCuenta: r.numeroCuenta }, semana: r.semana ?? Number(semana), ...r })));
        setAhorros(d.rows);
      } else {
        // Sin semana específica: cargar todos via aportes API
        const apRes = await fetch(`/api/rondas/${rondaId}/aportes?all=true`);
        if (apRes.ok) { const ap = await apRes.json(); setAportes(ap.aportes ?? []); }
      }
    } finally { setLoading(false); }
  }

  async function guardarCambio() {
    if (!editando) return;
    const tipo = tab === "aportes" ? "aporte" : "ahorro";
    const advertencia = tipo === "ahorro" ? "\n\n💡 Esto recalculará el saldo de ahorros del socio." : "";
    if (!confirm(`¿Confirmar cambio en ${tipo}?${advertencia}\n\nQuedará en bitácora.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: editando.id ?? editando.socioId, datos: form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const efectoMsg = d.efectos?.length ? ` · ${d.efectos[0].descripcion}` : "";
      showMsg(`${tipo === "aporte" ? "Aporte" : "Ahorro"} actualizado.${efectoMsg}`, true);
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  const datos = tab === "aportes" ? aportes : ahorros;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Administrar aportes y ahorros</h1>
        <p className="text-xs text-gray-400">Editar o eliminar registros · cambios de ahorro recalculan saldo del socio</p>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda</label>
            <select value={rondaId ?? ""} onChange={e => setRondaId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">— Seleccionar ronda —</option>
              {rondas.map((r: any) => <option key={r.id} value={r.id}>{r.nombre} {r.activa ? "✓" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Semana (opcional)</label>
            <input type="number" min="1" value={semana} onChange={e => setSemana(e.target.value ? Number(e.target.value) : "")}
              placeholder="Todas"
              className="w-28 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
          </div>
          <div className="flex items-end">
            <button onClick={buscar} disabled={!rondaId || loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40">
              {loading ? "Buscando…" : "Buscar"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {(["aportes", "ahorros"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize",
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t === "aportes" ? `Aportes (${aportes.length})` : `Ahorros (${ahorros.length})`}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {datos.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-center">Semana</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  {tab === "aportes" && <th className="px-4 py-3 text-right">Multa</th>}
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((item: any, i: number) => (
                  <tr key={`${item.id ?? item.socioId}-${i}`} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.socio?.nombres ?? item.nombres} {item.socio?.apellidos ?? item.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.socio?.numeroCuenta ?? item.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">{item.semana}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {fmt(tab === "aportes" ? item.aporteSemana ?? Number(item.monto ?? 0) : item.ahorroSemana ?? Number(item.monto ?? 0))}
                    </td>
                    {tab === "aportes" && <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmt(item.multaSemana ?? Number(item.multa ?? 0))}</td>}
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => {
                        setEditando(item);
                        setForm(tab === "aportes"
                          ? { monto: item.aporteSemana ?? item.monto, multa: item.multaSemana ?? item.multa }
                          : { monto: item.ahorroSemana ?? item.monto });
                      }} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Editar {tab === "aportes" ? "aporte" : "ahorro"}</h3>
            <p className="text-xs text-gray-400 mb-4">
              {editando.socio?.nombres ?? editando.nombres} · Semana {editando.semana}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Monto ($)</label>
                <input type="number" step="0.01" value={form.monto ?? ""} onChange={e => setForm((p: any) => ({ ...p, monto: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"/>
              </div>
              {tab === "aportes" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Multa ($)</label>
                  <input type="number" step="0.01" value={form.multa ?? 0} onChange={e => setForm((p: any) => ({ ...p, multa: e.target.value }))}
                    className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                </div>
              )}
            </div>
            {tab === "ahorros" && (
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                💡 Cambiar el monto de ahorro recalculará automáticamente el saldo de ahorros del socio.
              </div>
            )}
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">
              📋 Cambio registrado en bitácora.
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardarCambio} disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
