// app/admin/sincronizar/page.tsx
"use client";
import { useState } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);

const TABS = [
  { id: "ahorros", label: "Ahorros vs Movimientos" },
  { id: "saldos", label: "Saldos completos" },
  { id: "fondo", label: "Fondo de inversión" },
  { id: "caja", label: "Caja" },
];

export default function AdminSincronizarPage() {
  const [tab, setTab] = useState("ahorros");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socioId, setSocioId] = useState("");
  const [rondaId, setRondaId] = useState("");

  async function ejecutar(soloVer: boolean) {
    setLoading(true); setError(null); setResultado(null);
    try {
      let url = "";
      let body: any = { soloVer };

      if (tab === "ahorros") {
        url = "/api/admin/sincronizar-movimientos";
        body.socioId = socioId ? Number(socioId) : null;
      } else if (tab === "saldos") {
        url = "/api/admin/reconciliar/saldos";
        body.socioId = socioId ? Number(socioId) : null;
      } else if (tab === "fondo") {
        url = "/api/admin/reconciliar/fondo";
        body.rondaId = rondaId ? Number(rondaId) : null;
      } else if (tab === "caja") {
        url = "/api/admin/reconciliar/caja";
        body.rondaId = rondaId ? Number(rondaId) : null;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultado(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  function resetOnTabChange(newTab: string) {
    setTab(newTab);
    setResultado(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reconciliación y diagnóstico</h1>
        <p className="text-sm text-gray-500 mt-1">
          Detecta y corrige discrepancias entre tablas de datos, saldos y movimientos.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-100 p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => resetOnTabChange(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="rounded-2xl border bg-white p-5 space-y-4">
        {(tab === "ahorros" || tab === "saldos") && (
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wide">
              Filtrar por socio (opcional)
            </label>
            <input type="number" placeholder="ID del socio — dejar vacío para todos" value={socioId}
              onChange={e => setSocioId(e.target.value)}
              className="w-full sm:w-80 rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        )}
        {(tab === "fondo" || tab === "caja") && (
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wide">
              Filtrar por ronda (opcional)
            </label>
            <input type="number" placeholder="ID de la ronda — dejar vacío para todas" value={rondaId}
              onChange={e => setRondaId(e.target.value)}
              className="w-full sm:w-80 rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <button onClick={() => ejecutar(true)} disabled={loading}
            className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            {loading ? "Analizando…" : "Solo diagnosticar"}
          </button>
          <button onClick={() => {
            if (!confirm("¿Aplicar las correcciones?\n\nSe modificarán datos en la BD para corregir las discrepancias encontradas.")) return;
            ejecutar(false);
          }} disabled={loading}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {loading ? "Aplicando…" : "Diagnosticar y corregir"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {resultado && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500 uppercase font-semibold">Discrepancias</p>
              <p className={`text-2xl font-bold mt-1 ${(resultado.totalDiferencias ?? resultado.diferencias?.length ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {resultado.totalDiferencias ?? resultado.diferencias?.length ?? 0}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500 uppercase font-semibold">Corregidos</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700">{resultado.corregidos ?? 0}</p>
            </div>
            {resultado.saldosAjustados !== undefined && (
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs text-gray-500 uppercase font-semibold">Saldos ajustados</p>
                <p className="text-2xl font-bold mt-1 text-blue-700">{resultado.saldosAjustados}</p>
              </div>
            )}
            <div className={`rounded-xl border p-4 ${resultado.soloVer ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Modo</p>
              <p className={`text-sm font-bold mt-1 ${resultado.soloVer ? "text-blue-700" : "text-emerald-700"}`}>
                {resultado.soloVer ? "Diagnóstico" : "Corrección aplicada"}
              </p>
            </div>
          </div>

          {/* Status message */}
          <div className={`rounded-xl border p-4 text-sm font-medium ${
            (resultado.totalDiferencias ?? resultado.diferencias?.length ?? 0) === 0
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            {(resultado.totalDiferencias ?? resultado.diferencias?.length ?? 0) === 0
              ? "Todo está sincronizado — no hay discrepancias."
              : resultado.mensaje ?? `${resultado.diferencias?.length ?? 0} discrepancias encontradas`}
          </div>

          {/* Detail table */}
          {resultado.diferencias?.length > 0 && (
            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="border-b bg-gray-50 px-5 py-3">
                <p className="text-sm font-semibold text-gray-800">
                  Detalle ({resultado.diferencias.length})
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      {tab === "saldos" ? (
                        <>
                          <th className="px-4 py-3 text-left">Socio</th>
                          <th className="px-4 py-3 text-right">Saldo actual</th>
                          <th className="px-4 py-3 text-right">Saldo calculado</th>
                          <th className="px-4 py-3 text-right">Diferencia</th>
                        </>
                      ) : tab === "fondo" ? (
                        <>
                          <th className="px-4 py-3 text-left">Ronda</th>
                          <th className="px-4 py-3 text-left">Campo</th>
                          <th className="px-4 py-3 text-right">Actual</th>
                          <th className="px-4 py-3 text-right">Calculado</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-3 text-left">Socio/Ronda</th>
                          <th className="px-4 py-3 text-center">Semana</th>
                          <th className="px-4 py-3 text-right">Fuente</th>
                          <th className="px-4 py-3 text-right">Encontrado</th>
                          <th className="px-4 py-3 text-left">Acción</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.diferencias.map((d: any, i: number) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        {tab === "saldos" ? (
                          <>
                            <td className="px-4 py-3 font-semibold">{d.nombre ?? `Socio #${d.socioId}`}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmt(d.saldoActual)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmt(d.saldoCalculado)}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-red-600">{fmt(d.diferencia)}</td>
                          </>
                        ) : tab === "fondo" ? (
                          <>
                            <td className="px-4 py-3 font-semibold">{d.rondaNombre ?? `Ronda #${d.rondaId}`}</td>
                            <td className="px-4 py-3">{d.campo}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmt(d.actual)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmt(d.calculado)}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-semibold">{d.rondaNombre ?? d.nombre ?? `#${d.socioId}`}</td>
                            <td className="px-4 py-3 text-center">{d.semana != null ? `#${d.semana}` : "—"}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                              {d.montoAhorro != null ? fmt(d.montoAhorro) : d.montoFuente != null ? fmt(d.montoFuente) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                              {d.montoMovimiento != null ? fmt(d.montoMovimiento) : d.montoEncontrado != null ? fmt(d.montoEncontrado) : "no existe"}
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-gray-600">{d.accion}</td>
                          </>
                        )}
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
