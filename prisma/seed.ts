/**
 * SEED SCRIPT — Share of Shelf
 * ─────────────────────────────────────────────────────────────
 * Uso: npm run db:seed
 *
 * INSTRUCCIONES:
 *  1. Reemplazá los arrays SELLERS, CATEGORIES, CHANNELS con los datos reales
 *  2. Reemplazá SOS_DATA con los datos de SOS reales
 *  3. Corré: npm run db:seed
 * ─────────────────────────────────────────────────────────────
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────
// 1. SELLERS — reemplazá con los sellers reales
// ─────────────────────────────────────────────────────────────
const SELLERS: { name: string; color: string }[] = [
  { name: "Seller A", color: "#A427FF" },
  { name: "Seller B", color: "#3b82f6" },
  { name: "Seller C", color: "#ef4444" },
  { name: "Seller D", color: "#f59e0b" },
  { name: "Seller E", color: "#06b6d4" },
  { name: "Seller F", color: "#84cc16" },
]

// ─────────────────────────────────────────────────────────────
// 2. CATEGORIES — reemplazá con las categorías reales
// ─────────────────────────────────────────────────────────────
const CATEGORIES: string[] = [
  "Categoría 1",
  "Categoría 2",
  "Categoría 3",
]

// ─────────────────────────────────────────────────────────────
// 3. CHANNELS — reemplazá con los canales reales
// ─────────────────────────────────────────────────────────────
const CHANNELS: string[] = [
  "Canal 1",
  "Canal 2",
  "Canal 3",
]

// ─────────────────────────────────────────────────────────────
// 4. SOS DATA — una fila por seller × categoría
//    Campos:
//      seller    → nombre exacto del seller (de SELLERS arriba)
//      category  → nombre exacto de la categoría (de CATEGORIES arriba)
//      brand     → marca (opcional, para drill "Marca")
//      titulo    → título del producto (opcional, para drill "Título")
//      tituloId  → ID del producto (opcional)
//      rankingPos→ posición típica en búsqueda
//      sosP1     → % share of shelf página 1
//      sosTotal  → % share of shelf total
//      sosP1Change    → variación pp vs semana anterior
//      sosTotalChange → variación pp vs semana anterior
//      productsP1     → cantidad de productos en página 1
//      productsTotal  → cantidad de productos total
// ─────────────────────────────────────────────────────────────
const SOS_DATA: {
  seller: string
  category: string
  brand?: string
  titulo?: string
  tituloId?: string
  rankingPos?: number
  sosP1: number
  sosTotal: number
  sosP1Change: number
  sosTotalChange: number
  productsP1: number
  productsTotal: number
}[] = [
  // Ejemplo — reemplazá estas filas con datos reales
  { seller: "Seller A", category: "Categoría 1", sosP1: 28.5, sosTotal: 32.0, sosP1Change: 1.2,  sosTotalChange: 0.8,  productsP1: 6,  productsTotal: 12 },
  { seller: "Seller B", category: "Categoría 1", sosP1: 21.0, sosTotal: 25.5, sosP1Change: -0.5, sosTotalChange: -0.3, productsP1: 4,  productsTotal: 9  },
  { seller: "Seller C", category: "Categoría 1", sosP1: 18.3, sosTotal: 22.1, sosP1Change: 2.1,  sosTotalChange: 1.5,  productsP1: 3,  productsTotal: 7  },
  { seller: "Seller D", category: "Categoría 1", sosP1: 15.0, sosTotal: 18.0, sosP1Change: 0.0,  sosTotalChange: 0.2,  productsP1: 3,  productsTotal: 6  },
  { seller: "Seller E", category: "Categoría 1", sosP1: 10.5, sosTotal: 13.2, sosP1Change: -1.0, sosTotalChange: -0.8, productsP1: 2,  productsTotal: 5  },
  { seller: "Seller F", category: "Categoría 1", sosP1: 6.7,  sosTotal: 9.2,  sosP1Change: 0.3,  sosTotalChange: 0.1,  productsP1: 1,  productsTotal: 3  },
  { seller: "Seller A", category: "Categoría 2", sosP1: 22.0, sosTotal: 27.0, sosP1Change: 0.5,  sosTotalChange: 0.4,  productsP1: 5,  productsTotal: 10 },
  { seller: "Seller B", category: "Categoría 2", sosP1: 19.5, sosTotal: 24.0, sosP1Change: 1.0,  sosTotalChange: 0.7,  productsP1: 4,  productsTotal: 8  },
]

// ─────────────────────────────────────────────────────────────
// 5. TREND DATA — una fila por seller × semana
//    12 semanas: S1 … S12
// ─────────────────────────────────────────────────────────────
const TREND_DATA: {
  seller: string
  week: string      // "S1" … "S12"
  weekDate: Date    // fecha del lunes de esa semana
  sosP1: number
  sosTotal: number
}[] = [
  // Generado automáticamente con valores de ejemplo — reemplazá con reales
  ...generateExampleTrend("Seller A", 28, 32),
  ...generateExampleTrend("Seller B", 21, 25),
  ...generateExampleTrend("Seller C", 18, 22),
  ...generateExampleTrend("Seller D", 15, 18),
]

function generateExampleTrend(seller: string, baseSosP1: number, baseSosTotal: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (11 - i) * 7)
    d.setHours(0, 0, 0, 0)
    const jitter = (Math.random() - 0.5) * 4
    return {
      seller,
      week: `S${i + 1}`,
      weekDate: new Date(d),
      sosP1:    Math.max(0, Math.round((baseSosP1 + jitter) * 10) / 10),
      sosTotal: Math.max(0, Math.round((baseSosTotal + jitter * 0.8) * 10) / 10),
    }
  })
}

// ─────────────────────────────────────────────────────────────
// 6. CHANNEL DATA — una fila por seller × canal
// ─────────────────────────────────────────────────────────────
const CHANNEL_DATA: {
  seller: string
  channel: string
  sosP1: number
  sosTotal: number
  sosP1Change: number
  sosTotalChange: number
}[] = [
  // Ejemplo — reemplazá con reales
  { seller: "Seller A", channel: "Canal 1", sosP1: 32.0, sosTotal: 36.0, sosP1Change:  1.5, sosTotalChange:  1.0 },
  { seller: "Seller A", channel: "Canal 2", sosP1: 25.5, sosTotal: 29.0, sosP1Change: -0.5, sosTotalChange: -0.3 },
  { seller: "Seller A", channel: "Canal 3", sosP1: 18.0, sosTotal: 22.0, sosP1Change:  0.8, sosTotalChange:  0.5 },
  { seller: "Seller B", channel: "Canal 1", sosP1: 20.0, sosTotal: 24.0, sosP1Change:  0.2, sosTotalChange:  0.1 },
  { seller: "Seller B", channel: "Canal 2", sosP1: 22.5, sosTotal: 26.0, sosP1Change:  1.1, sosTotalChange:  0.9 },
]

// ─────────────────────────────────────────────────────────────
// SEED RUNNER — no modificar
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding database...")

  // Upsert sellers
  console.log(`  → ${SELLERS.length} sellers...`)
  const sellerMap = new Map<string, string>()
  for (const s of SELLERS) {
    const row = await prisma.seller.upsert({
      where: { name: s.name },
      update: { color: s.color },
      create: { name: s.name, color: s.color },
    })
    sellerMap.set(s.name, row.id)
  }

  // Upsert categories
  console.log(`  → ${CATEGORIES.length} categories...`)
  const categoryMap = new Map<string, string>()
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { name: c },
      update: {},
      create: { name: c },
    })
    categoryMap.set(c, row.id)
  }

  // Upsert channels
  console.log(`  → ${CHANNELS.length} channels...`)
  const channelMap = new Map<string, string>()
  for (const c of CHANNELS) {
    const row = await prisma.channel.upsert({
      where: { name: c },
      update: {},
      create: { name: c },
    })
    channelMap.set(c, row.id)
  }

  // Insert SOS entries (deleteMany first to avoid duplicates on re-seed)
  console.log(`  → ${SOS_DATA.length} SOS entries...`)
  await prisma.sosEntry.deleteMany({})
  await prisma.sosEntry.createMany({
    data: SOS_DATA.map((d, i) => ({
      sellerId:      sellerMap.get(d.seller)!,
      categoryId:    categoryMap.get(d.category)!,
      brand:         d.brand,
      titulo:        d.titulo,
      tituloId:      d.tituloId,
      rankingPos:    d.rankingPos,
      sosP1:         d.sosP1,
      sosTotal:      d.sosTotal,
      sosP1Change:   d.sosP1Change,
      sosTotalChange: d.sosTotalChange,
      productsP1:    d.productsP1,
      productsTotal: d.productsTotal,
      rank:          i + 1,
    })),
  })

  // Insert trend data
  console.log(`  → ${TREND_DATA.length} trend points...`)
  await prisma.sosTrend.deleteMany({})
  await prisma.sosTrend.createMany({
    data: TREND_DATA.map(d => ({
      sellerId: sellerMap.get(d.seller)!,
      week:     d.week,
      weekDate: d.weekDate,
      sosP1:    d.sosP1,
      sosTotal: d.sosTotal,
    })),
  })

  // Insert channel data
  console.log(`  → ${CHANNEL_DATA.length} channel entries...`)
  await prisma.sosChannel.deleteMany({})
  await prisma.sosChannel.createMany({
    data: CHANNEL_DATA.map(d => ({
      sellerId:      sellerMap.get(d.seller)!,
      channelId:     channelMap.get(d.channel)!,
      sosP1:         d.sosP1,
      sosTotal:      d.sosTotal,
      sosP1Change:   d.sosP1Change,
      sosTotalChange: d.sosTotalChange,
    })),
  })

  console.log("✅ Seed completo!")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
