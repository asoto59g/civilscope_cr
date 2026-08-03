"use client";

import { CircleAlert, RefreshCw } from "lucide-react";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal-error">
      <CircleAlert size={32} />
      <h1>No pudimos mostrar Civilscope CR</h1>
      <p>Ocurrió un error inesperado al preparar la plataforma.</p>
      <button type="button" onClick={reset}>
        <RefreshCw size={16} /> Intentar de nuevo
      </button>
    </main>
  );
}

