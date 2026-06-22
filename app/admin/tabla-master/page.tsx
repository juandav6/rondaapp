// app/admin/tabla-master/page.tsx
"use client";
import { useEffect, useState, useRef, useCallback } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const cn = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

/* ── Types ─────────────────────────────────────────────────── */

interface Prestamo {
  id: number;
  monto: number;
  saldoActual: number;
  estado: string;
}

interface Inversion {
  montoInvertido: number;
  porcentaje: number;
  intereses: number;
}

interface SemanaData {
  aporte: number;
  multa: number;
  ahorro: number;
  express: number | null;
}

interface Socio {
  socioId: number;
  nombres: string;
  apellidos: string;
  numeroCuenta: string;
  orden: number;
  semanas: Record<string, SemanaData>;
  totales: { aportes: number; ahorros: number; multas: number };
  prestamos: Prestamo[];
  inversion: Inversion | null;
}

interface SemanaResumen {
  totalAportes: number;
  totalAhorros: number;
  responsable: string;
}

interface RondaInfo {
  id: number;
  nombre: string;
  semanaActual: number;
  montoAporte: number;
}

interface TablaMasterData {
  ronda: RondaInfo;
  socios: Socio[];
  semanas: Record<string, SemanaResumen>;
  totalSemanas: number;
}

/* ── Editable Cell ─────────────────────────────────────────── */

