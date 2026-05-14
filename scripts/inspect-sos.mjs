import pg from 'pg';
const { Client } = pg;

const DB = "postgres://2ef6ab6375de454d7e0f9b961b91e4e992956a09fab0d4fe8203a15ef643f586:sk_wK48Gy0Y8uGw2OtnrmceQ@db.prisma.io:5432/postgres?sslmode=require";

const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const cols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='eci' AND table_name='sos' ORDER BY ordinal_position`);
console.log('\n=== COLUMNS ===');
cols.rows.forEach(r => console.log(r.column_name, '-', r.data_type));

const cnt = await c.query(`SELECT COUNT(*) FROM eci.sos`);
console.log('\n=== ROW COUNT ===', cnt.rows[0].count);

const sample = await c.query(`SELECT * FROM eci.sos LIMIT 3`);
console.log('\n=== SAMPLE ROWS ===');
console.log(JSON.stringify(sample.rows, null, 2));

await c.end();
