import type { Metadata } from "next"
import "./globals.css"
import AppShell from "@/components/layout/AppShell"

export const metadata: Metadata = {
  title: { default: "SOS · Share of Shelf", template: "%s · SOS" },
  description: "Plataforma de Share of Shelf por seller, marca y título",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
