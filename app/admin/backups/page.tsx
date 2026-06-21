// app/admin/backups/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
};
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const TIPO_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  MANUAL:      { label: "Manual",      bg: "bg-blue-100",    text: "text-blue-700" },
  AUTO_SEMANA: { label: "Auto semana", bg: "bg-emerald-100", text: "text-emerald-700" },
  AUTO_CIERRE: { label: "Auto cierre", bg: "bg-amber-100",   text: "text-amber-700" },
};

export default function AdminBackupsPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSnaps, setLoadingSnaps] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Modal crear backup
  const [crearOpen, setCrearOpen] = useState(false);
  const [nombreBackup, setNombreBackup] = useState("");
  const [creando, setCreando] = useState(false);

  // Modal ver detalle
  const [detalle, setDetalle] = useState<any | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Estado para acciones en curso
  const [accionId, setAccionId] = useState<number | null>(null);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  };

  // Cargar rondas
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rondas/historial");
        const data = await res.json();
        setRondas(data);
        // Seleccionar la ronda activa por defecto, o la primera
        const activa = data.find((r: any) => r.activa);
        if (activa) setRondaId(activa.id);
        else if (data.length > 0) setRondaId(data[0].id);
      } catch (e: any) {
        showMsg("Error cargando rondas", false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Cargar snapshots cuando cambia la ronda
  useEffect(() => {
    if (!rondaId) return;
    cargarSnapshots();
  }, [rondaId]);

  async function cargarSnapshots() {
    if (!rondaId) return;
    setLoadingSnaps(true);
    try {
      const res = await fetch(`/api/admin/snapshots?rondaId=${rondaId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSnapshots(data.snapshots ?? []);
    } catch (e: any) {
      showMsg(e.message, false);
    } finally {
      setLoadingSnaps(false);
    }
  }

  // Crear backup manual
  async function crearBackup() {
    if (!rondaId) return;
    setCreando(true);
    try {
      const res = await fetch("/api/admin/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rondaId, nombre: nombreBackup.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg(`Backup creado: ${data.snapshot?.nombre ?? "OK"}`, true);
      setCrearOpen(false);
      setNombreBackup("");
      await cargarSnapshots();
    } catch (e: any) {
      showMsg(e.message, false);
    } finally {
      setCreando(false);
    }
  }

  // Ver detalle
  async function verDetalle(snap: any) {
    setLoadingDetalle(true);
    setDetalle({ ...snap, resumen: null });
    try {
      const res = await fetch(`/api/admin/snapshots/${snap.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetalle(data);
    } catch (e: any) {
      showMsg(e.message, false);
      setDetalle(null);
    } finally {
      setLoadingDetalle(false);
    }
  }

  // Descargar JSON
  async function descargarJSON(snap: any) {
    setAccionId(snap.id);
    try {
      const res = await fetch(`/api/admin/snapshots/${snap.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${snap.nombre?.replace(/\s+/g, "_") ?? snap.id}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMsg("Descarga iniciada", true);
    } catch (e: any) {
      showMsg(e.message, false);
    } finally {
      setAccionId(null);
    }
  }

  // Restaurar
  async function restaurar(snap: any) {
    if (!confirm(`ADVERTENCIA: Esto reemplazara TODOS los datos actuales de la ronda.\n\nSe restaurara el snapshot "${snap.nombre}" (semana ${snap.semana}).\n\nEsta accion NO se puede deshacer. ¿Continuar?`)) return;
    if (!confirm("¿Esta COMPLETAMENTE seguro? Todos los datos actuales seran reemplazados.")) return;
    setAccionId(snap.id);
    try {
      const res = await fetch(`/api/admin/snapshots/${snap.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "restaurar" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg("Snapshot restaurado correctamente", true);
    } catch (e: any) {
      showMsg(e.message, false);
    } finally {
      setAccionId(null);
    }
  }

  // Eliminar
  async function eliminar(snap: any) {
    if (!confirm(`¿Eliminar el snapshot "${snap.nombre}"?\n\nEsta accion NO se puede deshacer.`)) return;
    setAccionId(snap.id);
    try {
      const res = await fetch(`/api/admin/snapshots/${snap.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg("Snapshot eliminado", true);
      await cargarSnapshots();
    } catch (e: any) {
      showMsg(e.message, false);
    } finally {
      setAccionId(null);
    }
  }

  if (loading)
    return (
      <div className="p-4 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Backups y snapshots</h1>
          <p className="text-xs text-gray-400">
            {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}{" "}
            {rondaId ? `en ronda seleccionada` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de ronda */}
          <select
            value={rondaId ?? ""}
            onChange={(e) => setRondaId(Number(e.target.value) || null)}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            <option value="" disabled>
              Seleccionar ronda...
            </option>
            {rondas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre} {r.activa ? "(activa)" : ""}
              </option>
            ))}
          </select>

          {/* Boton crear backup */}
          <button
            onClick={() => setCrearOpen(true)}
            disabled={!rondaId}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Crear backup manual
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {msg && (
        <div
          className={cn(
            "rounded-xl p-3 text-sm",
            msg.ok
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          )}
        >
          {msg.text}
        </div>
      )}

      {/* Tabla de snapshots */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loadingSnaps ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !rondaId ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Selecciona una ronda para ver sus snapshots
          </div>
        ) : snapshots.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No hay snapshots para esta ronda
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[600px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-center">Semana</th>
                  <th className="px-4 py-3 text-center">Tipo</th>
                  <th className="px-4 py-3 text-left">Fecha de creacion</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s: any) => {
                  const badge = TIPO_BADGE[s.tipo] ?? { label: s.tipo, bg: "bg-gray-100", text: "text-gray-700" };
                  const enAccion = accionId === s.id;
                  return (
                    <tr key={s.id} className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.nombre}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-600">{s.semana}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", badge.bg, badge.text)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-1.5 justify-center flex-wrap">
                          <button
                            onClick={() => verDetalle(s)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100"
                          >
                            Ver detalle
                          </button>
                          <button
                            onClick={() => descargarJSON(s)}
                            disabled={enAccion}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          >
                            {enAccion ? "Descargando..." : "Descargar JSON"}
                          </button>
                          <button
                            onClick={() => restaurar(s)}
                            disabled={enAccion}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            Restaurar
                          </button>
                          <button
                            onClick={() => eliminar(s)}
                            disabled={enAccion}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear backup */}
      {crearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-2xl bg-white p-4 sm:p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Crear backup manual</h3>
            <p className="text-xs text-gray-400 mb-4">
              Ronda: {rondas.find((r) => r.id === rondaId)?.nombre ?? "—"}
            </p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Nombre del backup (opcional)
              </label>
              <input
                type="text"
                value={nombreBackup}
                onChange={(e) => setNombreBackup(e.target.value)}
                placeholder="Ej: Antes de correccion semana 5"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <p className="mt-1 text-xs text-gray-400">
                Si lo dejas vacio se generara un nombre automatico.
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 mt-3 text-xs text-gray-500">
              Se guardara una copia completa de todos los datos de la ronda en este momento.
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  setCrearOpen(false);
                  setNombreBackup("");
                }}
                className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={crearBackup}
                disabled={creando}
                className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm text-white disabled:opacity-50"
              >
                {creando ? "Creando..." : "Crear backup"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ver detalle */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl bg-white shadow-xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b">
              <div>
                <h3 className="text-base font-semibold">Detalle del snapshot</h3>
                <p className="text-xs text-gray-400 mt-0.5">{detalle.nombre}</p>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path
                    fillRule="evenodd"
                    d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {loadingDetalle ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
                  ))}
                </div>
              ) : detalle.resumen ? (
                <div className="space-y-4">
                  {/* Info general */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Ronda</p>
                      <p className="font-medium text-gray-900">{detalle.rondaNombre ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Semana</p>
                      <p className="font-medium text-gray-900">{detalle.semana}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Tipo</p>
                      <p className="font-medium text-gray-900">
                        {(() => {
                          const b = TIPO_BADGE[detalle.tipo] ?? { label: detalle.tipo, bg: "bg-gray-100", text: "text-gray-700" };
                          return (
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", b.bg, b.text)}>
                              {b.label}
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Creado</p>
                      <p className="text-xs text-gray-600">{fmtDate(detalle.createdAt)}</p>
                    </div>
                  </div>

                  {/* Resumen de registros */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Registros contenidos</p>
                    <div className="rounded-xl border bg-gray-50 divide-y">
                      {[
                        { key: "socios", label: "Socios (saldos)" },
                        { key: "participaciones", label: "Participaciones" },
                        { key: "aportes", label: "Aportes" },
                        { key: "ahorros", label: "Ahorros" },
                        { key: "prestamos", label: "Prestamos" },
                        { key: "prestamosExpress", label: "Prestamos express" },
                        { key: "cuentasInversion", label: "Cuentas inversion" },
                        { key: "movimientosCuenta", label: "Movimientos cuenta" },
                        { key: "movimientosFondo", label: "Movimientos fondo" },
                        { key: "movimientosCaja", label: "Movimientos caja" },
                        { key: "ingresosMulta", label: "Ingresos multa" },
                        { key: "gastosMulta", label: "Gastos multa" },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="tabular-nums font-semibold text-gray-900">
                            {detalle.resumen[item.key] ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-gray-400">Sin datos de resumen</div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-3 flex justify-end">
              <button onClick={() => setDetalle(null)} className="rounded-lg border px-4 py-2 text-sm text-gray-700">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
