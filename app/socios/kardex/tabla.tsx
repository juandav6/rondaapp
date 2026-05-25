// app/socios/kardex/tabla.tsx
"use client";
import { useState } from "react";

type DetalleLinea = { fecha: Date | string; referencia: string; haber: number };
type KardexLinea = {
  id: string; tipo: string; fecha: Date | string;
  concepto: string; referencia: string;
  debe: number; haber: number; saldo: number;
  detalle?: DetalleLinea[];
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d: Date | string | null) => {
  if (!d) return "—";
  const dt = new Date(d as string);
  return isNaN(dt.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(dt);
};
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function KardexTabla({ lineas }: { lineas: KardexLinea[] }) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left w-8"></th>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-left">Concepto</th>
            <th className="px-4 py-3 text-left">Referencia</th>
            <th className="px-4 py-3 text-right text-rose-600">Debe (−)</th>
            <th className="px-4 py-3 text-right text-emerald-600">Haber (+)</th>
            <th className="px-4 py-3 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => {
            const expandido = expandidos.has(l.id);
            const tieneDetalle = l.detalle && l.detalle.length > 0;
            return (
              <>
                {/* Fila principal */}
                <tr
                  key={l.id}
                  className={cn(
                    "border-t",
                    l.tipo === "AHORRO" ? "bg-teal-50/30 hover:bg-teal-50/60" : "hover:bg-gray-50/60",
                    expandido && "border-b-0"
                  )}
                >
                  {/* Botón expandir */}
                  <td className="px-2 py-3 text-center">
                    {tieneDetalle ? (
                      <button
                        onClick={() => toggle(l.id)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-teal-100 hover:text-teal-700 transition-colors"
                        title={expandido ? "Ocultar detalle" : "Ver semanas"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                          className={cn("h-3.5 w-3.5 transition-transform", expandido && "rotate-180")}>
                          <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(l.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-1.5">
                      {l.tipo === "AHORRO" && (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-teal-600 text-[10px]">A</span>
                      )}
                      {l.concepto}
                      {tieneDetalle && (
                        <span className="ml-1 rounded-full bg-teal-100 text-teal-600 px-1.5 text-[10px] font-medium">
                          {l.detalle!.length} sem.
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate">{l.referencia}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {l.debe > 0
                      ? <span className="text-rose-600 font-medium">{fmt(l.debe)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {l.haber > 0
                      ? <span className="text-emerald-600 font-medium">{fmt(l.haber)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={cn("px-4 py-3 text-right tabular-nums font-semibold",
                    l.saldo >= 0 ? "text-teal-700" : "text-rose-700")}>
                    {fmt(l.saldo)}
                  </td>
                </tr>

                {/* Filas detalle por semana */}
                {expandido && tieneDetalle && l.detalle!.map((d, i) => (
                  <tr key={`${l.id}-det-${i}`} className="border-t border-teal-100 bg-teal-50/20">
                    <td className="px-2 py-2"></td>
                    <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap pl-6">
                      {fmtDate(d.fecha)}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 pl-6">
                      <span className="text-gray-300 mr-1">└</span> Detalle semana
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400 max-w-[200px] truncate">{d.referencia}</td>
                    <td className="px-4 py-2 text-right text-gray-300 text-xs">—</td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs text-emerald-500">{fmt(d.haber)}</td>
                    <td className="px-4 py-2 text-right text-gray-300 text-xs">—</td>
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
          <tr>
            <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700">TOTAL</td>
            <td className="px-4 py-3 text-right tabular-nums font-bold text-rose-700">
              {fmt(lineas.reduce((s, l) => s + l.debe, 0))}
            </td>
            <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">
              {fmt(lineas.reduce((s, l) => s + l.haber, 0))}
            </td>
            <td className={cn("px-4 py-3 text-right tabular-nums font-bold text-base",
              (lineas[lineas.length - 1]?.saldo ?? 0) >= 0 ? "text-teal-700" : "text-rose-700")}>
              {fmt(lineas[lineas.length - 1]?.saldo ?? 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
