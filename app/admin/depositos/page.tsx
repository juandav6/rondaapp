// app/admin/depositos/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d); };
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Mov = {
  id: number; tipo: "AHORRO" | "RETIRO"; monto: number; nota: string | null;
  createdAt: string; socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number };
  ronda: { nombre: string } | null;
};

export default function AdminDepositosPage() {
  const [socios, setSocios] = useState<any[]>([]);
  const [socioId, setSocioId] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "AHORRO" | "RETIRO">("TODOS");
  const [movimientos, setMovimientos] = useState<Mov[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Mov | null>(null);
  const [form, setForm] = useState<{ monto: number | string; nota: string }>({ monto: "", nota: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };

  useEffect(() => {
    fetch("/api/admin/socios").then(r => r.json()).then(d => setSocios(Array.isArray(d) ? d : []));
  }, []);

  async function buscar() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (socioId) params.set("socioId", String(socioId));
      if (filtroTipo !== "TODOS") params.set("tipo", filtroTipo);
      const res = await fetch(`/api/admin/movimientos-cuenta?${params}`, { cache: "no-store" });
      const d = await res.json();
      setMovimientos(d.movimientos ?? []);
      setTotal(d.total ?? 0);
    } catch (e: any) { showMsg(e.message, false); }
    finally { setLoading(false); }
  }

  async function guardar() {
    if (!editando) return;
    if (!confirm(
      `¿Confirmar cambio en ${editando.tipo === "AHORRO" ? "depósito" : "retiro"} de ${editando.socio.nombres} ${editando.socio.apellidos}?\n\n` +
      `Monto: ${fmt(editando.monto)} → ${fmt(Number(form.monto))}\n\n` +
      `💡 El saldo de ahorros del socio se recalculará automáticamente.\n\nQuedará en bitácora.`
    )) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos-cuenta", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editando.id, monto: Number(form.monto), nota: form.nota }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const efectoMsg = d.efectos?.length ? ` · ${d.efectos[0].descripcion}` : "";
      showMsg(`${editando.tipo === "AHORRO" ? "Depósito" : "Retiro"} actualizado.${efectoMsg}`, true);
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  async function eliminar(mov: Mov) {
    const tipo = mov.tipo === "AHORRO" ? "depósito" : "retiro";
    if (!confirm(
      `¿Eliminar este ${tipo} de ${mov.socio.nombres} ${mov.socio.apellidos}?\n\n` +
      `Monto: ${fmt(mov.monto)}\n\n` +
      `⚠️ El saldo de ahorros del socio se ${mov.tipo === "AHORRO" ? "reducirá" : "aumentará"} en ${fmt(mov.monto)}.\n\nQuedará en bitácora.`
    )) return;
    try {
      const res = await fetch("/api/admin/movimientos-cuenta", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mov.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} eliminado. Nuevo saldo: ${fmt(d.nuevoSaldo)}`, true);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
  }

  const filtrados = movimientos.filter(m =>
    `${m.socio.nombres} ${m.socio.apellidos} ${m.socio.numeroCuenta}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalDepositos = movimientos.filter(m => m.tipo === "AHORRO").reduce((s, m) => s + m.monto, 0);
  const totalRetiros   = movimientos.filter(m => m.tipo === "RETIRO").reduce((s, m) => s + m.monto, 0);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Administrar depósitos y retiros</h1>
        <p className="text-xs text-gray-400">Editar o eliminar movimientos · cambios recalculan saldo del socio automáticamente</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
          {msg.text}
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Socio (opcional)</label>
            <select value={socioId ?? ""} onChange={e => setSocioId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200">
              <option value="">— Todos los socios —</option>
              {socios.map((s: any) => (
                <option key={s.id} value={s.id}>{s.apellidos}, {s.nombres} ({s.numeroCuenta})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
            <div className="flex gap-1">
              {(["TODOS", "AHORRO", "RETIRO"] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={cn("rounded-lg px-3 py-2 text-xs font-medium border transition-colors",
                    filtroTipo === t
                      ? t === "AHORRO" ? "bg-emerald-600 text-white border-emerald-600"
                        : t === "RETIRO" ? "bg-rose-600 text-white border-rose-600"
                        : "bg-gray-800 text-white border-gray-800"
                      : "text-gray-600 border-gray-200 hover:bg-gray-50")}>
                  {t === "TODOS" ? "Todos" : t === "AHORRO" ? "💰 Depósitos" : "↑ Retiros"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={buscar} disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-40">
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {movimientos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase">Depósitos</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{fmt(totalDepositos)}</p>
            <p className="text-[10px] text-emerald-400">{movimientos.filter(m => m.tipo === "AHORRO").length} registros</p>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
            <p className="text-[10px] text-rose-600 font-semibold uppercase">Retiros</p>
            <p className="text-lg font-bold text-rose-700 tabular-nums">{fmt(totalRetiros)}</p>
            <p className="text-[10px] text-rose-400">{movimientos.filter(m => m.tipo === "RETIRO").length} registros</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Neto</p>
            <p className={cn("text-lg font-bold tabular-nums", totalDepositos - totalRetiros >= 0 ? "text-emerald-700" : "text-rose-700")}>
              {fmt(totalDepositos - totalRetiros)}
            </p>
            <p className="text-[10px] text-gray-400">{total} registros totales</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {movimientos.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-gray-700">{filtrados.length} movimiento{filtrados.length !== 1 ? "s" : ""}</p>
            <input type="text" placeholder="Buscar socio…" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200 w-48"/>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-center">Tipo</th>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-left">Ronda</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Saldo actual</th>
                  <th className="px-4 py-3 text-left">Nota</th>
                  <th className="px-4 py-3 text-right">Fecha</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(m => (
                  <tr key={m.id} className="border-t hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                        m.tipo === "AHORRO" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                        {m.tipo === "AHORRO" ? "💰 Depósito" : "↑ Retiro"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.socio.nombres} {m.socio.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{m.socio.numeroCuenta}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{m.ronda?.nombre ?? <span className="text-gray-300">—</span>}</td>
                    <td className={cn("px-4 py-3 text-right tabular-nums font-semibold",
                      m.tipo === "AHORRO" ? "text-emerald-700" : "text-rose-700")}>
                      {m.tipo === "AHORRO" ? "+" : "−"}{fmt(m.monto)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 text-xs">
                      {fmt(m.socio.saldoAhorros)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">
                      {m.nota || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => { setEditando(m); setForm({ monto: m.monto, nota: m.nota ?? "" }); }}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700">
                          Editar
                        </button>
                        <button
                          onClick={() => eliminar(m)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtrados.length === 0 && busqueda && (
            <div className="p-6 text-center text-sm text-gray-400">Sin resultados para "{busqueda}"</div>
          )}
        </div>
      )}

      {!loading && movimientos.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          Selecciona un filtro y presiona Buscar para ver los registros
        </div>
      )}

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">
              Editar {editando.tipo === "AHORRO" ? "depósito" : "retiro"}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {editando.socio.nombres} {editando.socio.apellidos} · {editando.socio.numeroCuenta}
            </p>

            {/* Info actual */}
            <div className="rounded-lg bg-gray-50 border p-3 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Monto actual:</span>
                <span className="font-semibold">{fmt(editando.monto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Saldo actual socio:</span>
                <span className="font-semibold text-emerald-700">{fmt(editando.socio.saldoAhorros)}</span>
              </div>
              {Number(form.monto) !== editando.monto && Number(form.monto) > 0 && (
                <div className="flex justify-between border-t pt-1">
                  <span className="text-gray-500">Saldo después del cambio:</span>
                  <span className={cn("font-bold",
                    editando.tipo === "AHORRO"
                      ? "text-emerald-700"
                      : "text-rose-700")}>
                    {fmt(editando.socio.saldoAhorros + (
                      editando.tipo === "AHORRO"
                        ? (Number(form.monto) - editando.monto)
                        : (editando.monto - Number(form.monto))
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Monto ($)</label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={form.monto}
                  onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-200"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nota (opcional)</label>
                <input
                  type="text"
                  value={form.nota}
                  onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
                  placeholder="Descripción del movimiento…"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"/>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              💡 Al cambiar el monto, el saldo de ahorros del socio se ajustará automáticamente por la diferencia.
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 mt-2 text-xs text-gray-500">📋 Cambio registrado en bitácora.</div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.monto || Number(form.monto) <= 0}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
