"use client";
// app/socios/detalle/components.tsx
import { useEffect, useRef, useState } from "react";

// ── Buscador de socios ────────────────────────────────────────────────────────
export function SocioSearch() {
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
      placeholder="Buscar por nombre, cuenta o cédula…"
      className="w-full rounded-md border-0 bg-gray-100 pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300 focus:bg-white transition-colors"
    />
  );
}

// ── Sección historial de multas ───────────────────────────────────────────────
export function MultasSection({ socioId }: { socioId: number }) {
  const [multas, setMultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
  const fmtD = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  };

  useEffect(() => {
    async function load() {
      try {
        // Obtener ronda activa
        const rondaRes = await fetch("/api/rondas", { cache: "no-store" });
        if (!rondaRes.ok || rondaRes.status === 204) return;
        const ronda = await rondaRes.json();
        // Obtener movimientos de caja
        const cajaRes = await fetch(`/api/rondas/${ronda.id}/caja`, { cache: "no-store" });
        if (!cajaRes.ok) return;
        const caja = await cajaRes.json();
        const socioMovs = (caja.movimientos ?? []).filter(
          (m: any) => m.tipo === "MULTA" && m.socio?.id === socioId
        );
        setMultas(socioMovs);
      } catch { }
      finally { setLoading(false); }
    }
    if (socioId) load();
  }, [socioId]);

  return (
    <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="border-b bg-amber-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-amber-600">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
          </svg>
          <p className="text-sm font-semibold text-amber-800">Historial de multas</p>
        </div>
        {multas.length > 0 && (
          <span className="text-xs font-bold text-amber-700">
            Total: {fmt(multas.reduce((s: number, m: any) => s + m.monto, 0))}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-100"/>)}
        </div>
      ) : multas.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">✓ Sin multas registradas en la ronda activa</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-center">Semana</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2 text-left">Observación</th>
                <th className="px-4 py-2 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {multas.map((m: any) => (
                <tr key={m.id} className="border-t hover:bg-amber-50/40">
                  <td className="px-4 py-2 text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                      {m.semana}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-700">{fmt(m.monto)}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {m.descripcion || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-gray-400">{fmtD(m.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
