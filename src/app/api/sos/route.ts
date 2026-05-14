import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ── MOCK FALLBACK (used when DB tables are empty) ──────────

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const MOCK_SELLERS    = ["Seller 1", "Seller 2", "Seller 3", "Seller 4", "Seller 5", "Seller 6"]
const MOCK_CATEGORIES = ["Categoría 1", "Categoría 2", "Categoría 3"]
const MOCK_CHANNELS   = ["Canal 1", "Canal 2", "Canal 3"]
const MOCK_COLORS: Record<string, string> = {
  "Seller 1": "#A427FF",
  "Seller 2": "#3b82f6",
  "Seller 3": "#ef4444",
  "Seller 4": "#f59e0b",
  "Seller 5": "#06b6d4",
  "Seller 6": "#84cc16",
}

function mockSellerEntry(seller: string, idx: number) {
  const rng = seededRandom(seller.length * 73 + idx * 41)
  const p1    = Math.round((8 + rng() * 22) * 10) / 10
  const total = Math.round((p1 + rng() * 8) * 10) / 10
  return {
    seller,
    sos_p1:           p1,
    sos_total:        total,
    sos_p1_change:    Math.round((rng() - 0.42) * 8 * 10) / 10,
    sos_total_change: Math.round((rng() - 0.42) * 6 * 10) / 10,
    products_p1:      Math.floor(2 + rng() * 8),
    products_total:   Math.floor(4 + rng() * 15),
    color:            MOCK_COLORS[seller] || "#888",
    rank:             0,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action   = searchParams.get("action") || "sellers"
  const channel  = searchParams.get("channel") || ""
  const category = searchParams.get("category") || ""
  const seller   = searchParams.get("seller") || ""
  const sellersParam = searchParams.get("sellers")?.split(",").filter(Boolean) || []

  try {
    // ── sellers list ──────────────────────────────────────
    if (action === "sellers_list") {
      const rows = await prisma.seller.findMany({ orderBy: { name: "asc" } })
      if (rows.length === 0) return NextResponse.json(MOCK_SELLERS)
      return NextResponse.json(rows.map(r => r.name))
    }

    // ── categories list ───────────────────────────────────
    if (action === "categories") {
      const rows = await prisma.category.findMany({ orderBy: { name: "asc" } })
      if (rows.length === 0) return NextResponse.json(MOCK_CATEGORIES)
      return NextResponse.json(rows.map(r => r.name))
    }

    // ── channels list ─────────────────────────────────────
    if (action === "channels") {
      const rows = await prisma.channel.findMany({ orderBy: { name: "asc" } })
      if (rows.length === 0) return NextResponse.json(MOCK_CHANNELS)
      return NextResponse.json(rows.map(r => r.name))
    }

    // ── sellers SOS overview ──────────────────────────────
    if (action === "sellers") {
      const where: Record<string, unknown> = {}
      if (category) where.category = { name: category }

      const entries = await prisma.sosEntry.findMany({
        where,
        include: { seller: true, category: true },
        orderBy: { date: "desc" },
        // latest snapshot per seller
      })

      // Aggregate latest entry per seller
      const bySellerMap = new Map<string, typeof entries[0]>()
      entries.forEach(e => {
        if (!bySellerMap.has(e.sellerId)) bySellerMap.set(e.sellerId, e)
      })
      const rows = Array.from(bySellerMap.values())

      if (rows.length === 0) {
        // Fallback to mock
        const mock = MOCK_SELLERS.map((s, i) => mockSellerEntry(s, i))
        const total = mock.reduce((sum, e) => sum + e.sos_p1, 0) || 1
        mock.forEach((e, i) => { e.sos_p1 = Math.round((e.sos_p1 / total) * 100 * 10) / 10; e.rank = i + 1 })
        mock.sort((a, b) => b.sos_p1 - a.sos_p1)
        mock.forEach((e, i) => (e.rank = i + 1))
        return NextResponse.json(mock)
      }

      const result = rows.map(e => ({
        seller:          e.seller.name,
        sos_p1:          e.sosP1,
        sos_total:       e.sosTotal,
        sos_p1_change:   e.sosP1Change,
        sos_total_change: e.sosTotalChange,
        products_p1:     e.productsP1,
        products_total:  e.productsTotal,
        color:           e.seller.color,
        rank:            e.rank,
      }))
      result.sort((a, b) => b.sos_p1 - a.sos_p1)
      result.forEach((e, i) => (e.rank = i + 1))
      return NextResponse.json(result)
    }

    // ── brand-level breakdown ─────────────────────────────
    if (action === "brands") {
      const sellerRow = await prisma.seller.findUnique({ where: { name: seller } })
      if (!sellerRow) {
        const brands = [`${seller} Premium`, `${seller} Essential`, `${seller} Basic`]
        return NextResponse.json(
          brands.map((brand, i) => {
            const rng = seededRandom(brand.length * 53 + i * 17)
            const p1  = Math.round((5 + rng() * 15) * 10) / 10
            return {
              brand, seller,
              sos_p1: p1, sos_total: Math.round((p1 + rng() * 5) * 10) / 10,
              sos_p1_change: Math.round((rng() - 0.4) * 6 * 10) / 10,
              sos_total_change: Math.round((rng() - 0.4) * 4 * 10) / 10,
              products_p1: Math.floor(1 + rng() * 4),
              color: MOCK_COLORS[seller] || "#888",
            }
          })
        )
      }

      const where: Record<string, unknown> = { sellerId: sellerRow.id, brand: { not: null } }
      if (category) where.category = { name: category }

      const entries = await prisma.sosEntry.findMany({
        where,
        include: { seller: true },
        orderBy: { date: "desc" },
      })

      const byBrand = new Map<string, typeof entries[0]>()
      entries.forEach(e => { if (e.brand && !byBrand.has(e.brand)) byBrand.set(e.brand, e) })

      if (byBrand.size === 0) {
        const brands = [`${seller} Premium`, `${seller} Essential`, `${seller} Basic`]
        return NextResponse.json(
          brands.map((brand, i) => {
            const rng = seededRandom(brand.length * 53 + i * 17)
            const p1  = Math.round((5 + rng() * 15) * 10) / 10
            return {
              brand, seller,
              sos_p1: p1, sos_total: Math.round((p1 + rng() * 5) * 10) / 10,
              sos_p1_change: Math.round((rng() - 0.4) * 6 * 10) / 10,
              sos_total_change: Math.round((rng() - 0.4) * 4 * 10) / 10,
              products_p1: Math.floor(1 + rng() * 4),
              color: sellerRow.color,
            }
          })
        )
      }

      return NextResponse.json(
        Array.from(byBrand.values()).map(e => ({
          brand:           e.brand,
          seller:          e.seller.name,
          sos_p1:          e.sosP1,
          sos_total:       e.sosTotal,
          sos_p1_change:   e.sosP1Change,
          sos_total_change: e.sosTotalChange,
          products_p1:     e.productsP1,
          color:           e.seller.color,
        }))
      )
    }

    // ── título (product title) breakdown ──────────────────
    if (action === "titulos") {
      const sellerRow = await prisma.seller.findUnique({ where: { name: seller } })
      if (!sellerRow) {
        const currentCat = category || MOCK_CATEGORIES[0]
        return NextResponse.json(
          Array.from({ length: 4 }, (_, i) => {
            const rng = seededRandom(seller.length * 37 + i * 19)
            return {
              titulo_id:     `${seller.replace(" ", "-").toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
              titulo:        `${seller} ${currentCat} Opción ${i + 1}`,
              seller,
              sos_p1:        Math.round((3 + rng() * 12) * 10) / 10,
              sos_total:     Math.round((5 + rng() * 14) * 10) / 10,
              sos_p1_change: Math.round((rng() - 0.4) * 5 * 10) / 10,
              sos_total_change: Math.round((rng() - 0.4) * 4 * 10) / 10,
              ranking_pos:   Math.floor(rng() * 20) + 1,
            }
          })
        )
      }

      const where: Record<string, unknown> = { sellerId: sellerRow.id, titulo: { not: null } }
      if (category) where.category = { name: category }

      const entries = await prisma.sosEntry.findMany({
        where,
        include: { seller: true },
        orderBy: { date: "desc" },
      })

      const byTitulo = new Map<string, typeof entries[0]>()
      entries.forEach(e => { if (e.tituloId && !byTitulo.has(e.tituloId)) byTitulo.set(e.tituloId, e) })

      if (byTitulo.size === 0) {
        const currentCat = category || MOCK_CATEGORIES[0]
        return NextResponse.json(
          Array.from({ length: 4 }, (_, i) => {
            const rng = seededRandom(seller.length * 37 + i * 19)
            return {
              titulo_id:     `${seller.replace(" ", "-").toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
              titulo:        `${seller} ${currentCat} Opción ${i + 1}`,
              seller,
              sos_p1:        Math.round((3 + rng() * 12) * 10) / 10,
              sos_total:     Math.round((5 + rng() * 14) * 10) / 10,
              sos_p1_change: Math.round((rng() - 0.4) * 5 * 10) / 10,
              sos_total_change: Math.round((rng() - 0.4) * 4 * 10) / 10,
              ranking_pos:   Math.floor(rng() * 20) + 1,
            }
          })
        )
      }

      return NextResponse.json(
        Array.from(byTitulo.values()).map(e => ({
          titulo_id:       e.tituloId,
          titulo:          e.titulo,
          seller:          e.seller.name,
          sos_p1:          e.sosP1,
          sos_total:       e.sosTotal,
          sos_p1_change:   e.sosP1Change,
          sos_total_change: e.sosTotalChange,
          ranking_pos:     e.rankingPos ?? 0,
        }))
      )
    }

    // ── 12-week trend ─────────────────────────────────────
    if (action === "trend") {
      const sellerList = sellersParam.length ? sellersParam : MOCK_SELLERS.slice(0, 4)

      const sellerRows = await prisma.seller.findMany({
        where: { name: { in: sellerList } },
      })

      if (sellerRows.length === 0) {
        return NextResponse.json(
          Array.from({ length: 12 }, (_, i) => {
            const pt: Record<string, unknown> = { week: `S${i + 1}` }
            sellerList.forEach((s, si) => {
              const rng = seededRandom(s.length * 71 + i * 13 + si * 37)
              pt[s] = Math.round((8 + rng() * 20) * 10) / 10
            })
            return pt
          })
        )
      }

      const sellerIds = sellerRows.map(r => r.id)
      const trends = await prisma.sosTrend.findMany({
        where: { sellerId: { in: sellerIds } },
        include: { seller: true },
        orderBy: { weekDate: "asc" },
      })

      if (trends.length === 0) {
        return NextResponse.json(
          Array.from({ length: 12 }, (_, i) => {
            const pt: Record<string, unknown> = { week: `S${i + 1}` }
            sellerList.forEach((s, si) => {
              const rng = seededRandom(s.length * 71 + i * 13 + si * 37)
              pt[s] = Math.round((8 + rng() * 20) * 10) / 10
            })
            return pt
          })
        )
      }

      // Group by week
      const weekMap = new Map<string, Record<string, unknown>>()
      trends.forEach(t => {
        if (!weekMap.has(t.week)) weekMap.set(t.week, { week: t.week })
        const pt = weekMap.get(t.week)!
        pt[t.seller.name] = t.sosP1
      })

      return NextResponse.json(Array.from(weekMap.values()))
    }

    // ── SOS by channel for a single seller ────────────────
    if (action === "by_channel") {
      const sellerRow = await prisma.seller.findUnique({ where: { name: seller } })
      if (!sellerRow) {
        return NextResponse.json(
          MOCK_CHANNELS.map((chan, i) => {
            const rng = seededRandom(chan.length * 41 + seller.length * 23 + i)
            const p1  = Math.round((8 + rng() * 22) * 10) / 10
            return {
              channel: chan,
              sos_p1:           p1,
              sos_total:        Math.round((p1 + rng() * 8) * 10) / 10,
              sos_p1_change:    Math.round((rng() - 0.4) * 6 * 10) / 10,
              sos_total_change: Math.round((rng() - 0.4) * 5 * 10) / 10,
            }
          })
        )
      }

      const sosChannels = await prisma.sosChannel.findMany({
        where: { sellerId: sellerRow.id },
        include: { channel: true },
        orderBy: { date: "desc" },
      })

      const byChan = new Map<string, typeof sosChannels[0]>()
      sosChannels.forEach(c => { if (!byChan.has(c.channelId)) byChan.set(c.channelId, c) })

      if (byChan.size === 0) {
        return NextResponse.json(
          MOCK_CHANNELS.map((chan, i) => {
            const rng = seededRandom(chan.length * 41 + seller.length * 23 + i)
            const p1  = Math.round((8 + rng() * 22) * 10) / 10
            return {
              channel: chan,
              sos_p1:           p1,
              sos_total:        Math.round((p1 + rng() * 8) * 10) / 10,
              sos_p1_change:    Math.round((rng() - 0.4) * 6 * 10) / 10,
              sos_total_change: Math.round((rng() - 0.4) * 5 * 10) / 10,
            }
          })
        )
      }

      return NextResponse.json(
        Array.from(byChan.values()).map(c => ({
          channel:         c.channel.name,
          sos_p1:          c.sosP1,
          sos_total:       c.sosTotal,
          sos_p1_change:   c.sosP1Change,
          sos_total_change: c.sosTotalChange,
        }))
      )
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
