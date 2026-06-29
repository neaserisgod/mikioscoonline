import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

const db = new Database('./dev.db')

// Set esDefault=1 on the first active PaymentMethod (by nombre) per org
const orgs = db.prepare('SELECT id FROM "Organization"').all()
for (const org of orgs) {
  const first = db.prepare(
    'SELECT id FROM "PaymentMethod" WHERE organizationId = ? AND activo = 1 ORDER BY nombre ASC LIMIT 1'
  ).get(org.id)
  if (first) {
    db.prepare('UPDATE "PaymentMethod" SET esDefault = 1 WHERE id = ?').run(first.id)
    console.log('Set esDefault on PaymentMethod', first.id, 'for org', org.id)
  } else {
    console.log('No active PaymentMethod for org', org.id)
  }
}
db.close()
console.log('Done')
