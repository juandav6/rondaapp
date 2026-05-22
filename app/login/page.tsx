// app/login/page.tsx
"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const rol = (session.user as any).rol;
      const socioId = (session.user as any).socioId;
      if (rol === "SOCIO" && socioId) {
        router.replace(`/portal/${socioId}`);
      } else {
        router.replace("/");
      }
    }
  }, [status, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      setLoading(true);
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Correo o contraseña incorrectos. Verifica tus datos.");
      }
    } catch {
      setError("Error al iniciar sesión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-emerald-600" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
            <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/>
          </svg>
          <p className="text-sm text-emerald-700">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Panel izquierdo: ilustración + info ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-[#1a3a2a] to-[#22543d]">
        {/* Patrón de fondo */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}/>

        {/* Contenido */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <svg viewBox="0 0 32 32" width="28" height="28">
                <circle cx="16" cy="16" r="14" fill="#22543d"/>
                <circle cx="16" cy="14" r="7" fill="#f6c94e" stroke="#d4a72c" strokeWidth="1"/>
                <text x="16" y="18" textAnchor="middle" fontFamily="Georgia,serif" fontSize="9" fontWeight="700" fill="#8a6200">$</text>
                <circle cx="9" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
                <text x="9" y="23.5" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fontWeight="700" fill="#8a6200">$</text>
                <circle cx="23" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
                <text x="23" y="23.5" textAnchor="middle" fontFamily="Georgia,serif" fontSize="5" fontWeight="700" fill="#8a6200">$</text>
              </svg>
            </div>
            <span className="text-xl font-bold text-white" style={{ fontFamily: "Georgia, serif" }}>
              Mi<span className="text-emerald-300">Ronda</span>
            </span>
          </div>

          {/* Ilustración + tagline */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/banner-dashboard.png"
              alt="MiRonda"
              className="w-full max-w-md rounded-2xl shadow-2xl mb-8 object-cover"
              style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.3))" }}
            />
            <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>
              Tu ronda, tu ahorro,<br/>
              <span className="text-emerald-300">tu futuro</span>
            </h2>
            <p className="text-emerald-100/80 text-sm max-w-sm leading-relaxed">
              Gestiona aportes, ahorros, préstamos y más. Todo en un solo lugar, seguro y confiable.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: "💰", label: "Ahorros seguros" },
              { icon: "📊", label: "Control total" },
              { icon: "🤝", label: "Comunidad" },
            ].map(f => (
              <div key={f.label} className="flex flex-col items-center gap-2 rounded-xl bg-white/10 backdrop-blur p-3 text-center">
                <span className="text-2xl">{f.icon}</span>
                <p className="text-xs font-medium text-emerald-100">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">

          {/* Logo móvil */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1a3a2a] mb-3">
              <svg viewBox="0 0 32 32" width="40" height="40">
                <circle cx="16" cy="16" r="14" fill="#22543d"/>
                <circle cx="16" cy="14" r="7" fill="#f6c94e" stroke="#d4a72c" strokeWidth="1"/>
                <text x="16" y="18" textAnchor="middle" fontFamily="Georgia,serif" fontSize="9" fontWeight="700" fill="#8a6200">$</text>
                <circle cx="9" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
                <circle cx="23" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
              Mi<span className="text-emerald-600">Ronda</span>
            </h1>
          </div>

          {/* Encabezado */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Bienvenido de vuelta</h2>
            <p className="text-sm text-gray-500 mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 mt-0.5 text-red-500">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none">
                  <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z"/>
                  <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z"/>
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none">
                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd"/>
                </svg>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-12 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z"/>
                      <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12 21.75c-4.97 0-9.185-3.223-10.675-7.69a2.25 2.25 0 0 1 0-1.113 11.25 11.25 0 0 1 4.62-5.873l3.04 3.04a3.75 3.75 0 0 0 4.99 4.99l3.03 3.03A11.25 11.25 0 0 1 12 21.75Z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
                      <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113C21.186 17.024 16.969 20.25 12 20.25c-4.97 0-9.185-3.223-10.675-7.69a2.25 2.25 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/>
                  </svg>
                  Ingresando…
                </span>
              ) : "Iniciar sesión"}
            </button>
          </form>

          {/* Separador + info */}
          <div className="mt-6 space-y-4">
            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-gray-100"/>
              <span className="text-xs text-gray-400">acceso por rol</span>
              <div className="flex-1 border-t border-gray-100"/>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                <div className="text-lg mb-1">👑</div>
                <p className="text-xs font-semibold text-gray-700">Administrador</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Acceso completo al sistema</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                <div className="text-lg mb-1">👤</div>
                <p className="text-xs font-semibold text-emerald-700">Socio</p>
                <p className="text-[10px] text-emerald-600/70 mt-0.5">Ver tu cuenta personal</p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">
            MiRonda · Sistema de gestión de rondas de ahorro
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