function EditableCell({
  value,
  tipo,
  socioId,
  semana,
  rondaId,
  onSaved,
  bgClass,
}: {
  value: number | null;
  tipo: "aporte" | "ahorro" | "multa" | "express";
  socioId: number;
  semana: number;
  rondaId: number;
  onSaved: () => void;
  bgClass: string;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setInputVal(value != null ? String(value) : "0");
    setEditing(true);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = async () => {
    const newVal = parseFloat(inputVal);
    if (isNaN(newVal) || newVal === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/movimientos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          socioId,
          semana,
          rondaId,
          monto: newVal,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Error al guardar");
      } else {
        onSaved();
      }
    } catch {
      alert("Error de conexion");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  };

  if (editing) {
    return (
      <td className={cn("px-1 py-0.5 text-right", bgClass)}>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-16 rounded border border-blue-400 px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        />
      </td>
    );
  }

  const displayVal = value != null ? value : null;
  const isEmpty = displayVal === null;
  const isZero = displayVal === 0;

  return (
    <td
      onClick={startEdit}
      className={cn(
        "px-1.5 py-0.5 text-right cursor-pointer group relative whitespace-nowrap",
        bgClass,
        "hover:ring-1 hover:ring-inset hover:ring-blue-300 transition-shadow"
      )}
      title="Click para editar"
    >
      <span
        className={cn(
          "tabular-nums text-xs",
          isEmpty && "text-gray-300",
          isZero && !isEmpty && "text-gray-400",
          !isEmpty && !isZero && "text-gray-800 font-medium"
        )}
      >
        {isEmpty ? "—" : fmt(displayVal)}
      </span>
      <span className="absolute right-0.5 top-0 text-[9px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
        &#9998;
      </span>
    </td>
  );
}

/* ── Sub-row type config ───────────────────────────────────── */

type SubRowType = "aporte" | "ahorro" | "multa" | "express";

const SUB_ROW_CONFIG: Record<
  SubRowType,
  { label: string; bgClass: string; bgHeaderClass: string; totalKey?: string }
> = {
  aporte: {
    label: "Aporte",
    bgClass: "bg-blue-50/60",
    bgHeaderClass: "bg-blue-100/70 text-blue-800",
    totalKey: "aportes",
  },
  ahorro: {
    label: "Ahorro",
    bgClass: "bg-emerald-50/60",
    bgHeaderClass: "bg-emerald-100/70 text-emerald-800",
    totalKey: "ahorros",
  },
  multa: {
    label: "Multa",
    bgClass: "bg-orange-50/60",
    bgHeaderClass: "bg-orange-100/70 text-orange-800",
    totalKey: "multas",
  },
  express: {
    label: "Express",
    bgClass: "bg-amber-50/60",
    bgHeaderClass: "bg-amber-100/70 text-amber-800",
  },
};

/* ── Main Page ─────────────────────────────────────────────── */

export default function TablaMasterPage() {
  const [rondas, setRondas] = useState<any[]>([]);
  const [rondaId, setRondaId] = useState<number | null>(null);
  const [data, setData] = useState<TablaMasterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  /* Load rondas on mount */
  useEffect(() => {
    fetch("/api/rondas/historial")
      .then((r) => r.json())
      .then((d) => setRondas(Array.isArray(d) ? d : d.rondas ?? []));
  }, []);

  /* Fetch tabla master data */
  const cargar = async () => {
    if (!rondaId) {
      showMsg("Selecciona una ronda", false);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/admin/rondas/${rondaId}/tabla-master`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const d: TablaMasterData = await res.json();
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* Helpers */
  const semanaKeys = data
    ? Array.from({ length: data.totalSemanas }, (_, i) => String(i + 1))
    : [];

  const getSubRows = (socio: Socio): SubRowType[] => {
    const rows: SubRowType[] = ["aporte", "ahorro"];
    const hasMultas = Object.values(socio.semanas).some(
      (s) => s.multa && s.multa > 0
    );
    if (hasMultas || socio.totales.multas > 0) rows.push("multa");
    const hasExpress = Object.values(socio.semanas).some(
      (s) => s.express !== null && s.express !== undefined && s.express > 0
    );
    if (hasExpress) rows.push("express");
    return rows;
  };

  const getCellValue = (
    socio: Socio,
    semana: string,
    tipo: SubRowType
  ): number | null => {
    const s = socio.semanas[semana];
    if (!s) return null;
    switch (tipo) {
      case "aporte":
        return s.aporte ?? null;
      case "ahorro":
        return s.ahorro ?? null;
      case "multa":
        return s.multa ?? null;
      case "express":
        return s.express ?? null;
    }
  };

  const getSubRowTotal = (socio: Socio, tipo: SubRowType): number => {
    const key = SUB_ROW_CONFIG[tipo].totalKey;
    if (key && socio.totales[key as keyof typeof socio.totales] !== undefined) {
      return socio.totales[key as keyof typeof socio.totales] as number;
    }
    // Compute from semanas
    return Object.values(socio.semanas).reduce((sum, s) => {
      const val = tipo === "express" ? s.express : s[tipo];
      return sum + (val ?? 0);
    }, 0);
  };

  /* Column totals */
  const getColumnTotal = (
    semana: string,
    tipo: SubRowType
  ): number => {
    if (!data) return 0;
    return data.socios.reduce((sum, socio) => {
      const val = getCellValue(socio, semana, tipo);
      return sum + (val ?? 0);
    }, 0);
  };

  const getGrandTotal = (tipo: SubRowType): number => {
    if (!data) return 0;
    return semanaKeys.reduce(
      (sum, sem) => sum + getColumnTotal(sem, tipo),
      0
    );
  };

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">
          Tabla Master de Ronda
        </h1>
        <p className="text-xs text-gray-400">
          Vista completa tipo hoja de calculo con todos los datos por socio y
          semana
        </p>
      </div>

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

      {/* Ronda selector */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Ronda *
            </label>
            <select
              value={rondaId ?? ""}
              onChange={(e) => {
                setRondaId(e.target.value ? Number(e.target.value) : null);
                setData(null);
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">-- Seleccionar ronda --</option>
              {rondas.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                  {r.activa ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={cargar}
            disabled={!rondaId || loading}
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {loading ? "Cargando..." : "Cargar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Ronda info badge */}
      {data && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-blue-700 font-medium">
            {data.ronda.nombre}
          </span>
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600">
            Semana actual: {data.ronda.semanaActual}
          </span>
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600">
            Aporte semanal: {fmt(data.ronda.montoAporte)}
          </span>
          <span className="rounded-lg bg-gray-50 border px-3 py-1.5 text-gray-600">
            Socios: {data.socios.length}
          </span>
        </div>
      )}

      {/* Main table */}
      {data && data.socios.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-w-full">
            <table className="text-xs border-collapse w-max min-w-full">
              {/* Column headers */}
              <thead>
                <tr className="sticky top-0 z-20 bg-gray-50 border-b">
                  <th className="sticky left-0 z-30 bg-gray-100 px-3 py-2.5 text-left font-semibold text-gray-700 border-r min-w-[180px]">
                    Socio / Tipo
                  </th>
                  {semanaKeys.map((sem) => (
                    <th
                      key={sem}
                      className="px-2 py-2.5 text-center font-semibold text-gray-600 border-r min-w-[80px]"
                    >
                      <div>Sem {sem}</div>
                      {data.semanas[sem]?.responsable && (
                        <div className="text-[10px] font-normal text-gray-400 truncate max-w-[76px]">
                          {data.semanas[sem].responsable}
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-bold text-gray-800 bg-gray-100 min-w-[90px]">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.socios.map((socio, idx) => {
                  const subRows = getSubRows(socio);
                  const isEven = idx % 2 === 0;
                  const zebraBase = isEven ? "" : "bg-gray-50/40";

                  return subRows.map((tipo, subIdx) => {
                    const config = SUB_ROW_CONFIG[tipo];
                    const isFirstRow = subIdx === 0;
                    const isLastRow = subIdx === subRows.length - 1;

                    return (
                      <tr
                        key={`${socio.socioId}-${tipo}`}
                        className={cn(
                          isLastRow && "border-b border-gray-200",
                          zebraBase
                        )}
                      >
                        {/* Sticky first column */}
                        <td
                          className={cn(
                            "sticky left-0 z-10 border-r px-3 py-1",
                            isFirstRow ? "pt-2" : "",
                            isLastRow ? "pb-2" : "",
                            isEven ? "bg-white" : "bg-gray-50"
                          )}
                        >
                          {isFirstRow && (
                            <div className="mb-0.5">
                              <p className="font-semibold text-gray-900 text-xs leading-tight">
                                {socio.nombres} {socio.apellidos}
                              </p>
                              <p className="text-[10px] text-gray-400 font-mono">
                                {socio.numeroCuenta}
                              </p>
                            </div>
                          )}
                          <span
                            className={cn(
                              "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                              config.bgHeaderClass
                            )}
                          >
                            {config.label}
                          </span>
                        </td>

                        {/* Data cells per week */}
                        {semanaKeys.map((sem) => (
                          <EditableCell
                            key={`${socio.socioId}-${tipo}-${sem}`}
                            value={getCellValue(socio, sem, tipo)}
                            tipo={tipo}
                            socioId={socio.socioId}
                            semana={Number(sem)}
                            rondaId={data.ronda.id}
                            onSaved={() => {
                              showMsg("Valor actualizado", true);
                              cargar();
                            }}
                            bgClass={cn(
                              config.bgClass,
                              "border-r border-gray-100"
                            ) as string}
                          />
                        ))}

                        {/* Row total */}
                        <td
                          className={cn(
                            "px-2 py-0.5 text-right font-bold tabular-nums bg-gray-50 border-l",
                            getSubRowTotal(socio, tipo) === 0
                              ? "text-gray-400"
                              : "text-gray-800"
                          )}
                        >
                          {fmt(getSubRowTotal(socio, tipo))}
                        </td>
                      </tr>
                    );
                  });
                })}

                {/* ── TOTALES footer row ────────────────────── */}
                {(["aporte", "ahorro", "multa"] as SubRowType[]).map(
                  (tipo) => {
                    const config = SUB_ROW_CONFIG[tipo];
                    const grand = getGrandTotal(tipo);
                    if (tipo === "multa" && grand === 0) return null;

                    return (
                      <tr
                        key={`total-${tipo}`}
                        className="border-t-2 border-gray-300 font-bold"
                      >
                        <td
                          className={cn(
                            "sticky left-0 z-10 bg-gray-100 px-3 py-2 border-r text-xs",
                            config.bgHeaderClass
                          )}
                        >
                          TOTAL {config.label.toUpperCase()}
                        </td>
                        {semanaKeys.map((sem) => {
                          const colTotal = getColumnTotal(sem, tipo);
                          return (
                            <td
                              key={`total-${tipo}-${sem}`}
                              className={cn(
                                "px-1.5 py-2 text-right tabular-nums text-xs border-r border-gray-100",
                                config.bgClass,
                                colTotal === 0
                                  ? "text-gray-400"
                                  : "text-gray-800"
                              )}
                            >
                              {fmt(colTotal)}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right tabular-nums text-xs bg-gray-200 font-extrabold text-gray-900">
                          {fmt(grand)}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-400">
          Cargando datos...
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.socios.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          No hay socios registrados en esta ronda
        </div>
      )}

      {/* Summary cards */}
      {data && data.socios.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Resumen por socio
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.socios.map((socio) => (
              <div
                key={socio.socioId}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="mb-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {socio.nombres} {socio.apellidos}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">
                    {socio.numeroCuenta}
                  </p>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total aportes</span>
                    <span className="font-semibold tabular-nums">
                      {fmt(socio.totales.aportes)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-700">Total ahorros</span>
                    <span className="font-semibold tabular-nums">
                      {fmt(socio.totales.ahorros)}
                    </span>
                  </div>
                  {socio.totales.multas > 0 && (
                    <div className="flex justify-between">
                      <span className="text-orange-700">Total multas</span>
                      <span className="font-semibold tabular-nums">
                        {fmt(socio.totales.multas)}
                      </span>
                    </div>
                  )}

                  {/* Active loans */}
                  {socio.prestamos.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                        Prestamos
                      </p>
                      {socio.prestamos.map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between text-[11px]"
                        >
                          <span
                            className={cn(
                              p.estado === "activo"
                                ? "text-purple-700"
                                : "text-gray-400"
                            )}
                          >
                            {fmt(p.monto)}{" "}
                            <span className="text-[9px]">({p.estado})</span>
                          </span>
                          <span className="font-mono tabular-nums">
                            Saldo: {fmt(p.saldoActual)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Investment */}
                  {socio.inversion && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                        Inversion
                      </p>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-indigo-700">
                          {fmt(socio.inversion.montoInvertido)} ({socio.inversion.porcentaje}%)
                        </span>
                        <span className="font-mono tabular-nums">
                          Intereses: {fmt(socio.inversion.intereses)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
