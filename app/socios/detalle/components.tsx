"use client";
// app/socios/detalle/components.tsx
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtD = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso as string);
  return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Buscador de socios ─────────────────────────────────────────────────────────
export function SocioSearch({ socios, selectedId }: { socios: any[]; selectedId?: number }) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toLowerCase();
    setQ(v);
    const list = document.getElementById("socios-list");
    if (!list) return;
    list.querySelectorAll<HTMLLIElement>("li[data-search]").forEach(li => {
      li.style.display = !v || li.dataset.search?.includes(v) ? "" : "none";
    });
  }

  return (
    <input
      ref={ref}
      type="text"
      value={q}
      onChange={handleChange}
      placeholder="Buscar nombre, cuenta o cédula…"
      className="w-full rounded-md bg-gray-100 pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300 focus:bg-white transition-colors border-0"
    />
  );
}

// ── Sección multas: todas las rondas ──────────────────────────────────────────
export function MultasSection({ socioId }: { socioId: number }) {
  const [data, setData] = useState<{ rondas: any[]; totalPendiente: number; totalCobrado: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<number | null>(null);

  useEffect(() => {
    if (!socioId) return;
    async function load() {
      setLoading(true);
      try {
        // Cargar historial de rondas para buscar multas en todas
        const rondasRes = await fetch("/api/rondas/historial", { cache: "no-store" });
        if (!rondasRes.ok) return;
        const rondas: any[] = await rondasRes.json();

        const resultados = await Promise.all(
          rondas.map(async (r: any) => {
            try {
              const cajaRes = await fetch(`/api/rondas/${r.id}/caja`, { cache: "no-store" });
              if (!cajaRes.ok) return null;
              const caja = await cajaRes.json();
              const multasSocio = (caja.movimientos ?? []).filter(
                (m: any) => m.tipo === "MULTA" && m.socio?.id === socioId
              );
              if (multasSocio.length === 0) return null;
              return { rondaId: r.id, rondaNombre: r.nombre, activa: r.activa, multas: multasSocio };
            } catch { return null; }
          })
        );

        const rondasConMultas = resultados.filter(Boolean);
        const todasMultas = rondasConMultas.flatMap((r: any) => r.multas);
        setData({
          rondas: rondasConMultas,
          totalPendiente: todasMultas.filter((m: any) => m.estado === "PENDIENTE").reduce((s: number, m: any) => s + m.monto, 0),
          totalCobrado: todasMultas.filter((m: any) => m.estado === "COBRADO").reduce((s: number, m: any) => s + m.monto, 0),
        });
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [socioId]);

  const totalMultas = data?.rondas.flatMap(r => r.multas).length ?? 0;

  return (
    <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="border-b bg-amber-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-amber-600">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
          </svg>
          <p className="text-sm font-semibold text-amber-800">Historial de multas</p>
          {!loading && totalMultas > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
              {totalMultas}
            </span>
          )}
        </div>
        {data && (data.totalPendiente > 0 || data.totalCobrado > 0) && (
          <div className="flex gap-2 text-xs">
            {data.totalPendiente > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                Pend. {fmt(data.totalPendiente)}
              </span>
            )}
            {data.totalCobrado > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
                Cobr. {fmt(data.totalCobrado)}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-100"/>)}
        </div>
      ) : !data || data.rondas.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">✓ Sin multas registradas en ninguna ronda</div>
      ) : (
        <div className="divide-y">
          {data.rondas.map((r: any) => {
            const multasPend = r.multas.filter((m: any) => m.estado === "PENDIENTE");
            const multasCobr = r.multas.filter((m: any) => m.estado === "COBRADO");
            const isOpen = expandida === r.rondaId;
            return (
              <div key={r.rondaId}>
                {/* Cabecera ronda */}
                <button onClick={() => setExpandida(isOpen ? null : r.rondaId)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50/30 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-block h-1.5 w-1.5 rounded-full", r.activa ? "bg-emerald-500" : "bg-gray-300")}/>
                    <p className="text-sm font-medium text-gray-800">{r.rondaNombre}</p>
                    {r.activa && <span className="rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold">Activa</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 text-xs">
                      {multasPend.length > 0 && (
                        <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-semibold">
                          {fmt(multasPend.reduce((s: number, m: any) => s + m.monto, 0))} pend.
                        </span>
                      )}
                      {multasCobr.length > 0 && (
                        <span className="rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 font-medium">
                          {fmt(multasCobr.reduce((s: number, m: any) => s + m.monto, 0))} cobr.
                        </span>
                      )}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                      className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")}>
                      <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </button>

                {/* Detalle multas */}
                {isOpen && (
                  <div className="border-t bg-gray-50">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-100 text-gray-500 uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-2 text-center">Sem.</th>
                          <th className="px-4 py-2 text-right">Monto</th>
                          <th className="px-4 py-2 text-center">Estado</th>
                          <th className="px-4 py-2 text-left">Observación</th>
                          <th className="px-4 py-2 text-right">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.multas.map((m: any) => (
                          <tr key={m.id} className={cn("border-t", m.estado === "PENDIENTE" ? "bg-amber-50/50" : "")}>
                            <td className="px-4 py-2 text-center">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">
                                {m.semana ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-700">
                              {fmt(m.monto)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                m.estado === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                                {m.estado === "PENDIENTE" ? "Pend." : "Cobr."}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-500">
                              {m.descripcion || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-400">{fmtD(m.fecha)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
