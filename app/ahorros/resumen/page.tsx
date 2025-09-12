"use client";
import { useEffect, useMemo, useState } from "react";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };
type HistorialResp = { items: { monto: number | string }[]; saldo?: number | string };
type RondaDTO = { id: number; nombre: string; activa?: boolean };

const fmtMoney = (n: number, currency = "USD", locale = "es-EC") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n || 0));

export default function RetirosAhorroPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [saldo, setSaldo] = useState<number>(0);
  const [montoRetiro, setMontoRetiro] = useState<number | "">("");

  const [hayRondaActiva, setHayRondaActiva] = useState<boolean>(false);
  const [checkingRonda, setCheckingRonda] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Cargar socios
  useEffect(() => {
    (async () => {
      try {
        setLoadingSocios(true);
        const r = await fetch("/api/socios");
        const list = await r.json();
        setSocios(Array.isArray(list) ? list : []);
      } catch {
        setSocios([]);
      } finally {
        setLoadingSocios(false);
      }
    })();
  }, []);

  // Chequear si hay ronda activa usando el mismo contrato que tu app:
  // GET /api/rondas -> 204 si no hay activa; 200 si hay (devuelve la ronda)
  useEffect(() => {
    (async () => {
      try {
        setCheckingRonda(true);
        const r = await fetch("/api/rondas", { cache: "no-store" });
        setHayRondaActiva(r.status !== 204);
      } catch {
        // En caso de error, por seguridad, asumimos que SÍ hay activa
        setHayRondaActiva(true);
      } finally {
        setCheckingRonda(false);
      }
    })();
  }, []);

  // Cargar saldo del socio seleccionado
  useEffect(() => {
    if (!selectedId) {
      setSaldo(0);
      return;
    }
    (async () => {
      try {
        setError(null);
        const r = await fetch(`/api/ahorros?socioId=${selectedId}`, { cache: "no-store" });
        const data: HistorialResp | any[] = await r.json();

        const items = Array.isArray(data) ? data : data.items ?? [];
        const s = !Array.isArray(data) && data.saldo != null
          ? Number(data.saldo)
          : items.reduce((acc: number, it: any) => acc + Number(it.monto || 0), 0);

        setSaldo(s);
      } catch (e: any) {
        setError(e?.message || "No se pudo obtener el saldo del socio");
        setSaldo(0);
      }
    })();
  }, [selectedId]);

  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return socios;
    return socios.filter((x) =>
      [x.nombres, x.apellidos, x.numeroCuenta].some((v) => String(v).toLowerCase().includes(s))
    );
  }, [socios, q]);

  const puedeRetirar =
    !checkingRonda &&
    !hayRondaActiva &&
    !!selectedId &&
    montoRetiro !== "" &&
    Number(montoRetiro) > 0 &&
    Number(montoRetiro) <= Number(saldo);

  async function hacerRetiro() {
    if (!puedeRetirar || !selectedId) return;
    try {
      setLoading(true);
      setError(null);
      setOk(null);

      const r = await fetch("/api/ahorros/retiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId: selectedId, monto: Number(montoRetiro) }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "No se pudo realizar el retiro");

      setOk("Retiro registrado correctamente.");
      setMontoRetiro("");
      // refrescar saldo
      const r2 = await fetch(`/api/ahorros?socioId=${selectedId}`, { cache: "no-store" });
      const d2: HistorialResp | any[] = await r2.json();
      const items = Array.isArray(d2) ? d2 : d2.items ?? [];
      const s = !Array.isArray(d2) && d2.saldo != null
        ? Number(d2.saldo)
        : items.reduce((acc: number, it: any) => acc + Number(it.monto || 0), 0);
      setSaldo(s);
    } catch (e: any) {
      setError(e?.message || "Error al registrar el retiro");
    } finally {
      setLoading(false);
      setTimeout(() => setOk(null), 3000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header cajoncito */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Retiro de ahorros</h1>
            <p className="text-sm text-gray-600">Selecciona el socio y registra un retiro (solo si no hay ronda activa).</p>
          </div>
        </div>
      </div>

      {checkingRonda ? (
        <div className="rounded-lg border bg-white p-6 shadow-sm text-gray-600">Verificando rondas activas…</div>
      ) : hayRondaActiva ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Hay una ronda activa. No se pueden realizar retiros hasta que finalice.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Socios */}
        <aside className="rounded-xl border bg-white p-6 shadow-sm md:col-span-1">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Socios</h2>
          </div>
          <div className="mb-3">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Buscar por nombre o cuenta…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {loadingSocios ? (
            <p className="text-gray-500">Cargando socios…</p>
          ) : sociosFiltrados.length === 0 ? (
            <p className="text-gray-500">Sin resultados.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {sociosFiltrados.map((s) => {
                const active = selectedId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={cx(
                        "w-full text-left p-3 hover:bg-gray-50 flex items-start justify-between gap-3",
                        active && "bg-gray-50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {s.nombres} {s.apellidos}
                        </p>
                        <p className="truncate text-xs text-gray-500">Cuenta {s.numeroCuenta}</p>
                      </div>
                      {active && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Seleccionado
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Formulario retiro */}
        <main className="rounded-xl border bg-white p-6 shadow-sm md:col-span-2 space-y-4">
          {!selectedId ? (
            <div className="text-gray-600">Selecciona un socio para continuar.</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500">Saldo disponible</p>
                  <p className="mt-1 text-xl font-semibold">{fmtMoney(saldo)}</p>
                </div>
              </div>

              {error && <div className="rounded-md bg-red-50 p-3 text-red-700">{error}</div>}
              {ok && <div className="rounded-md bg-green-50 p-3 text-green-700">{ok}</div>}

              <div className="grid max-w-sm gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Monto a retirar</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={montoRetiro}
                    onChange={(e) => setMontoRetiro(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={hayRondaActiva}
                  />
                  <p className="mt-1 text-xs text-gray-500">No puede exceder el saldo disponible.</p>
                </div>

                <button
                  onClick={hacerRetiro}
                  disabled={!puedeRetirar || loading}
                  className={cx(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white",
                    !puedeRetirar || loading ? "bg-blue-400 opacity-70" : "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                        <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" />
                      </svg>
                      Procesando…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Z" />
                      </svg>
                      Registrar retiro
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// helpers
function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
