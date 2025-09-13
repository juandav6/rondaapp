// app/prestamos/express/page.tsx
"use client";
import { useEffect, useState } from "react";

const money = (n: number, currency = "USD", locale = "es-EC") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n) || 0);

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };
type Ronda = { id: number; nombre: string };

type Prestamo = {
  id: number;
  ronda: Ronda;
  socio: Socio;
  semana: number;
  principal: string;
  interes: string;
  total: string;
  estado: "PENDIENTE" | "PAGADO" | "CANCELADO";
  observaciones?: string | null;
  createdAt: string;
};

export default function PrestamosExpressPage() {
  const [items, setItems] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch("/api/prestamos/express?estado=PENDIENTE", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "No se pudo cargar");
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Error al cargar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cancelar = async (id: number) => {
    try {
      setCancelando(id);
      const r = await fetch("/api/prestamos/express", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, revertirAporte: true }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "No se pudo cancelar");
      setToast("Préstamo cancelado. El aporte volvió a pendiente.");
      await load();
      setTimeout(() => setToast(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error al cancelar");
    } finally {
      setCancelando(null);
    }
  };

  return (
    <div className="space-y-4 p-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 shadow">
          {toast}
        </div>
      )}
      <h1 className="text-2xl font-bold tracking-tight">Préstamos Express</h1>
      <p className="text-gray-600">Gestiona los préstamos express pendientes. Puedes cancelarlos para revertir el aporte.</p>

      {error && <div className="rounded-md bg-red-50 p-3 text-red-700">{error}</div>}

      <div className="rounded-xl bg-white shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left">Ronda</th>
              <th className="px-4 py-2 text-left">Socio</th>
              <th className="px-4 py-2">Semana</th>
              <th className="px-4 py-2 text-right">Principal</th>
              <th className="px-4 py-2 text-right">Interés</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-center" colSpan={7}>Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={7}>Sin préstamos pendientes.</td></tr>
            ) : items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.ronda?.nombre ?? p.ronda?.id}</td>
                <td className="px-4 py-2">
                  {p.socio?.nombres} {p.socio?.apellidos}
                  <span className="text-gray-400"> • {p.socio?.numeroCuenta}</span>
                </td>
                <td className="px-4 py-2 text-center">{p.semana}</td>
                <td className="px-4 py-2 text-right">{money(Number(p.principal))}</td>
                <td className="px-4 py-2 text-right">{money(Number(p.interes))}</td>
                <td className="px-4 py-2 text-right font-semibold">{money(Number(p.total))}</td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => cancelar(p.id)}
                    disabled={cancelando === p.id}
                    className="rounded bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelando === p.id ? "Cancelando…" : "Cancelar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
