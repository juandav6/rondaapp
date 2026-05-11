// components/portal/PortalHeader.tsx
"use client";
import { signOut } from "next-auth/react";

export default function PortalHeader({ nombre }: { nombre: string }) {
  const iniciales = nombre.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1a3a2a]">
            <svg viewBox="0 0 32 32" width="24" height="24">
              <circle cx="16" cy="16" r="14" fill="#22543d"/>
              <circle cx="16" cy="14" r="7" fill="#f6c94e" stroke="#d4a72c" strokeWidth="1"/>
              <text x="16" y="18" textAnchor="middle" fontFamily="Georgia,serif" fontSize="9" fontWeight="700" fill="#8a6200">$</text>
              <circle cx="9" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
              <circle cx="23" cy="21" r="4" fill="#f6c94e" stroke="#d4a72c" strokeWidth="0.8"/>
            </svg>
          </div>
          <span className="text-sm font-bold" style={{ fontFamily: "Georgia,serif" }}>
            Mi<span className="text-emerald-600">Ronda</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
            {iniciales}
          </span>
          <span className="hidden sm:block text-sm text-gray-700 dark:text-gray-300">{nombre}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border rounded px-2 py-1">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}