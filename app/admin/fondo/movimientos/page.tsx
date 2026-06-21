// app/admin/fondo/movimientos/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt  = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtD = (iso: string | null) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d); };
const toISO = (iso: string | null) => { if (!iso) return ""; try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; } };
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const TIPO_CFG: Record<string, { label: string; bg: string; color: string; signo: string }> = {
  INVERSION:  { label: "📤 Inversión",   bg: "bg-blue-100",    color: "text-blue-700",    signo: "−" },
  DEVOLUCION: { label: "📥 Devolución",  bg: "bg-emerald-100", color: "text-emerald-700", signo: "+" },
  INTERES:    { label: "✦ Interés",      bg: "bg-amber-100",   color: "text-amber-700",   signo: "+" },
};

type Mov = {
  id: number; tipo: string; monto: number; nota: string | null;
  createdAt: string; ronda: { id: number; nombre: string } | null;
  socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string };
};

export default function AdminFondoMovimientosPage() {
  const [socios, setSocios]         = useState<any[]>([]);
  const [rondas, setRondas]         = useState<any[]>([]);
  const [filtroSocio, setFiltroSocio] = useState<number | null>(null);
  const [filtroRonda, setFiltroRonda] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [movimientos, setMovimientos] = useState<Mov[]>([]);
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null);

  // Modal editar fecha
  const [editando, setEditando]     = useState<Mov | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [saving, setSaving]         = useState(false);

  const showMsg = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/socios").then(r => r.json()),
      fetch("/api/rondas/historial").then(r => r.json()),
    ]).then(([s, r]) => {
      setSocios(Array.isArray(s) ? s : []);
      setRondas(Array.isArray(r) ? r : []);
    });
    buscar();
  }, []);

  async function buscar() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200", tipo: "TODOS" });
      if (filtroSocio) params.set("socioId", String(filtroSocio));
      // Traer todos los tipos de fondo
      const res = await fetch(`/api/admin/movimientos-cuenta?${params}`);
      const d = await res.json();
      // Filtrar solo INVERSION, DEVOLUCION, INTERES
      let movs: Mov[] = (d.movimientos ?? []).filter((m: Mov) =>
        ["INVERSION", "DEVOLUCION", "INTERES"].includes(m.tipo)
      );
      if (filtroRonda) movs = movs.filter(m => m.ronda?.id === filtroRonda);
      if (filtroTipo !== "TODOS") movs = movs.filter(m => m.tipo === filtroTipo);
      setMovimientos(movs);
    } catch (e: any) { showMsg(e.message, false); }
    finally { setLoading(false); }
  }

  async function guardarFecha() {
    if (!editando || !nuevaFecha) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos-cuenta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editando.id, fecha: nuevaFecha }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg("Fecha actualizada correctamente", true);
      setEditando(null);
      await buscar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  // Totales
  const totInv  = movimientos.filter(m => m.tipo === "INVERSION").reduce((s, m)  => s + m.monto, 0);
  const totDev  = movimientos.filter(m => m.tipo === "DEVOLUCION").reduce((s, m) => s + m.monto, 0);
  const totInt  = movimientos.filter(m => m.tipo === "INTERES").reduce((s, m)    => s + m.monto, 0);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Transferencias de fondo de inversión</h1>
        <p className="text-xs text-gray-400">Ver y corregir fechas de inversiones, devoluciones e intereses</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
          {msg.text}
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-0 sm:min-w-[180px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Socio</label>
            <select value={filtroSocio ?? ""} onChange={e => setFiltroSocio(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">— Todos los socios —</option>
              {socios.map((s: any) => (
                <option key={s.id} value={s.id}>{s.apellidos}, {s.nombres} ({s.numeroCuenta})</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0 sm:min-w-[160px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ronda</label>
            <select value={filtroRonda ?? ""} onChange={e => setFiltroRonda(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">— Todas las rondas —</option>
              {rondas.map((r: any) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
            <div className="flex gap-1 flex-wrap">
              {[
                { key: "TODOS",     label: "Todos" },
                { key: "INVERSION", label: "📤 Inversión" },
                { key: "DEVOLUCION",label: "📥 Devolución" },
                { key: "INTERES",   label: "✦ Interés" },
              ].map(t => (
                <button key={t.key} onClick={() => setFiltroTipo(t.key)}
                  className={cn("rounded-lg px-3 py-2 text-xs font-medium border transition-colors",
                    filtroTipo === t.key ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50")}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={buscar} disabled={loading}
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40 h-[38px]">
            {loading ? "…" : "Buscar"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {movimientos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
            <p className="text-[10px] text-blue-600 font-semibold uppercase">Total invertido</p>
            <p className="text-lg font-bold text-blue-700 tabular-nums">{fmt(totInv)}</p>
            <p className="text-[10px] text-blue-400">{movimientos.filter(m => m.tipo === "INVERSION").length} mov.</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase">Total devuelto</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{fmt(totDev)}</p>
            <p className="text-[10px] text-emerald-400">{movimientos.filter(m => m.tipo === "DEVOLUCION").length} mov.</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-[10px] text-amber-600 font-semibold uppercase">Total intereses</p>
            <p className="text-lg font-bold text-amber-700 tabular-nums">{fmt(totInt)}</p>
            <p className="text-[10px] text-amber-400">{movimientos.filter(m => m.tipo === "INTERES").length} mov.</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {movimientos.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-700">{movimientos.length} movimiento{movimientos.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-center">Tipo</th>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-left">Ronda</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-left">Nota</th>
                  <th className="px-4 py-3 text-center">Fecha</th>
                  <th className="px-4 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => {
                  const cfg = TIPO_CFG[m.tipo] ?? { label: m.tipo, bg: "bg-gray-100", color: "text-gray-600", signo: "" };
                  return (
                    <tr key={m.id} className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-center">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", cfg.bg, cfg.color)}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{m.socio.nombres} {m.socio.apellidos}</p>
                        <p className="text-gray-400 font-mono text-[10px]">{m.socio.numeroCuenta}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{m.ronda?.nombre ?? "—"}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", cfg.color)}>
                        {cfg.signo}{fmt(m.monto)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate" title={m.nota ?? ""}>
                        {m.nota || "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600 whitespace-nowrap">
                        {fmtD(m.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { setEditando(m); setNuevaFecha(toISO(m.createdAt)); }}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100">
                          📅 Fecha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && movimientos.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          Presiona Buscar para cargar los movimientos del fondo
        </div>
      )}

      {/* Modal cambiar fecha */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Cambiar fecha</h3>
            <p className="text-xs text-gray-400 mb-4">
              {TIPO_CFG[editando.tipo]?.label ?? editando.tipo} · {editando.socio.nombres} {editando.socio.apellidos} · {editando.ronda?.nombre}
            </p>

            {/* Info actual */}
            <div className="rounded-lg bg-gray-50 border p-3 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Monto:</span>
                <span className="font-semibold">{fmt(editando.monto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha actual:</span>
                <span className="font-semibold">{fmtD(editando.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Nota:</span>
                <span className="text-gray-600 truncate ml-2 max-w-[180px]">{editando.nota || "—"}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nueva fecha</label>
              <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
            </div>

            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              💡 Solo cambia la fecha del movimiento. El monto y el saldo del socio no se modifican.
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 mt-2 text-xs text-gray-500">📋 Cambio registrado en bitácora.</div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditando(null)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardarFecha} disabled={saving || !nuevaFecha}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar fecha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
