// app/socios/retiros/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Socio = {
  id: number;
  numeroCuenta: string;
  nombres: string;
  apellidos: string;
  saldoAhorros: number;
};

type Movimiento = {
  id: number;
  tipo: string;
  monto: number;
  nota: string | null;
  createdAt: string;
  ronda?: { nombre: string } | null;
};

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
};

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function RetirosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const socioIdParam = searchParams.get("socioId");

  const [socios, setSocios] = useState<Socio[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(socioIdParam ? Number(socioIdParam) : null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [loadingMov, setLoadingMov] = useState(false);

  // Form
  const [monto, setMonto] = useState<number>(0);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [q, setQ] = useState("");

  // Cargar socios
  useEffect(() => {
    fetch("/api/socios")
      .then(r => r.json())
      .then(data => setSocios(Array.isArray(data) ? data : []))
      .catch(() => setSocios([]))
      .finally(() => setLoadingSocios(false));
  }, []);

  // Cargar movimientos del socio seleccionado
  useEffect(() => {
    if (!selectedId) { setMovimientos([]); return; }
    setLoadingMov(true);
    fetch(`/api/socios/${selectedId}/movimientos?tipo=RETIRO`)
      .then(r => r.ok ? r.json() : { movimientos: [] })
      .then(d => setMovimientos(Array.isArray(d?.movimientos) ? d.movimientos : []))
      .catch(() => setMovimientos([]))
      .finally(() => setLoadingMov(false));
  }, [selectedId, success]); // recarga tras un retiro exitoso

  const socioSeleccionado = useMemo(
    () => socios.find(s => s.id === selectedId) ?? null,
    [socios, selectedId]
  );

  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return socios;
    return socios.filter(x =>
      [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s))
    );
  }, [socios, q]);

  function selectSocio(id: number) {
    setSelectedId(id);
    setMonto(0);
    setNota("");
    setError(null);
    setSuccess(null);
    router.replace(`/socios/retiros?socioId=${id}`, { scroll: false });
  }

  const excedeMaximo = monto > (socioSeleccionado?.saldoAhorros ?? 0);
  const formInvalid = saving || !selectedId || monto <= 0 || excedeMaximo || !nota.trim();

  async function registrarRetiro() {
    try {
      setError(null);
      setSuccess(null);
      if (!selectedId) throw new Error("Selecciona un socio");
      if (monto <= 0) throw new Error("El monto debe ser mayor a 0");
      if (!nota.trim()) throw new Error("Ingresa una nota o motivo del retiro");
      if (excedeMaximo) throw new Error(`Saldo insuficiente. Disponible: ${fmtMoney(socioSeleccionado?.saldoAhorros)}`);

      setSaving(true);
      const res = await fetch(`/api/socios/${selectedId}/retiro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto, nota }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo registrar el retiro");

      // Actualizar saldo localmente
      setSocios(prev => prev.map(s =>
        s.id === selectedId ? { ...s, saldoAhorros: data.nuevoSaldo ?? s.saldoAhorros - monto } : s
      ));
      setMonto(0);
      setNota("");
      setSuccess(`Retiro de ${fmtMoney(monto)} registrado correctamente.`);
    } catch (e: any) {
      setError(e?.message ?? "Error al registrar retiro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v16.19l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.47 3.47V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/>
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Retiro de ahorros</h1>
              <p className="text-sm text-gray-500">Registra retiros de la cuenta de ahorros libre del socio.</p>
            </div>
          </div>
          <Link href="/socios/detalle" className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            ← Volver al detalle
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Selector de socio ── */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Seleccionar socio</h2>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nombre o cuenta…"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 mb-2"
          />
          {loadingSocios ? (
            <div className="space-y-2 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <ul className="divide-y rounded-lg border max-h-[50vh] overflow-y-auto">
              {sociosFiltrados.map(s => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => selectSocio(s.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-3 text-left hover:bg-gray-50 transition-colors",
                      s.id === selectedId && "bg-rose-50 border-l-2 border-rose-500"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {s.apellidos}, {s.nombres}
                      </p>
                      <p className="truncate text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-sm font-bold tabular-nums",
                        s.saldoAhorros > 0 ? "text-emerald-700" : "text-gray-400"
                      )}>
                        {fmtMoney(s.saldoAhorros)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Formulario de retiro ── */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Registrar retiro</h2>

          {!socioSeleccionado ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 mb-3 text-gray-200">
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/>
              </svg>
              <p className="text-sm">Selecciona un socio primero</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Saldo disponible */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-4">
                <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">
                  {socioSeleccionado.nombres} {socioSeleccionado.apellidos}
                </p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{socioSeleccionado.numeroCuenta}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-emerald-700 tabular-nums">
                    {fmtMoney(socioSeleccionado.saldoAhorros)}
                  </p>
                  <p className="text-sm text-emerald-600">disponible</p>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  ✅ {success}
                </div>
              )}

              {/* Monto */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Monto a retirar
                </label>
                <input
                  type="number" min={0.01} step="0.01"
                  value={monto || ""}
                  onChange={e => setMonto(Number(e.target.value))}
                  placeholder="0.00"
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1",
                    excedeMaximo
                      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                      : "focus:border-rose-400 focus:ring-rose-200"
                  )}
                />
                {excedeMaximo && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    ⚠️ Excede el saldo disponible ({fmtMoney(socioSeleccionado.saldoAhorros)})
                  </p>
                )}
                {/* Atajos */}
                <div className="mt-2 flex gap-2">
                  {[25, 50, 75, 100].map(pct => {
                    const val = Math.round((socioSeleccionado.saldoAhorros * pct / 100) * 100) / 100;
                    return (
                      <button key={pct} type="button"
                        onClick={() => setMonto(val)}
                        className="rounded-md border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                        {pct}%
                      </button>
                    );
                  })}
                  <button type="button"
                    onClick={() => setMonto(socioSeleccionado.saldoAhorros)}
                    className="rounded-md border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                    Todo
                  </button>
                </div>
              </div>

              {/* Nota */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nota / motivo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  rows={3}
                  placeholder="Ej: Retiro para gastos personales…"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 resize-none"
                />
                <p className="mt-1 text-xs text-gray-400">Requerida para tener trazabilidad del retiro.</p>
              </div>

              {/* Resumen */}
              {monto > 0 && !excedeMaximo && (
                <div className="rounded-lg bg-gray-50 border p-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Saldo actual</span>
                    <span className="tabular-nums">{fmtMoney(socioSeleccionado.saldoAhorros)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 mt-1">
                    <span>Retiro</span>
                    <span className="tabular-nums">− {fmtMoney(monto)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-900 mt-2 pt-2 border-t">
                    <span>Saldo restante</span>
                    <span className="tabular-nums text-emerald-700">
                      {fmtMoney(socioSeleccionado.saldoAhorros - monto)}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={registrarRetiro}
                disabled={formInvalid}
                className={cn(
                  "w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white",
                  formInvalid ? "bg-rose-300 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                {saving ? "Registrando…" : `Confirmar retiro${monto > 0 ? ` de ${fmtMoney(monto)}` : ""}`}
              </button>
            </div>
          )}
        </section>

        {/* ── Historial de retiros ── */}
        <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-gray-50 px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Historial de retiros</p>
            {socioSeleccionado && (
              <span className="text-xs text-gray-400">{socioSeleccionado.nombres.split(" ")[0]}</span>
            )}
          </div>

          {!selectedId ? (
            <p className="p-6 text-center text-sm text-gray-400">Selecciona un socio para ver su historial.</p>
          ) : loadingMov ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : movimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 mb-2 text-gray-200">
                <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v16.19l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.47 3.47V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm">Sin retiros registrados</p>
            </div>
          ) : (
            <ul className="divide-y max-h-[60vh] overflow-y-auto">
              {movimientos.map(m => (
                <li key={m.id} className="px-5 py-4 hover:bg-gray-50/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                        ↓
                      </span>
                      <div className="min-w-0">
                        {m.nota && (
                          <p className="text-sm text-gray-700 truncate">{m.nota}</p>
                        )}
                        <p className="text-xs text-gray-400">{fmtDateTime(m.createdAt)}</p>
                      </div>
                    </div>
                    <p className="tabular-nums font-semibold text-rose-700 shrink-0">
                      − {fmtMoney(m.monto)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
