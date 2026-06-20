// app/admin/sincronizar/page.tsx
"use client";
import { useState } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);

const ACCION_COLOR: Record<string, string> = {
  CREAR:      "bg-blue-50 text-blue-700 border-blue-200",
  ACTUALIZAR: "bg-amber-50 text-amber-700 border-amber-200",
  ELIMINAR:   "bg-red-50 text-red-700 border-red-200",
};

export default function AdminSincronizarPage() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socioId, setSocioId] = useState("");

  async function ejecutar(soloVer: boolean) {
    setLoading(true); setError(null); setResultado(null);
    try {
      const res = await fetch("/api/admin/sincronizar-movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soloVer,
          socioId: socioId ? Number(socioId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultado(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  const accionColor = (accion: string) => {
    if (accion.startsWith("CREAR")) return ACCION_COLOR.CREAR;
    if (accion.startsWith("ACTUALIZAR")) return ACCION_COLOR.ACTUALIZAR;
    if (accion.startsWith("ELIMINAR")) return ACCION_COLOR.ELIMINAR;
    return "bg-gray-50 text-gray-700";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Sincronizar movimientos de kardex</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compara la tabla <code className="bg-gray-100 px-1 rounded text-xs">ahorros</code> (fuente de verdad)
          con <code className="bg-gray-100 px-1 rounded text-xs">movimientos_cuenta</code> y corrige las discrepancias.
        </p>
      </div>

      {/* Controles */}
      <div className="rounded-2xl border bg-white p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wide">
            Filtrar por socio (opcional)
          </label>
          <input
            type="number"
            placeholder="ID del socio — dejar vacío para todos"
            value={socioId}
            onChange={e => setSocioId(e.target.value)}
            className="w-full sm:w-80 rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <p className="text-xs text-gray-400 mt-1">Útil para revisar un socio específico antes de aplicar globalmente.</p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => ejecutar(true)}
            disabled={loading}
            className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            {loading ? "Analizando…" : "🔍 Solo diagnosticar"}
          </button>
          <button
            onClick={() => {
              if (!confirm("¿Aplicar las correcciones?\n\nSe actualizarán los movimientos de kardex y los saldos para que coincidan con la tabla de ahorros. Esta acción modifica datos en la BD.")) return;
              ejecutar(false);
            }}
            disabled={loading}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {loading ? "Aplicando…" : "✅ Diagnosticar y corregir"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500 uppercase font-semibold">Discrepancias</p>
              <p className={`text-2xl font-bold mt-1 ${resultado.totalDiferencias > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {resultado.totalDiferencias}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500 uppercase font-semibold">Corregidos</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700">{resultado.corregidos}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500 uppercase font-semibold">Saldos ajustados</p>
              <p className="text-2xl font-bold mt-1 text-blue-700">{resultado.saldosAjustados}</p>
            </div>
            <div className={`rounded-xl border p-4 ${resultado.soloVer ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Modo</p>
              <p className={`text-sm font-bold mt-1 ${resultado.soloVer ? "text-blue-700" : "text-emerald-700"}`}>
                {resultado.soloVer ? "🔍 Diagnóstico" : "✅ Corrección aplicada"}
              </p>
            </div>
          </div>

          {/* Mensaje */}
          <div className={`rounded-xl border p-4 text-sm font-medium ${resultado.totalDiferencias === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
            {resultado.totalDiferencias === 0 ? "✅ Todo está sincronizado — no hay discrepancias." : `⚠️ ${resultado.mensaje}`}
          </div>

          {/* Tabla discrepancias */}
          {resultado.diferencias.length > 0 && (
            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="border-b bg-gray-50 px-5 py-3">
                <p className="text-sm font-semibold text-gray-800">
                  Detalle de discrepancias ({resultado.diferencias.length})
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Socio ID</th>
                      <th className="px-4 py-3 text-left">Ronda</th>
                      <th className="px-4 py-3 text-center">Semana</th>
                      <th className="px-4 py-3 text-right">En tabla ahorros</th>
                      <th className="px-4 py-3 text-right">En movimientos</th>
                      <th className="px-4 py-3 text-left">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.diferencias.map((d: any, i: number) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.socioId}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{d.rondaNombre}</td>
                        <td className="px-4 py-3 text-center">#{d.semana}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700 font-medium">
                          {d.montoAhorro > 0 ? fmt(d.montoAhorro) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-700 font-medium">
                          {d.montoMovimiento != null ? fmt(d.montoMovimiento) : <span className="text-gray-300">no existe</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${accionColor(d.accion)}`}>
                            {d.accion.split(" ")[0]}
                          </span>
                          {d.accion.includes("→") && (
                            <span className="ml-2 text-xs text-gray-500">{d.accion.match(/\(.*\)/)?.[0]}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
