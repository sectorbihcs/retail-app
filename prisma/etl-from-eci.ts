/**
 * ETL: transforma eci.sos → tablas de SOS del schema public
 * Corre con: npm run db:etl
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const PALETTE = [
  "#A427FF", "#3b82f6", "#ef4444", "#f59e0b", "#06b6d4",
  "#84cc16", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
  "#dc2626", "#0ea5e9", "#10b981", "#d946ef", "#64748b",
]

function color(i: number) { return PALETTE[i % PALETTE.length] }
function pct(num: number, denom: number) {
  return denom === 0 ? 0 : Math.round((num / denom) * 1000) / 10 // 0–100 con 1 decimal
}
function n(v: unknown) { return Number(v) || 0 }

async function main() {
  console.log("🚀 ETL desde eci.sos → public\n")

  // ── Fecha más reciente ────────────────────────────────────
  const [{ d: latestDate }] = await prisma.$queryRaw<{ d: Date }[]>`
    SELECT MAX(DATE(fecha))::date AS d FROM eci.sos
  `
  const prevDate = new Date(latestDate)
  prevDate.setDate(prevDate.getDate() - 1)
  console.log("  Latest date :", latestDate.toISOString().split("T")[0])
  console.log("  Prev date   :", prevDate.toISOString().split("T")[0], "\n")

  // ── Dimensiones ───────────────────────────────────────────
  const sellerNames = await prisma.$queryRaw<{ n: string }[]>`
    SELECT DISTINCT seller AS n FROM eci.sos WHERE seller IS NOT NULL ORDER BY 1
  `
  const catNames = await prisma.$queryRaw<{ n: string }[]>`
    SELECT DISTINCT categoria AS n FROM eci.sos WHERE categoria IS NOT NULL ORDER BY 1
  `
  const chanNames = await prisma.$queryRaw<{ n: string }[]>`
    SELECT DISTINCT plataforma AS n FROM eci.sos WHERE plataforma IS NOT NULL ORDER BY 1
  `
  console.log(`  Sellers    : ${sellerNames.length}`)
  console.log(`  Categorías : ${catNames.length}`)
  console.log(`  Canales    : ${chanNames.length}\n`)

  // ── Limpiar (orden FK-safe) ───────────────────────────────
  console.log("  Limpiando tablas anteriores...")
  await prisma.sosChannel.deleteMany()
  await prisma.sosTrend.deleteMany()
  await prisma.sosEntry.deleteMany()
  await prisma.seller.deleteMany()
  await prisma.category.deleteMany()
  await prisma.channel.deleteMany()

  // ── Insertar sellers ──────────────────────────────────────
  const insertedSellers = await prisma.seller.createManyAndReturn({
    data: sellerNames.map(({ n: name }, i) => ({ name, color: color(i) })),
  })
  const sellerMap = new Map(insertedSellers.map((s) => [s.name, s.id]))

  // ── Insertar categorías ───────────────────────────────────
  const insertedCats = await prisma.category.createManyAndReturn({
    data: catNames.map(({ n: name }) => ({ name })),
  })
  const catMap = new Map(insertedCats.map((c) => [c.name, c.id]))

  // ── Insertar canales ──────────────────────────────────────
  const insertedChans = await prisma.channel.createManyAndReturn({
    data: chanNames.map(({ n: name }) => ({ name })),
  })
  const chanMap = new Map(insertedChans.map((c) => [c.name, c.id]))

  // ── SosEntry: nivel seller × categoría ───────────────────
  type SellerRow = {
    seller: string; categoria: string
    p1: unknown; total: unknown; avg_rank: unknown
    tp1: unknown; tt: unknown
    pp1: unknown; ptotal: unknown; ptp1: unknown; ptt: unknown
  }

  const sellerAgg = await prisma.$queryRaw<SellerRow[]>`
    WITH curr AS (
      SELECT seller, categoria,
        COUNT(*) FILTER (WHERE pagina = 1)                            AS p1,
        COUNT(*)                                                       AS total,
        AVG(orden::float)                                             AS avg_rank,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY categoria) AS tp1,
        SUM(COUNT(*))                         OVER (PARTITION BY categoria) AS tt
      FROM eci.sos WHERE DATE(fecha) = ${latestDate}::date
      GROUP BY seller, categoria
    ),
    prev AS (
      SELECT seller, categoria,
        COUNT(*) FILTER (WHERE pagina = 1)                            AS p1,
        COUNT(*)                                                       AS total,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY categoria) AS tp1,
        SUM(COUNT(*))                         OVER (PARTITION BY categoria) AS tt
      FROM eci.sos WHERE DATE(fecha) = ${prevDate}::date
      GROUP BY seller, categoria
    )
    SELECT c.seller, c.categoria,
      c.p1, c.total, c.avg_rank, c.tp1, c.tt,
      COALESCE(p.p1,    0) AS pp1,   COALESCE(p.total, 0) AS ptotal,
      COALESCE(p.tp1, c.tp1) AS ptp1, COALESCE(p.tt, c.tt)  AS ptt
    FROM curr c LEFT JOIN prev p USING (seller, categoria)
  `
  console.log(`  → ${sellerAgg.length} seller-level entries`)

  await prisma.sosEntry.createMany({
    data: sellerAgg
      .filter((r) => sellerMap.has(r.seller) && catMap.has(r.categoria))
      .map((r) => {
        const [p1, total, tp1, tt] = [n(r.p1), n(r.total), n(r.tp1), n(r.tt)]
        const [pp1, ptotal, ptp1, ptt] = [n(r.pp1), n(r.ptotal), n(r.ptp1), n(r.ptt)]
        const sosP1 = pct(p1, tp1), sosTotal = pct(total, tt)
        const prevP1 = pct(pp1, ptp1), prevTotal = pct(ptotal, ptt)
        return {
          sellerId:       sellerMap.get(r.seller)!,
          categoryId:     catMap.get(r.categoria)!,
          sosP1, sosTotal,
          sosP1Change:    Math.round((sosP1 - prevP1) * 10) / 10,
          sosTotalChange: Math.round((sosTotal - prevTotal) * 10) / 10,
          productsP1:     p1,
          productsTotal:  total,
          rank:           n(r.avg_rank),
          date:           latestDate,
        }
      }),
  })

  // ── SosEntry: nivel marca × categoría ────────────────────
  type BrandRow = {
    seller: string; categoria: string; marca: string
    p1: unknown; total: unknown; avg_rank: unknown
    tp1: unknown; tt: unknown
    pp1: unknown; ptotal: unknown; ptp1: unknown; ptt: unknown
  }

  const brandAgg = await prisma.$queryRaw<BrandRow[]>`
    WITH curr AS (
      SELECT seller, categoria, marca,
        COUNT(*) FILTER (WHERE pagina = 1)                            AS p1,
        COUNT(*)                                                       AS total,
        AVG(orden::float)                                             AS avg_rank,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY categoria) AS tp1,
        SUM(COUNT(*))                         OVER (PARTITION BY categoria) AS tt
      FROM eci.sos WHERE DATE(fecha) = ${latestDate}::date AND marca IS NOT NULL
      GROUP BY seller, categoria, marca
    ),
    prev AS (
      SELECT seller, categoria, marca,
        COUNT(*) FILTER (WHERE pagina = 1)                            AS p1,
        COUNT(*)                                                       AS total,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY categoria) AS tp1,
        SUM(COUNT(*))                         OVER (PARTITION BY categoria) AS tt
      FROM eci.sos WHERE DATE(fecha) = ${prevDate}::date AND marca IS NOT NULL
      GROUP BY seller, categoria, marca
    )
    SELECT c.seller, c.categoria, c.marca,
      c.p1, c.total, c.avg_rank, c.tp1, c.tt,
      COALESCE(p.p1,    0) AS pp1,   COALESCE(p.total, 0) AS ptotal,
      COALESCE(p.tp1, c.tp1) AS ptp1, COALESCE(p.tt, c.tt)  AS ptt
    FROM curr c LEFT JOIN prev p USING (seller, categoria, marca)
  `
  console.log(`  → ${brandAgg.length} brand-level entries`)

  const CHUNK = 1000
  for (let i = 0; i < brandAgg.length; i += CHUNK) {
    await prisma.sosEntry.createMany({
      data: brandAgg
        .slice(i, i + CHUNK)
        .filter((r) => sellerMap.has(r.seller) && catMap.has(r.categoria))
        .map((r) => {
          const [p1, total, tp1, tt] = [n(r.p1), n(r.total), n(r.tp1), n(r.tt)]
          const [pp1, ptotal, ptp1, ptt] = [n(r.pp1), n(r.ptotal), n(r.ptp1), n(r.ptt)]
          const sosP1 = pct(p1, tp1), sosTotal = pct(total, tt)
          const prevP1 = pct(pp1, ptp1), prevTotal = pct(ptotal, ptt)
          return {
            sellerId:       sellerMap.get(r.seller)!,
            categoryId:     catMap.get(r.categoria)!,
            brand:          r.marca,
            sosP1, sosTotal,
            sosP1Change:    Math.round((sosP1 - prevP1) * 10) / 10,
            sosTotalChange: Math.round((sosTotal - prevTotal) * 10) / 10,
            productsP1:     p1,
            productsTotal:  total,
            rank:           n(r.avg_rank),
            date:           latestDate,
          }
        }),
    })
  }

  // ── SosEntry: nivel título (producto individual) ──────────
  type TituloRow = {
    seller: string; categoria: string; marca: string | null
    producto: string; id_ml: string
    p1: unknown; total: unknown; best_rank: unknown
    tp1: unknown; tt: unknown
    pp1: unknown; ptotal: unknown; ptp1: unknown; ptt: unknown
  }

  const tituloAgg = await prisma.$queryRaw<TituloRow[]>`
    WITH curr AS (
      SELECT seller, categoria, marca, producto, ml AS id_ml,
        COUNT(*) FILTER (WHERE pagina = 1)                            AS p1,
        COUNT(*)                                                       AS total,
        MIN(orden)                                                    AS best_rank,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY categoria) AS tp1,
        SUM(COUNT(*))                         OVER (PARTITION BY categoria) AS tt
      FROM eci.sos WHERE DATE(fecha) = ${latestDate}::date
      GROUP BY seller, categoria, marca, producto, ml
    ),
    prev AS (
      SELECT seller, categoria, marca, producto, ml AS id_ml,
        COUNT(*) FILTER (WHERE pagina = 1)                            AS p1,
        COUNT(*)                                                       AS total,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY categoria) AS tp1,
        SUM(COUNT(*))                         OVER (PARTITION BY categoria) AS tt
      FROM eci.sos WHERE DATE(fecha) = ${prevDate}::date
      GROUP BY seller, categoria, marca, producto, ml
    )
    SELECT c.seller, c.categoria, c.marca, c.producto, c.id_ml,
      c.p1, c.total, c.best_rank, c.tp1, c.tt,
      COALESCE(p.p1,    0) AS pp1,   COALESCE(p.total, 0) AS ptotal,
      COALESCE(p.tp1, c.tp1) AS ptp1, COALESCE(p.tt, c.tt)  AS ptt
    FROM curr c LEFT JOIN prev p USING (seller, categoria, marca, producto, id_ml)
  `
  console.log(`  → ${tituloAgg.length} titulo-level entries`)

  for (let i = 0; i < tituloAgg.length; i += CHUNK) {
    await prisma.sosEntry.createMany({
      data: tituloAgg
        .slice(i, i + CHUNK)
        .filter((r) => sellerMap.has(r.seller) && catMap.has(r.categoria))
        .map((r) => {
          const [p1, total, tp1, tt] = [n(r.p1), n(r.total), n(r.tp1), n(r.tt)]
          const [pp1, ptotal, ptp1, ptt] = [n(r.pp1), n(r.ptotal), n(r.ptp1), n(r.ptt)]
          const sosP1 = pct(p1, tp1), sosTotal = pct(total, tt)
          const prevP1 = pct(pp1, ptp1), prevTotal = pct(ptotal, ptt)
          return {
            sellerId:       sellerMap.get(r.seller)!,
            categoryId:     catMap.get(r.categoria)!,
            brand:          r.marca ?? undefined,
            titulo:         r.producto,
            tituloId:       r.id_ml,
            rankingPos:     n(r.best_rank) || null,
            sosP1, sosTotal,
            sosP1Change:    Math.round((sosP1 - prevP1) * 10) / 10,
            sosTotalChange: Math.round((sosTotal - prevTotal) * 10) / 10,
            productsP1:     p1,
            productsTotal:  total,
            rank:           n(r.best_rank),
            date:           latestDate,
          }
        }),
    })
    if (i % 5000 === 0 && i > 0) console.log(`     ...${i}/${tituloAgg.length}`)
  }

  // ── SosTrend: semanal por seller (todas las categorías) ───
  type TrendRow = {
    seller: string; week_label: string; week_date: Date
    sos_p1: unknown; sos_total: unknown
  }

  const trendAgg = await prisma.$queryRaw<TrendRow[]>`
    WITH weekly_cat AS (
      SELECT seller, categoria,
        TO_CHAR(DATE_TRUNC('week', fecha), 'IYYY-"W"IW') AS week_label,
        DATE_TRUNC('week', fecha)::date                   AS week_date,
        COUNT(*) FILTER (WHERE pagina = 1)               AS p1,
        COUNT(*)                                          AS total,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY categoria, DATE_TRUNC('week', fecha)) AS tp1_cat,
        SUM(COUNT(*))                         OVER (PARTITION BY categoria, DATE_TRUNC('week', fecha)) AS tt_cat
      FROM eci.sos
      GROUP BY seller, categoria, DATE_TRUNC('week', fecha)
    )
    SELECT seller, week_label, week_date,
      ROUND(SUM(p1)::numeric   / NULLIF(SUM(tp1_cat), 0) * 100, 1) AS sos_p1,
      ROUND(SUM(total)::numeric / NULLIF(SUM(tt_cat),  0) * 100, 1) AS sos_total
    FROM weekly_cat
    GROUP BY seller, week_label, week_date
    ORDER BY seller, week_date
  `
  console.log(`  → ${trendAgg.length} trend points`)

  for (let i = 0; i < trendAgg.length; i += CHUNK) {
    await prisma.sosTrend.createMany({
      data: trendAgg
        .slice(i, i + CHUNK)
        .filter((r) => sellerMap.has(r.seller))
        .map((r) => ({
          sellerId: sellerMap.get(r.seller)!,
          week:     r.week_label,
          weekDate: new Date(r.week_date),
          sosP1:    n(r.sos_p1),
          sosTotal: n(r.sos_total),
        })),
    })
  }

  // ── SosChannel: seller × canal ────────────────────────────
  type ChanRow = {
    seller: string; plataforma: string
    p1: unknown; total: unknown; tp1: unknown; tt: unknown
    pp1: unknown; ptotal: unknown; ptp1: unknown; ptt: unknown
  }

  const chanAgg = await prisma.$queryRaw<ChanRow[]>`
    WITH curr AS (
      SELECT seller, plataforma,
        COUNT(*) FILTER (WHERE pagina = 1)                              AS p1,
        COUNT(*)                                                         AS total,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY plataforma) AS tp1,
        SUM(COUNT(*))                         OVER (PARTITION BY plataforma) AS tt
      FROM eci.sos WHERE DATE(fecha) = ${latestDate}::date
      GROUP BY seller, plataforma
    ),
    prev AS (
      SELECT seller, plataforma,
        COUNT(*) FILTER (WHERE pagina = 1)                              AS p1,
        COUNT(*)                                                         AS total,
        SUM(COUNT(*) FILTER (WHERE pagina=1)) OVER (PARTITION BY plataforma) AS tp1,
        SUM(COUNT(*))                         OVER (PARTITION BY plataforma) AS tt
      FROM eci.sos WHERE DATE(fecha) = ${prevDate}::date
      GROUP BY seller, plataforma
    )
    SELECT c.seller, c.plataforma,
      c.p1, c.total, c.tp1, c.tt,
      COALESCE(p.p1,    0) AS pp1,   COALESCE(p.total, 0) AS ptotal,
      COALESCE(p.tp1, c.tp1) AS ptp1, COALESCE(p.tt, c.tt)  AS ptt
    FROM curr c LEFT JOIN prev p USING (seller, plataforma)
  `
  console.log(`  → ${chanAgg.length} channel entries`)

  await prisma.sosChannel.createMany({
    data: chanAgg
      .filter((r) => sellerMap.has(r.seller) && chanMap.has(r.plataforma))
      .map((r) => {
        const [p1, total, tp1, tt] = [n(r.p1), n(r.total), n(r.tp1), n(r.tt)]
        const [pp1, ptotal, ptp1, ptt] = [n(r.pp1), n(r.ptotal), n(r.ptp1), n(r.ptt)]
        const sosP1 = pct(p1, tp1), sosTotal = pct(total, tt)
        const prevP1 = pct(pp1, ptp1), prevTotal = pct(ptotal, ptt)
        return {
          sellerId:       sellerMap.get(r.seller)!,
          channelId:      chanMap.get(r.plataforma)!,
          sosP1, sosTotal,
          sosP1Change:    Math.round((sosP1 - prevP1) * 10) / 10,
          sosTotalChange: Math.round((sosTotal - prevTotal) * 10) / 10,
          date:           latestDate,
        }
      }),
  })

  console.log("\n✅ ETL completado!")
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
