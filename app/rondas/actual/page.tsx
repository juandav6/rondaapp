// app/rondas/actual/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmtMoney = (n: number, currency = "USD", locale = "es-EC") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n) || 0);

type Item = {
  socioId: number;
  socio: { nombres: string; apellidos: string; numeroCuenta: string };
  orden: number;
  pagado: boolean;
  monto: string | null;
  multa: string;
  ahorroAcumulado: string;
  ahorroRestante: string;
  ahorroSemana?: string;
};

type RondaDTO = {
  id: number;
  nombre: string;
  semanaActual: number;
  montoAporte: string;
  ahorroObjetivoPorSocio?: string;
  responsableId?: number | null;
};

type EstadoSemana = {
  ronda: RondaDTO;
  semana: number;
  totalParticipantes: number;
  items: Item[];
  totalAportesSemana?: string;
  totalAhorrosSemana?: string;
  responsableId?: number | null;
};

type ToastType = "success" | "error" | "info" | "warning";
type Toast = { text: string; type: ToastType };

export default function RondaActualPage() {
  const [estado, setEstado] = useState<EstadoSemana | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [pendientes, setPendientes] = useState<
    { socioId: number; socio: Item["socio"]; montoAporte: string; multa: string; totalAdeudado: string; observaciones?: string }[]
  >([]);

  const [ahorroInputs, setAhorroInputs] = useState<Record<number, number>>({});
  const [multasInputs, setMultasInputs] = useState<Record<number, number>>({});
  const [obsInputs, setObsInputs] = useState<Record<number, string>>({});

  const [responsableId, setResponsableId] = useState<number | "">("");

  // --- Toast ---
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = (text: string, type: Toast["type"] = "success", ms = 2500) => {
    setToast({ text, type });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), ms);
  };

  // --- Modal Préstamo Express ---
  const [loanOpen, setLoanOpen] = useState(false);
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanSocio, setLoanSocio] = useState<{ id: number; nombres: string; apellidos: string } | null>(null);
  const [loanPrincipal, setLoanPrincipal] = useState<number>(0); // normalmente = monto aporte
  const [loanInteres, setLoanInteres] = useState<number>(0);     // monto de interés a cobrar
  const [loanObs, setLoanObs] = useState<string>("");

  function openLoanModal(p: { socioId: number; socio: Item["socio"]; montoAporte: string }) {
    setLoanSocio({ id: p.socioId, nombres: p.socio.nombres, apellidos: p.socio.apellidos });
    setLoanPrincipal(Number(p.montoAporte || 0));
    setLoanInteres(0);
    setLoanObs(obsInputs[p.socioId] ?? "");
    setLoanOpen(true);
  }

  async function crearPrestamoExpress() {
    if (!estado || !loanSocio) return;
    try {
      setLoanSaving(true);
      // 1) Crear préstamo
      const res = await fetch(`/api/prestamos/express`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rondaId: estado.ronda.id,
          semana: estado.semana,
          socioId: loanSocio.id,
          principal: loanPrincipal,
          interes: loanInteres,
          observaciones: loanObs || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el préstamo express");

      // 2) Registrar aporte de la semana con origen préstamo
      const res2 = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId: loanSocio.id,
          semana: estado.semana,
          monto: Number(estado.ronda.montoAporte),
          multa: 0,
          prestamoExpressId: data.id, // opcional en backend (si no existe, lo ignora)
          fuente: "prestamoExpress",
          observaciones: loanObs || undefined,
        }),
      });
      const data2 = await res2.json().catch(() => ({}));
      if (!res2.ok) throw new Error(data2?.error || "No se pudo registrar el aporte con préstamo");

      setLoanOpen(false);
      showToast("Préstamo express registrado y aporte aplicado");
      await cargar(); // refresca totales / pendientes
    } catch (e: any) {
      showToast(e?.message || "Error en préstamo express", "error", 4000);
    } finally {
      setLoanSaving(false);
    }
  }

  function setAhorroInput(socioId: number, v: number) {
    setAhorroInputs((prev) => ({ ...prev, [socioId]: v }));
  }
  function setMultaInput(socioId: number, v: number) {
    setMultasInputs((prev) => ({ ...prev, [socioId]: v }));
  }
  function setObsInput(socioId: number, v: string) {
    setObsInputs((prev) => ({ ...prev, [socioId]: v }));
  }

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (estado) setResponsableId(estado.responsableId ?? estado.ronda?.responsableId ?? "");
  }, [estado?.responsableId, estado?.ronda?.responsableId]);

  async function registrarAhorroParcial(socioId: number, monto: number) {
    if (!estado) return;
    try {
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
      await cargar();
      showToast("Ahorro registrado");
    } catch (e: any) {
      setError(e.message || "Error al registrar ahorro");
      showToast(e.message || "Error al registrar ahorro", "error", 4000);
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
      showToast("Aporte registrado");
    } catch (e: any) {
      setError(e.message || "Error al registrar aporte");
      showToast(e.message || "Error al registrar aporte", "error", 4000);
    } finally {
      setSaving(null);
    }
  }

  async function registrarAporteTodos() {
    if (!estado) return;
    try {
      setCerrando(true);
      const bodyBase = (socioId: number) => ({
        socioId,
        semana: estado.semana,
        monto: Number(estado.ronda.montoAporte),
        multa: 0,
      });
      const promesas = estado.items.map((it) =>
        fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyBase(it.socioId)),
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
      showToast("Aportes registrados para todos");
    } catch (e: any) {
      setError(e.message || "Error al registrar aportes masivos");
      showToast(e.message || "Error al registrar aportes masivos", "error", 4000);
    } finally {
      setCerrando(false);
    }
  }

  async function cobrarPendiente(socioId: number) {
    if (!estado) return;
    try {
      setSaving(socioId);
      const multa = Number(multasInputs[socioId] ?? 0);
      const observaciones = obsInputs[socioId] ?? "";
      const res = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId,
          semana: estado.semana,
          monto: Number(estado.ronda.montoAporte),
          multa,
          observaciones,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo registrar el cobro");
      await cargar();
      showToast("Cobro registrado");
    } catch (e: any) {
      setError(e.message || "Error al cobrar pendiente");
      showToast(e.message || "Error al cobrar pendiente", "error", 4000);
    } finally {
      setSaving(null);
    }
  }

  async function guardarResponsable() {
    if (!estado) return;
    if (responsableId === "") {
      setError("Selecciona un responsable antes de guardar.");
      return;
    }
    try {
      const res = await fetch(`/api/rondas/${estado.ronda.id}/responsable`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId: Number(responsableId), semana: estado.semana }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar el responsable");
      await cargar();
      showToast("Responsable guardado");
    } catch (e: any) {
      setError(e.message || "Error al guardar responsable");
      showToast(e.message || "Error al guardar responsable", "error", 4000);
    }
  }

  async function cargar() {
    try {
      setError(null);
      const r = await fetch("/api/rondas", { cache: "no-store" });
      if (r.status === 204) { setEstado(null); return; }
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
        body: JSON.stringify({ socioId, semana: estado.semana, monto: Number(monto), multa: multaNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar");
      await cargar();
      showToast("Aporte actualizado");
    } catch (e: any) {
      setError(e.message || "Error al guardar");
      showToast(e.message || "Error al guardar", "error", 4000);
    } finally {
      setSaving(null);
    }
  }

  async function cerrarSemana() {
    if (!estado) return;
    try {
      setCerrando(true);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/cerrar-semana`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cerrar la semana");

      if (data.avanzada) {
        if (data.finalizada) {
          window.location.href = `/rondas/${estado.ronda.id}/resultados`;
        } else {
          await cargar();
          showToast("Semana cerrada");
        }
      } else {
        setPendientes(data.pendientes || []);
        if ((data.pendientes || []).length) showToast("Quedan pendientes. Puedes usar Préstamo express.", "info", 3500);
      }
    } catch (e: any) {
      setError(e.message || "Error al cerrar semana");
      showToast(e.message || "Error al cerrar semana", "error", 4000);
    } finally {
      setCerrando(false);
    }
  }

  if (!estado) return <div className="p-6">{error ?? "Cargando ronda..."}</div>;

  const itemsOrdenados = [...estado.items].sort((a, b) => a.orden - b.orden);
  const idx =
    itemsOrdenados.length > 0
      ? ((estado.semana - 1) % itemsOrdenados.length + itemsOrdenados.length) % itemsOrdenados.length
      : 0;
  const actual = itemsOrdenados[idx];
  const siguiente = itemsOrdenados.length ? itemsOrdenados[(idx + 1) % itemsOrdenados.length] : undefined;

  const montoAporteNum = Number(estado.ronda.montoAporte || 0);
  const totalAportesSemana =
    estado.totalAportesSemana != null
      ? Number(estado.totalAportesSemana)
      : estado.items.reduce((sum, it) => sum + (it.pagado ? montoAporteNum : 0), 0);

  const totalAhorrosSemana =
    estado.totalAhorrosSemana != null
      ? Number(estado.totalAhorrosSemana)
      : estado.items.reduce((sum, it) => sum + Number(it.ahorroSemana ?? 0), 0);

  const opcionesResponsable = itemsOrdenados.map((it) => ({
    value: it.socioId,
    label: `${it.socio.nombres} ${it.socio.apellidos} (${it.socio.numeroCuenta})`,
  }));

  return (
    <div className="space-y-6">
      {/* TOAST */}
      {toast && (
        <div
          role="status"
          className={[
            "fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ring-1",
            toast.type === "success" ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : toast.type === "error" ? "bg-red-50 text-red-800 ring-red-200"
              : "bg-blue-50 text-blue-800 ring-blue-200",
          ].join(" ")}
        >
          {toast.text}
        </div>
      )}

      <header className="rounded-xl border bg-white/60 p-5 shadow-sm backdrop-blur">
        {/* ... (encabezado como lo tienes) */}
        {/* (código intacto omitido por brevedad; no lo modifiqué) */}
        {/* --- pega aquí exactamente tu header existente --- */}
        {/* INICIO header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
              Ronda: <span className="text-blue-700">{estado.ronda.nombre}</span>
              <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                Semana {estado.semana}/{estado.totalParticipantes}
              </span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 ring-1 ring-gray-200">
                <svg className="h-4 w-4 opacity-70" viewBox="0 0 24 24" fill="currentColor"><path d="M11 3a1 1 0 1 1 2 0v1.06c1.9.3 3.5 1.34 3.5 3.19 0 1.97-1.72 2.88-3.86 3.43l-.64.16c-1.68.42-2.5.84-2.5 1.69 0 .86.83 1.42 2.2 1.42 1.16 0 2.24-.34 3.02-.98a1 1 0 0 1 1.34 1.48A5.62 5.62 0 0 1 13 16.95V18a1 1 0 1 1-2 0v-1.03c-2.03-.27-3.5-1.38-3.5-3.13 0-2.07 1.86-2.9 3.77-3.38l.63-.16c1.72-.43 2.6-.87 2.6-1.81 0-.84-.77-1.36-2.01-1.44-1.1-.07-2.15.28-2.9.87A1 1 0 1 1 7.7 6.5a5.47 5.47 0 0 1 3.3-1.4V3Z"/></svg>
                Monto por socio: <strong className="tabular-nums">{fmtMoney(Number(estado.ronda.montoAporte))}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 ring-1 ring-gray-200">
                <svg className="h-4 w-4 opacity-70" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-2.67 0-8 1.34-8 4v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.66-5.33-4-8-4ZM8 14c-.82 0-1.61.1-2.36.28C3.69 14.78 2 16.02 2 18v1a1 1 0 0 0 1 1h6v-1c0-1.38.73-2.6 1.9-3.57A12.5 12.5 0 0 0 8 14Z"/></svg>
                Participantes: <strong>{estado.totalParticipantes}</strong>
              </span>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>Progreso</span>
              <span className="tabular-nums">{Math.min(estado.semana, estado.totalParticipantes)}/{estado.totalParticipantes}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-gray-200">
              <div className="h-full bg-blue-600 transition-[width] duration-500"
                   style={{ width: `${Math.min(100, Math.max(0, ((estado.semana - 1) / Math.max(1, estado.totalParticipantes)) * 100))}%` }}/>
            </div>
          </div>
        </div>
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
        {/* FIN header */}
      </header>

      {/* === Totales + Responsable === */}
      {/* ... (sección de totales y responsable sin cambios) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500">Total aportes (semana)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtMoney(totalAportesSemana)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500">Total ahorros (semana)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtMoney(totalAhorrosSemana)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Responsable de cobro (semana {estado.semana})</p>
          <div className="flex items-center gap-2">
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">— Selecciona socio —</option>
              {opcionesResponsable.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
            <button onClick={guardarResponsable} disabled={responsableId === ""} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
              Guardar
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-red-700">{error}</div>}

      <div className="flex justify-end mb-4">
        <button onClick={registrarAporteTodos} disabled={cerrando} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
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

              // input controlado
              const valorInput = ahorroInputs[it.socioId] ?? "";
              const ahorroYaRegistrado = (it as any).ahorroRegistradoSemana === true;
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

                  <td className="px-4 py-2 text-right space-x-2">
                    {it.pagado ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                        Pagado
                      </span>
                    ) : (
                      <>
                        <button
                          disabled={saving === it.socioId}
                          onClick={() => registrarAporteIndividual(it.socioId)}
                          className="rounded bg-brand-500 px-3 py-1.5 text-white hover:bg-brand-600 disabled:opacity-50"
                        >
                          {saving === it.socioId ? "..." : "Registrar aporte"}
                        </button>

                        {/* Ofrecer préstamo express directo desde la tabla */}
                        <button
                          onClick={() =>
                            openLoanModal({
                              socioId: it.socioId,
                              socio: it.socio,
                              montoAporte: estado.ronda.montoAporte,
                            } as any)
                          }
                          className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
                          title="Ofrecer préstamo express"
                        >
                          Préstamo express
                        </button>
                      </>
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
        <button onClick={cerrarSemana} disabled={cerrando} className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50">
          {cerrando ? "Cerrando…" : "Cerrar semana"}
        </button>
      </div>

      {/* Pendientes + botón de préstamo express */}
      {pendientes.length > 0 && (
        <div className="rounded-xl bg-white shadow p-4">
          <h3 className="text-lg font-medium mb-3">Pendientes de pago</h3>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Socio</th>
                <th className="px-4 py-2">Aporte</th>
                <th className="px-4 py-2">Multa</th>
                <th className="px-4 py-2 text-left">Observaciones</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((p) => {
                const multa = multasInputs[p.socioId] ?? Number(p.multa ?? 0);
                const obs = obsInputs[p.socioId] ?? (p.observaciones ?? "");
                const total = (Number(p.montoAporte) + Number(multa)).toFixed(2);
                return (
                  <tr key={p.socioId} className="border-t">
                    <td className="px-4 py-2">
                      {p.socio.nombres} {p.socio.apellidos} ({p.socio.numeroCuenta})
                    </td>
                    <td className="px-4 py-2 text-center">${p.montoAporte}</td>
                    <td className="px-4 py-2 text-center">
                      <input type="number" min="0" step="0.01" className="w-24 rounded border px-2 py-1 text-right"
                             value={multa} onChange={(e) => setMultaInput(p.socioId, Number(e.target.value || 0))}/>
                    </td>
                    <td className="px-4 py-2">
                      <input type="text" className="w-full rounded border px-2 py-1" placeholder="Observaciones (opcional)"
                             value={obs} onChange={(e) => setObsInput(p.socioId, e.target.value)}/>
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">${total}</td>
                    <td className="px-4 py-2 flex items-center justify-center gap-2">
                      <button
                        disabled={saving === p.socioId}
                        onClick={() => cobrarPendiente(p.socioId)}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {saving === p.socioId ? "..." : "Cobrar y registrar"}
                      </button>
                      <button
                        onClick={() => openLoanModal(p)}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
                        title="Ofrecer préstamo express"
                      >
                        Préstamo express
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-gray-500">
            * Si un socio no puede pagar, usa <strong>Préstamo express</strong> para marcar el aporte como cubierto por préstamo.
          </p>
        </div>
      )}

      {/* MODAL PRÉSTAMO EXPRESS */}
      {loanOpen && loanSocio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <h4 className="text-lg font-semibold">Préstamo express</h4>
            <p className="mt-1 text-sm text-gray-600">
              Socio: <strong>{loanSocio.nombres} {loanSocio.apellidos}</strong>
            </p>
            <div className="mt-3 grid gap-3">
              <div>
                <label className="text-sm text-gray-700">Principal (aporte de la semana)</label>
                <input type="number" className="mt-1 w-full rounded border px-3 py-2 text-right"
                       readOnly value={loanPrincipal}/>
              </div>
              <div>
                <label className="text-sm text-gray-700">Interés a cobrar (monto)</label>
                <input type="number" min={0} step="0.01" className="mt-1 w-full rounded border px-3 py-2 text-right"
                       value={loanInteres} onChange={(e) => setLoanInteres(Number(e.target.value || 0))}/>
              </div>
              <div>
                <label className="text-sm text-gray-700">Observaciones (opcional)</label>
                <input className="mt-1 w-full rounded border px-3 py-2" value={loanObs} onChange={(e) => setLoanObs(e.target.value)} />
              </div>
              <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                Total a devolver: <strong>{fmtMoney(loanPrincipal + (loanInteres || 0))}</strong>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setLoanOpen(false)} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Cancelar</button>
              <button
                onClick={crearPrestamoExpress}
                disabled={loanSaving}
                className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loanSaving ? "Guardando…" : "Guardar préstamo y aplicar aporte"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
