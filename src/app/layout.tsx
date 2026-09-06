/**
 * Layout raíz de Next.js.
 *
 * Este proyecto usa Next.js exclusivamente como backend (API Routes).
 * No se renderizan vistas de usuario final. Este layout existe solo
 * porque Next.js App Router lo requiere como archivo obligatorio.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
