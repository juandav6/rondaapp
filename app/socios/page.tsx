"use client";
import { useEffect, useState } from "react";

interface SocioRow {
  id: number;
  numeroCuenta: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  edad: number;
  ahorros: number;
  multas: number;
}

interface CreateSocioPayload {
  cedula: string;
  nombres: string;
  apellidos: string;
  edad: number;
  multas?: number;
  ahorroInicial?: number;
}

export default function SociosPage() {
  const [socios, setSocios] = useState<SocioRow[]>([]);
  const [form, setForm] = useState<Partial<CreateSocioPayload>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"lista" | "formulario">("lista");

  useEffect(() => {
    fetchSocios();
  }, []);

  const fetchSocios = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/socios");
      if (!response.ok) throw new Error("Error al obtener socios");
      const data = await response.json();
      setSocios(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: CreateSocioPayload = {
        cedula: form.cedula!.trim(),
        nombres: form.nombres!.trim(),
        apellidos: form.apellidos!.trim(),
        edad: Number(form.edad) || 0,
        ...(form.multas != null ? { multas: Number(form.multas) } : {}),
        ...(form.ahorroInicial ? { ahorroInicial: Number(form.ahorroInicial) } : {}),
      };

      const response = await fetch("/api/socios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error || "Error al crear socio");
      }

      setForm({});
      setSuccess("Socio agregado correctamente");
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
      await fetchSocios();
      setActiveTab("lista");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear socio");
      setSuccess(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Está seguro de que desea eliminar este socio?")) return;
    try {
      const response = await fetch(`/api/socios/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Error al eliminar socio");
      setSocios(socios.filter((s) => s.id !== id));
      setSuccess("Socio eliminado correctamente");
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar socio");
      setSuccess(null);
    }
  };

  const totalAhorros = socios.reduce((sum, socio) => sum + socio.ahorros, 0);
  const totalMultas = socios.reduce((sum, socio) => sum + socio.multas, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Cargando socios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header en recuadro */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/>
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Gestión de Socios</h1>
              <p className="text-sm text-gray-600">Administra los socios de la cooperativa</p>
            </div>
          </div>
        </div>

        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Socios</h3>
            <p className="mt-1 text-3xl font-bold text-gray-900">{socios.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Ahorros</h3>
            <p className="mt-1 text-3xl font-bold text-emerald-600">${totalAhorros.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Multas</h3>
            <p className="mt-1 text-3xl font-bold text-rose-600">${totalMultas.toFixed(2)}</p>
          </div>
        </div>

        {/* Alertas */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}

        {/* Tabs de navegación */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("lista")}
                className={`py-4 px-6 text-center font-medium text-sm ${
                  activeTab === "lista"
                    ? "text-blue-700 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Lista de Socios
              </button>
              <button
                onClick={() => setActiveTab("formulario")}
                className={`py-4 px-6 text-center font-medium text-sm ${
                  activeTab === "formulario"
                    ? "text-blue-700 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Agregar Socio
              </button>
            </nav>
          </div>

          {/* Contenido de las tabs */}
          {activeTab === "formulario" && (
            <div className="p-6 border-t">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Agregar Nuevo Socio</h2>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
                  <input
                    type="text"
                    placeholder="Ej: 001-1234567-8"
                    value={form.cedula || ""}
                    onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                  <input
                    type="text"
                    placeholder="Nombres del socio"
                    value={form.nombres || ""}
                    onChange={(e) => setForm({ ...form, nombres: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                  <input
                    type="text"
                    placeholder="Apellidos del socio"
                    value={form.apellidos || ""}
                    onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
                  <input
                    type="number"
                    placeholder="Edad"
                    value={form.edad || ""}
                    onChange={(e) => setForm({ ...form, edad: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ahorros ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.ahorroInicial || ""}
                    onChange={(e) => setForm({ ...form, ahorroInicial: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Multas ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.multas || ""}
                    onChange={(e) => setForm({ ...form, multas: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("lista")}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Agregar Socio
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "lista" && (
            <div className="border-t">
              <div className="px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Lista de Socios</h2>
                <button
                  onClick={() => setActiveTab("formulario")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Nuevo Socio
                </button>
              </div>

              {socios.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay socios</h3>
                  <p className="mt-1 text-sm text-gray-500">Comienza agregando tu primer socio.</p>
                  <div className="mt-6">
                    <button
                      onClick={() => setActiveTab("formulario")}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Agregar Socio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuenta</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombres</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cédula</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Edad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ahorros</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Multas</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {socios.map((socio) => (
                        <tr key={socio.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{socio.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{socio.numeroCuenta}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="font-medium">{socio.nombres} {socio.apellidos}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{socio.cedula}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{socio.edad}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">${socio.ahorros}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-rose-600">${socio.multas}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDelete(socio.id)}
                              className="text-red-600 hover:text-red-900 flex items-center"
                              title="Eliminar socio"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
