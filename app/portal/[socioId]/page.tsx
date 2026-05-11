// app/portal/[socioId]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Resumen = {
  socio: { id: number; nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number };
  ronda: {
    id: number; nombre: string; semanaActual: number;
    totalParticipantes: number; semanaToca: number | null;
    estaEnRonda: boolean; fechaInicio: string;
  } | null;
};

type Prestamo = {
  id: number; monto: number; tasaAnual: number; estado: string;
  saldoActual: number; ronda: { nombre: string };
  cuotas: { id: number; numero: number; fechaVenc: string; cuota: number; pagada: boolean; fechaPago: string | null }[];
};

type Movimiento = {
  id: number; tipo: string; monto: number; nota: string | null;
  createdAt: string; ronda?: { nombre: string } | null;
};

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const fmtDT = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
};

const tipoColor: Record<string, string> = {
  INVERSION: "text-blue-700",
  RETIRO: "text-rose-700",
  DEVOLUCION: "text-emerald-700",
  INTERES: "text-amber-700",
  AHORRO: "text-emerald-700",
};

const tipoSigno: Record<string, string> = {
  INVERSION: "−",
  RETIRO: "−",
  DEVOLUCION: "+",
  INTERES: "+",
  AHORRO: "+",
};

const tipoLabel: Record<string, string> = {
  INVERSION: "Inversión",
  RETIRO: "Retiro",
  DEVOLUCION: "Devolución",
  INTERES: "Interés",
  AHORRO: "Ahorro",
};

