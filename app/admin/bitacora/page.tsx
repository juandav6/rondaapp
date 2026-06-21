// app/admin/bitacora/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d);
};
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

const ACCION_CFG: Record<string, { color: string; bg: string; label: string }> = {
  CREAR:    { color: "text-emerald-700", bg: "bg-emerald-100", label: "Creado" },
  EDITAR:   { color: "text-blue-700",    bg: "bg-blue-100",    label: "Editado" },
  ELIMINAR: { color: "text-red-700",     bg: "bg-red-100",     label: "Eliminado" },
};

const TABLA_LABELS: Record<string, string> = {
  socios: "Socios", rondas: "Rondas", aportes: "Aportes", ahorros: "Ahorros",
  prestamos: "Préstamos", prestamos_express: "Express", movimientos_caja: "Caja",
  prestamo_cuotas: "Cuotas",
};

export default function AdminBitacoraPage() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<any | null>(null);

  // Filtros
  const [filtroTabla, setFiltroTabla] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  async function cargar(p = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (filtroTabla)  params.set("tabla",  filtroTabla);
      if (filtroAccion) params.set("accion", filtroAccion);
      if (filtroDesde)  params.set("desde",  filtroDesde);
      if (filtroHasta)  params.set("hasta",  filtroHasta);
      const res = await fetch(`/api/admin/bitacora?${params}`);
      const d = await res.json();
      setRegistros(d.registros ?? []);
      setTotal(d.total ?? 0);
      setPages(d.pages ?? 1);
      setPage(p);
    } finally { setLoading(false); }
  }

  useEffect(() => { cargar(1); }, []);

  function renderCambios(cambios: any) {
    if (!cambios || typeof cambios !== "object") return null;
    return Object.entries(cambios).map(([campo, vals]: [string, any]) => (
      <div key={campo} className="flex items-start gap-2 text-xs flex-wrap">
        <span className="font-medium text-gray-600 shrink-0">{campo}:</span>
        <span className="text-red-500 line-through break-all">{String(vals.antes ?? "—")}</span>
        <span className="text-gray-400">→</span>
        <span className="text-emerald-600 font-medium break-all">{String(vals.despues ?? "—")}</span>
      </div>
    ));
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Bitácora de cambios</h1>
          <p className="text-xs text-gray-400">{total} registros totales · todos los cambios del sistema</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Módulo</label>
            <select value={filtroTabla} onChange={e => setFiltroTabla(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200">
              <option value="">Todos</option>
              {Object.entries(TABLA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Acción</label>
            <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200">
              <option value="">Todas</option>
              <option value="CREAR">Creado</option>
              <option value="EDITAR">Editado</option>
              <option value="ELIMINAR">Eliminado</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Desde</label>
            <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"/>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Hasta</label>
            <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"/>
          </div>
        </div>
        <button onClick={() => cargar(1)} disabled={loading}
          className="mt-3 w-full sm:w-auto rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-900 disabled:opacity-40">
          {loading ? "Buscando…" : "Aplicar filtros"}
        </button>
      </div>

      {/* Lista */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100"/>)}</div>
        ) : registros.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">Sin registros para los filtros seleccionados</div>
        ) : (
          <ul className="divide-y">
            {registros.map((b: any) => {
              const cfg = ACCION_CFG[b.accion] ?? ACCION_CFG.EDITAR;
              const tieneEfectos = b.efectosCadena && Array.isArray(b.efectosCadena) && b.efectosCadena.length > 0;
              return (
                <li key={b.id} className="p-4 hover:bg-gray-50/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", cfg.bg, cfg.color)}>
                        {b.accion === "CREAR" ? "+" : b.accion === "EDITAR" ? "✎" : "×"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.color)}>{cfg.label}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            {TABLA_LABELS[b.tabla] ?? b.tabla}
                          </span>
                          {tieneEfectos && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              {b.efectosCadena.length} efecto(s) en cascada
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                          {b.descripcionRegistro || `#${b.registroId}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(b.createdAt)}</p>
                      </div>
                    </div>
                    <button onClick={() => setDetalle(detalle?.id === b.id ? null : b)}
                      className="shrink-0 rounded-lg border px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100">
                      {detalle?.id === b.id ? "Cerrar" : "Ver detalle"}
                    </button>
                  </div>

                  {detalle?.id === b.id && (
                    <div className="mt-3 rounded-xl border bg-gray-50 p-4 space-y-3 overflow-x-auto">
                      {/* Cambios directos */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Cambios realizados</p>
                        <div className="space-y-1">
                          {Object.keys(b.camposCambios ?? {}).length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Sin campos registrados</p>
                          ) : renderCambios(b.camposCambios)}
                        </div>
                      </div>

                      {/* Efectos en cascada */}
                      {tieneEfectos && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Efectos en cascada</p>
                          <div className="space-y-2">
                            {b.efectosCadena.map((ef: any, i: number) => (
                              <div key={i} className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                                <p className="text-xs font-medium text-amber-800">
                                  {TABLA_LABELS[ef.tabla] ?? ef.tabla} #{ef.registroId}
                                </p>
                                <p className="text-xs text-amber-700 mt-0.5">{ef.descripcion}</p>
                                {ef.camposAfectados && (
                                  <div className="mt-2 space-y-1">
                                    {renderCambios(ef.camposAfectados)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-2 flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs text-gray-400">
                        <span>Usuario: {b.usuario}</span>
                        <span>ID registro: #{b.registroId}</span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => cargar(page - 1)} disabled={page <= 1 || loading}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">← Anterior</button>
          <span className="text-sm text-gray-500">Página {page} de {pages}</span>
          <button onClick={() => cargar(page + 1)} disabled={page >= pages || loading}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Siguiente →</button>
        </div>
      )}
    </div>
  );
}
