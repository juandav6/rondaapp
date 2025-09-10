"use client";
import { useEffect, useState } from "react";

export default function ResultadosPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/rondas/${params.id}/resultados`)
      .then(r => r.json())
      .then(setData)
      .catch(err => setError(err.message));
  }, [params.id]);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6">Cargando...</div>;

  const { resumen, socios } = data;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Resultados de la Ronda: {resumen.nombre}</h1>
      <p>Fecha inicio: {new Date(resumen.fechaInicio).toLocaleDateString()}</p>
      <p>Fecha fin: {new Date(resumen.fechaFin).toLocaleDateString()}</p>
      <p>Total socios: {resumen.totalSocios}</p>
      <p>Total aportes: ${resumen.totalAportes}</p>
      <p>Total ahorros: ${resumen.totalAhorros}</p>
      <p>Total multas: ${resumen.totalMultas}</p>

      <h2 className="text-xl font-semibold mt-6">Detalle por socio</h2>
      <table className="min-w-full text-sm border mt-2">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Socio</th>
            <th className="px-4 py-2 text-left">Cuenta</th>
            <th className="px-4 py-2 text-right">Aportes</th>
            <th className="px-4 py-2 text-right">Ahorros</th>
            <th className="px-4 py-2 text-right">Multas</th>
          </tr>
        </thead>
        <tbody>
          {socios.map((s: any) => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-2">{s.nombres} {s.apellidos}</td>
              <td className="px-4 py-2">{s.numeroCuenta}</td>
              <td className="px-4 py-2 text-right">${s.aportes}</td>
              <td className="px-4 py-2 text-right">${s.ahorros}</td>
              <td className="px-4 py-2 text-right">${s.multas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
