// Auth desactivada temporalmente — reactivar con Clerk cuando se tengan las claves
import { NextResponse } from "next/server"

export default function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|favicon|public|.*\\..*).*)"],
}
