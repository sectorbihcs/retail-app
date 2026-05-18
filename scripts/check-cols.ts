import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
async function main() {
  const r = await p.$queryRaw<{column_name:string}[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='eci' AND table_name='sos'
    ORDER BY ordinal_position
  `
  console.log(r.map(x => x.column_name).join("\n"))

  try {
    const cats = await p.$queryRaw<{n:string}[]>`
      SELECT DISTINCT subcategoria_2 AS n FROM eci.sos
      WHERE subcategoria_2 IS NOT NULL LIMIT 5
    `
    console.log("\nsubcategoria_2 samples:", cats)
  } catch(e: any) {
    console.log("\nERROR subcategoria_2:", e.message)
  }

  await p.$disconnect()
}
main()
