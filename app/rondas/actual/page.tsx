// app/rondas/actual/page.tsx
"use client";
import { useEffect, useState, useMemo } from "react";

type Item = {
  socioId: number;
  socio: { nombres: string; apellidos: string; numeroCuenta: string };
  orden: number;
  pagado: boolean;
  monto: string | null;
  multa: string; // string para inputs controlados
  ahorroAcumulado: string; // 👈 nuevo
  ahorroRestante: string;
};

type RondaDTO = {
  id: number;
  nombre: string;
  semanaActual: number;
  montoAporte: string;
  // 👇 lo usamos en el render; haz que tu API lo devuelva
  ahorroObjetivoPorSocio?: string;
};

type EstadoSemana = {
  ronda: RondaDTO;
  semana: number;
  totalParticipantes: number;
  items: Item[];
};

export default function RondaActualPage() {
  const [estado, setEstado] = useState<EstadoSemana | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null); // socioId en guardado
  const [cerrando, setCerrando] = useState(false);
  const [pendientes, setPendientes] = useState<
    { socioId: number; socio: Item["socio"]; montoAporte: string; multa: string; totalAdeudado: string }[]
  >([]);

  // estados controlados para inputs
  const [ahorroInputs, setAhorroInputs] = useState<Record<number, number>>({});
  const [multasInputs, setMultasInputs] = useState<Record<number, number>>({});

  function setAhorroInput(socioId: number, v: number) {
    setAhorroInputs((prev) => ({ ...prev, [socioId]: v }));
  }
  function setMultaInput(socioId: number, v: number) {
    setMultasInputs((prev) => ({ ...prev, [socioId]: v }));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function registrarAhorroParcial(socioId: number, monto: number) {
    if (!estado) return;
    try {
      // valida monto > 0 y no mayor a restante
      const it = estado.items.find((x) => x.socioId === socioId);
      const objetivo = Number(estado.ronda.ahorroObjetivoPorSocio ?? 0);
      const acum = Number(it?.ahorroAcumulado ?? 0);
      const restante = Math.max(objetivo - acum, 0);
      if (monto <= 0) throw new Error("El monto de ahorro debe ser mayor a 0");
      if (monto > restante) throw new Error(`No puedes ahorrar más de ${restante.toFixed(2)} esta ronda`);

      setSaving(socioId);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/ahorros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId, semana: estado.semana, monto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo registrar el ahorro");
      await cargar(); // refresca acumulado/restante y bandera de bloqueo
    } catch (e: any) {
      setError(e.message || "Error al registrar ahorro");
    } finally {
      setSaving(null);
    }
  }

  async function registrarAporteIndividual(socioId: number) {
    if (!estado) return;
    try {
      setSaving(socioId);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId,
          semana: estado.semana,
          monto: Number(estado.ronda.montoAporte),
          multa: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo registrar el aporte");
      await cargar();
    } catch (e: any) {
      setError(e.message || "Error al registrar aporte");
    } finally {
      setSaving(null);
    }
  }

  async function registrarAporteTodos() {
    if (!estado) return;
    try {
      setCerrando(true);
      const promesas = estado.items.map((it) =>
        fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            socioId: it.socioId,
            semana: estado.semana,
            monto: Number(estado.ronda.montoAporte),
            multa: 0,
          }),
        })
      );

      const resultados = await Promise.all(promesas);
      for (const r of resultados) {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.error || "Error al registrar aportes masivos");
        }
      }
      await cargar();
    } catch (e: any) {
      setError(e.message || "Error al registrar aportes masivos");
    } finally {
      setCerrando(false);
    }
  }

  async function cobrarPendiente(socioId: number) {
    if (!estado) return;
    try {
      setSaving(socioId);
      const multa = Number(multasInputs[socioId] ?? 0);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId,
          semana: estado.semana,
          monto: Number(estado.ronda.montoAporte),
          multa, // editable
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo registrar el cobro");
      await cargar();
    } catch (e: any) {
      setError(e.message || "Error al cobrar pendiente");
    } finally {
      setSaving(null);
    }
  }

  async function registrarAporteRapido(socioId: number) {
    if (!estado) return;
    try {
      setSaving(socioId);
      await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId,
          semana: estado.semana,
          monto: Number(estado.ronda.montoAporte),
          multa: 0,
        }),
      }).then(async (r) => {
        const ct = r.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await r.json() : null;
        if (!r.ok) throw new Error(data?.error || "No se pudo registrar el aporte");
      });
      await cargar();
    } catch (e: any) {
      setError(e.message || "Error al registrar aporte");
    } finally {
      setSaving(null);
    }
  }

  async function cargar() {
    try {
      setError(null);
      const r = await fetch("/api/rondas", { cache: "no-store" });
      if (r.status === 204) {
        setEstado(null);
        return;
      }
      const ronda = (await r.json()) as RondaDTO;

      const e = await fetch(`/api/rondas/${ronda.id}/semana/${ronda.semanaActual}/aportes`, { cache: "no-store" });
      const data = (await e.json()) as EstadoSemana;
      setEstado(data);
      setPendientes([]);
    } catch (e: any) {
      setError(e.message || "Error al cargar");
      setEstado(null);
    }
  }

  async function guardarAporte(socioId: number, pagado: boolean, multa: string) {
    if (!estado) return;
    try {
      setSaving(socioId);
      const monto = pagado ? estado.ronda.montoAporte : "0";
      const multaNum = Number(multa || "0");

      const res = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId,
          semana: estado.semana,
          monto: Number(monto),
          multa: multaNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar");

      await cargar();
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    } finally {
      setSaving(null);
    }
  }

  async function cerrarSemana() {
    if (!estado) return;
    try {
      setCerrando(true);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/cerrar-semana`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cerrar la semana");

      if (data.avanzada) {
        if (data.finalizada) {
          window.location.href = `/rondas/${estado.ronda.id}/resultados`;
        } else {
          await cargar();
        }
      } else {
        setPendientes(data.pendientes || []);
      }
    } catch (e: any) {
      setError(e.message || "Error al cerrar semana");
    } finally {
      setCerrando(false);
    }
  }

  // 👇 EARLY RETURN: nada que toque `estado` antes de esto
  if (!estado) {
    return <div className="p-6">{error ?? "Cargando ronda..."}</div>;
  }

  // 👇 A partir de aquí, `estado` NO es null: ya podemos calcular cobrador actual y siguiente
  const itemsOrdenados = [...estado.items].sort((a, b) => a.orden - b.orden);
  const idx =
    itemsOrdenados.length > 0
      ? ((estado.semana - 1) % itemsOrdenados.length + itemsOrdenados.length) % itemsOrdenados.length
      : 0;
  const actual = itemsOrdenados[idx];
  const siguiente = itemsOrdenados.length ? itemsOrdenados[(idx + 1) % itemsOrdenados.length] : undefined;

  return (
    <div className="space-y-6">
      <header className="rounded-xl border bg-white/60 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          {/* Título + meta */}
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
              Ronda: <span className="text-blue-700">{estado.ronda.nombre}</span>
              <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                Semana {estado.semana}/{estado.totalParticipantes}
              </span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 ring-1 ring-gray-200">
                {/* $ icono */}
                <svg className="h-4 w-4 opacity-70" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 3a1 1 0 1 1 2 0v1.06c1.9.3 3.5 1.34 3.5 3.19 0 1.97-1.72 2.88-3.86 3.43l-.64.16c-1.68.42-2.5.84-2.5 1.69 0 .86.83 1.42 2.2 1.42 1.16 0 2.24-.34 3.02-.98a1 1 0 0 1 1.34 1.48A5.62 5.62 0 0 1 13 16.95V18a1 1 0 1 1-2 0v-1.03c-2.03-.27-3.5-1.38-3.5-3.13 0-2.07 1.86-2.9 3.77-3.38l.63-.16c1.72-.43 2.6-.87 2.6-1.81 0-.84-.77-1.36-2.01-1.44-1.1-.07-2.15.28-2.9.87A1 1 0 1 1 7.7 6.5a5.47 5.47 0 0 1 3.3-1.4V3Z"/>
                </svg>
                Monto por socio: <strong className="tabular-nums">${new Intl.NumberFormat("es-EC", {maximumFractionDigits:2}).format(estado.ronda.montoAporte)}</strong>
              </span>

              <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 ring-1 ring-gray-200">
                {/* personas */}
                <svg className="h-4 w-4 opacity-70" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-2.67 0-8 1.34-8 4v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.66-5.33-4-8-4ZM8 14c-.82 0-1.61.1-2.36.28C3.69 14.78 2 16.02 2 18v1a1 1 0 0 0 1 1h6v-1c0-1.38.73-2.6 1.9-3.57A12.5 12.5 0 0 0 8 14Z"/>
                </svg>
                Participantes: <strong>{estado.totalParticipantes}</strong>
              </span>
            </div>
          </div>

          {/* Progreso */}
          <div className="w-full sm:w-64">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>Progreso</span>
              <span className="tabular-nums">
                {Math.min(estado.semana, estado.totalParticipantes)}/{estado.totalParticipantes}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-gray-200">
              <div
                className="h-full bg-blue-600 transition-[width] duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, ((estado.semana - 1) / Math.max(1, estado.totalParticipantes)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Actual y siguiente */}
        {itemsOrdenados.length > 0 && actual && siguiente && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">Cobra esta semana</p>
              <p className="mt-1 text-sm text-emerald-900">
                <span className="font-semibold">{actual.socio.nombres} {actual.socio.apellidos}</span>
                <span className="mx-1 text-emerald-700/60">•</span>
                orden <span className="font-semibold tabular-nums">{actual.orden}</span>
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">Siguiente</p>
              <p className="mt-1 text-sm text-amber-900">
                <span className="font-semibold">{siguiente.socio.nombres} {siguiente.socio.apellidos}</span>
                <span className="mx-1 text-amber-700/60">•</span>
                orden <span className="font-semibold tabular-nums">{siguiente.orden}</span>
              </p>
            </div>
          </div>
        )}
      </header>


      {error && <div className="rounded-md bg-red-50 p-3 text-red-700">{error}</div>}

      <div className="flex justify-end mb-4">
        <button
          onClick={registrarAporteTodos}
          disabled={cerrando}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {cerrando ? "Registrando…" : "Registrar aporte a todos"}
        </button>
      </div>

      <div className="rounded-xl bg-white shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left">Orden</th>
              <th className="px-4 py-2 text-left">Socio</th>
              <th className="px-4 py-2 text-left">Cuenta</th>
              <th className="px-4 py-2 text-left">Ahorro acumulado</th>
              <th className="px-4 py-2 text-left">Restante objetivo</th>
              <th className="px-4 py-2 text-right">Ahorro (semana)</th>
              <th className="px-4 py-2 text-right">Acción</th>
            </tr>
          </thead>

          <tbody>
            {estado.items.map((it) => {
              const objetivo = Number(estado.ronda.ahorroObjetivoPorSocio ?? 0);
              const acum = Number(it.ahorroAcumulado ?? 0);
              const restanteCalc = Math.max(objetivo - acum, 0);
              const ahorroYaRegistrado = (it as any).ahorroRegistradoSemana === true;

              const valorInput = ahorroInputs[it.socioId] ?? "";
              const disabledAhorro = ahorroYaRegistrado || restanteCalc <= 0 || saving === it.socioId;

              return (
                <tr key={it.socioId} className="border-t">
                  <td className="px-4 py-2">{it.orden}</td>
                  <td className="px-4 py-2">
                    {it.socio.nombres} {it.socio.apellidos}
                  </td>
                  <td className="px-4 py-2">{it.socio.numeroCuenta}</td>

                  <td className="px-4 py-2">${it.ahorroAcumulado}</td>
                  <td className="px-4 py-2">${(Number(it.ahorroRestante ?? restanteCalc)).toFixed(2)}</td>

                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-28 rounded border px-2 py-1 text-right disabled:bg-gray-100"
                      disabled={disabledAhorro}
                      value={valorInput}
                      onChange={(e) => setAhorroInput(it.socioId, Number(e.target.value || 0))}
                      placeholder="0.00"
                    />
                  </td>

                  <td className="px-4 py-2 text-right">
                    {it.pagado ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 mr-2">
                        Pagado
                      </span>
                    ) : (
                      <button
                        disabled={saving === it.socioId}
                        onClick={() => registrarAporteIndividual(it.socioId)}
                        className="rounded bg-brand-500 px-3 py-1.5 text-white hover:bg-brand-600 disabled:opacity-50 mr-2"
                      >
                        {saving === it.socioId ? "..." : "Registrar aporte"}
                      </button>
                    )}

                    <button
                      disabled={disabledAhorro || !(Number(valorInput) > 0) || Number(valorInput) > restanteCalc}
                      onClick={() => registrarAhorroParcial(it.socioId, Number(valorInput))}
                      className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                      title={
                        ahorroYaRegistrado
                          ? "Ya registraste un ahorro esta semana"
                          : restanteCalc <= 0
                          ? "Objetivo de ahorro cumplido"
                          : undefined
                      }
                    >
                      Guardar ahorro
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={cerrarSemana}
          disabled={cerrando}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {cerrando ? "Cerrando…" : "Cerrar semana"}
        </button>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div className="rounded-xl bg-white shadow p-4">
          <h3 className="text-lg font-medium mb-3">Pendientes de pago</h3>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Socio</th>
                <th className="px-4 py-2">Aporte</th>
                <th className="px-4 py-2">Multa</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((p) => {
                const multa = multasInputs[p.socioId] ?? Number(p.multa ?? 0);
                const total = (Number(p.montoAporte) + Number(multa)).toFixed(2);
                return (
                  <tr key={p.socioId} className="border-t">
                    <td className="px-4 py-2">
                      {p.socio.nombres} {p.socio.apellidos} ({p.socio.numeroCuenta})
                    </td>
                    <td className="px-4 py-2 text-center">${p.montoAporte}</td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-24 rounded border px-2 py-1 text-right"
                        value={multa}
                        onChange={(e) => setMultaInput(p.socioId, Number(e.target.value || 0))}
                      />
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">${total}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        disabled={saving === p.socioId}
                        onClick={() => cobrarPendiente(p.socioId)}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {saving === p.socioId ? "..." : "Cobrar y registrar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-gray-500">
            * Estos socios no han aportado en la semana {estado.semana}. Registra el aporte + multa para cerrarla.
          </p>
        </div>
      )}
    </div>
  );
}
