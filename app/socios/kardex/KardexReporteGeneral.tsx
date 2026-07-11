"use client";
import { useState } from "react";

export function KardexReporteGeneral() {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(today);

  const href = `/api/socios/kardex-resumen?fechaCorte=${fecha}`;

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <div className="flex flex-col">
        <label className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-0.5 px-0.5">
          Fecha de corte
        </label>
        <input
          type="date"
          value={fecha}
          max={today}
          onChange={e => setFecha(e.target.value)}
          className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        />
      </div>
      <a
        href={href}
        download
        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors self-end">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Zm6.905 9.97a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72V18a.75.75 0 0 0 1.5 0v-4.19l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3Z" clipRule="evenodd"/>
          <path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z"/>
        </svg>
        Reporte general (Excel)
      </a>
    </div>
  );
}