export default function PortalSocioPage() {
  const params = useParams();
  const socioId = params.socioId as string;

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [r1, r2, r3] = await Promise.allSettled([
        fetch(`/api/portal/${socioId}/resumen`).then(r => r.ok ? r.json() : null),
        fetch(`/api/portal/${socioId}/prestamos`).then(r => r.ok ? r.json() : null),
        fetch(`/api/portal/${socioId}/movimientos`).then(r => r.ok ? r.json() : null),
      ]);
      if (r1.status === "fulfilled" && r1.value) setResumen(r1.value);
      if (r2.status === "fulfilled" && r2.value) setPrestamos(r2.value.prestamos ?? []);
      if (r3.status === "fulfilled" && r3.value) setMovimientos(r3.value.movimientos ?? []);
      setLoading(false);
    }
    load();
  }, [socioId]);

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  );

  const { socio, ronda } = resumen ?? {};
  const prestamosActivos = prestamos.filter(p => p.estado === "ACTIVO");
  const cuotasPendientes = prestamosActivos.flatMap(p => p.cuotas.filter(c => !c.pagada)).sort((a, b) => new Date(a.fechaVenc).getTime() - new Date(b.fechaVenc).getTime());
  const totalIntereses = movimientos.filter(m => m.tipo === "INTERES").reduce((a, m) => a + m.monto, 0);

  const semanasToca = ronda?.semanaToca ?? null;
  const semanaActual = ronda?.semanaActual ?? 0;
  const semanasRestantes = semanasToca != null ? semanasToca - semanaActual : null;

  return (
    <div className="space-y-4">
      {/* Bienvenida */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
            {socio?.nombres?.[0]}{socio?.apellidos?.[0]}
          </span>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Hola, {socio?.nombres?.split(" ")[0]} 👋
            </h1>
            <p className="text-xs text-gray-400 font-mono">{socio?.numeroCuenta}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Saldo ahorros</p>
          <p className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">{fmt(socio?.saldoAhorros)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Intereses ganados</p>
          <p className="mt-1 text-xl font-bold text-amber-700 tabular-nums">{fmt(totalIntereses)}</p>
        </div>
      </div>

      {/* Ronda activa */}
      {ronda ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Ronda activa</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {ronda.nombre}
            </span>
          </div>

          {/* Progreso */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Semana actual</span>
              <span className="tabular-nums font-medium text-gray-700">{semanaActual} / {ronda.totalParticipantes}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${(semanaActual / ronda.totalParticipantes) * 100}%` }} />
            </div>
          </div>

          {ronda.estaEnRonda ? (
            semanasToca != null ? (
              <div className={`rounded-lg p-3 text-sm ${semanasRestantes === 0 ? "bg-amber-50 border border-amber-200" : semanasRestantes !== null && semanasRestantes < 0 ? "bg-gray-50 border" : "bg-blue-50 border border-blue-100"}`}>
                {semanasRestantes === 0 ? (
                  <p className="font-semibold text-amber-800">🎉 ¡Esta semana te toca cobrar! (Semana #{semanasToca})</p>
                ) : semanasRestantes !== null && semanasRestantes < 0 ? (
                  <p className="text-gray-600">Ya cobró en la semana #{semanasToca}</p>
                ) : (
                  <>
                    <p className="text-blue-700 font-medium">Tu turno: semana #{semanasToca}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Faltan {semanasRestantes} semana{semanasRestantes !== 1 ? "s" : ""}</p>
                  </>
                )}
              </div>
            ) : null
          ) : (
            <p className="text-xs text-gray-400">No estás participando en esta ronda</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-gray-50 p-4 text-center text-sm text-gray-400">
          No hay una ronda activa actualmente
        </div>
      )}

      {/* Cuotas pendientes */}
      {cuotasPendientes.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Cuotas pendientes</p>
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">{cuotasPendientes.length}</span>
          </div>
          <ul className="divide-y">
            {cuotasPendientes.slice(0, 5).map(c => {
              const vencida = new Date(c.fechaVenc) < new Date();
              const prestamo = prestamosActivos.find(p => p.cuotas.some(x => x.id === c.id));
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Cuota #{c.numero}</p>
                    <p className="text-xs text-gray-400">{prestamo?.ronda.nombre} · Vence {fmtDate(c.fechaVenc)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-700 tabular-nums">{fmt(c.cuota)}</p>
                    {vencida && <span className="text-xs text-rose-600 font-medium">Vencida</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          {cuotasPendientes.length > 5 && (
            <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-400">
              +{cuotasPendientes.length - 5} cuotas más
            </div>
          )}
        </div>
      )}

      {/* Préstamos activos */}
      {prestamosActivos.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">Mis préstamos activos</p>
          </div>
          <ul className="divide-y">
            {prestamosActivos.map(p => {
              const pagadas = p.cuotas.filter(c => c.pagada).length;
              const total = p.cuotas.length;
              const pct = total > 0 ? (pagadas / total) * 100 : 0;
              return (
                <li key={p.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.ronda.nombre}</p>
                      <p className="text-xs text-gray-400">Interés mensual: {p.tasaAnual}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt(p.monto)}</p>
                      <p className="text-xs text-gray-400">Saldo: {fmt(p.saldoActual)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progreso de pago</span>
                      <span className="tabular-nums">{pagadas}/{total} cuotas</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Movimientos recientes */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-800">Mis movimientos recientes</p>
        </div>
        {movimientos.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Sin movimientos registrados</p>
        ) : (
          <ul className="divide-y max-h-72 overflow-y-auto">
            {movimientos.slice(0, 20).map(m => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    tipoSigno[m.tipo] === "+" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}>
                    {tipoSigno[m.tipo]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{tipoLabel[m.tipo] ?? m.tipo}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {m.ronda?.nombre && <>{m.ronda.nombre} · </>}{fmtDT(m.createdAt)}
                    </p>
                    {m.nota && <p className="text-xs text-gray-400 truncate">{m.nota}</p>}
                  </div>
                </div>
                <p className={`text-sm font-semibold tabular-nums shrink-0 ${tipoColor[m.tipo] ?? "text-gray-700"}`}>
                  {tipoSigno[m.tipo]}{fmt(m.monto)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
