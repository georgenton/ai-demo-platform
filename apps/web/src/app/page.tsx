// -----------------------------------------------------------------------------
// Landing `/` — Server Component que redirige al primer demo.
//
// Por qué redirect y no una landing propia: el cliente final que abre la app
// quiere ver IA funcionando, no un splash. La página marketing-y de venta
// vive en el sidebar (que muestra los 5 demos con sus taglines, suficiente
// "landing" en sí mismo). Cuando el cliente abra `/`, lo dejamos directo
// en Demo 01 — el más "wow" y el primero del catálogo.
// -----------------------------------------------------------------------------

import { redirect } from 'next/navigation';

export default function RootPage(): never {
  redirect('/demo/rag');
}
