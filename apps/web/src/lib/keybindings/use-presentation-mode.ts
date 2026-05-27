// -----------------------------------------------------------------------------
// usePresentationMode — toggle global del modo "presentación".
//
// Qué hace:
//   - Mantiene un boolean `presenting` que indica si estamos en modo demo.
//   - Lo persiste en `localStorage` para que sobreviva al refresh — útil
//     durante ensayos sucesivos (encendés modo presentación una vez y
//     queda ahí hasta que lo apagás).
//   - Aplica/quita la clase `presenting` en `<html>` para que el CSS pueda
//     ocultar el sidebar (ver `.app-shell.presenting > .sidebar` en
//     ui-kit.css). Aplicar la clase al `<html>` (no al body) es más robusto
//     contra `next/font` y otros frameworks que pueden tocar el body.
//
// Por qué la clase y no un context con prop-drilling:
//   - El estado solo lo necesitan el sidebar (ocultarse) y el header
//     (cambiar el icono del toggle). Una clase CSS resuelve lo primero
//     sin re-render; el toggle del header sí necesita el estado y lo
//     obtiene desde este mismo hook.
//
// SSR: durante el primer render del server no podemos leer localStorage,
// así que arrancamos en `false` y un `useEffect` sincroniza el estado real
// después del hydrate. No flashea porque la clase la pinta el efecto.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'aidemo:presenting';
const HTML_CLASS = 'presenting';

export interface UsePresentationModeResult {
  presenting: boolean;
  toggle: () => void;
  set: (value: boolean) => void;
}

export function usePresentationMode(): UsePresentationModeResult {
  const [presenting, setPresenting] = useState(false);

  // Sincroniza desde localStorage en el primer mount (post-hydrate).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setPresenting(true);
    } catch {
      // localStorage puede fallar en modo privado / quota lleno — ignorá
      // y arrancá en false. Es modo "presentación", no algo crítico.
    }
  }, []);

  // Aplica/quita la clase en <html> y persiste el valor.
  useEffect(() => {
    const root = document.documentElement;
    if (presenting) {
      root.classList.add(HTML_CLASS);
    } else {
      root.classList.remove(HTML_CLASS);
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, presenting ? '1' : '0');
    } catch {
      // ver comentario arriba — fail silently.
    }
  }, [presenting]);

  const toggle = useCallback(() => setPresenting((v) => !v), []);
  const set = useCallback((value: boolean) => setPresenting(value), []);

  return { presenting, toggle, set };
}
