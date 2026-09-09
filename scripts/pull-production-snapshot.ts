/**
 * Replaces the generated client fixtures. Preview and local start from a copy of
 * production instead of hand-maintained seed definitions, so what they test
 * against is what customers actually have rather than a fork of it that drifts.
 *
 * Auth rows are copied with the snapshot. `jwks` is left entirely alone —
 * production's signing keys are encrypted under production's BETTER_AUTH_SECRET
 * and the target cannot read them, so the target keeps and mints its own. E2E
 * credentials come from provision-development-auth.ts afterwards, as before.
 *
 *   node --experimental-strip-types scripts/pull-production-snapshot.ts --local
 *   node --experimental-strip-types scripts/pull-production-snapshot.ts --preview
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: { local: { type: 'boolean', default: false }, preview: { type: 'boolean', default: false } },
  strict: true,
})
if (values.local === values.preview) throw new Error('Choose exactly one of --local or --preview.')

const wrangler = resolve('node_modules/wrangler/bin/wrangler.js')
const run = (args: string[]) => execFileSync(process.execPath, [wrangler, ...args], { cwd: process.cwd(), stdio: 'inherit' })

const directory = mkdtempSync(join(tmpdir(), 'krabiclaw-snapshot-'))
try {
  const dumpPath = join(directory, 'production.sql')
  run(['d1', 'export', 'DB', '--remote', '--output', dumpPath])

  // Materialize so the payload is built from real rows rather than by editing SQL text.
  const dbPath = join(directory, 'production.sqlite')
  const sqlite = (...commands: string[]) =>
    execFileSync('sqlite3', [dbPath, ...commands], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  execFileSync('sqlite3', [dbPath], { input: readFileSync(dumpPath, 'utf8'), stdio: ['pipe', 'inherit', 'inherit'] })
  const tables = sqlite("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('d1_migrations', 'jwks') ORDER BY name")
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  // Local Wrangler cannot disable foreign-key actions inside its transaction.
  // Delete children first so SET NULL actions cannot violate a retained parent's
  // CHECK constraints while replacing an existing snapshot.
  const foreignKeys = JSON.parse(sqlite(`SELECT json_group_array(json_object('child', m.name, 'parent', f."table"))
    FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table'`)) as Array<{ child: string; parent: string }>
  // requests -> reviews -> review_requests -> requests is the schema's cycle.
  // Removing requests first cascades their review requests; review links may be
  // null, whereas a booking's customer/product/location CHECKs may not be.
  const pending = new Set(tables.filter(table => table !== 'requests'))
  const deleteOrder: string[] = ['requests']
  while (pending.size) {
    const children = [...pending].filter(table => !foreignKeys.some(key => key.parent === table && key.child !== table && pending.has(key.child)))
    if (!children.length) throw new Error(`Snapshot tables have cyclic foreign keys: ${[...pending].join(', ')}`)
    for (const table of children) { deleteOrder.push(table); pending.delete(table) }
  }

  const dataPath = join(directory, 'data.sql')
  sqlite(`.output ${dataPath}`, '.dump --data-only --nosys --newlines', '.output stdout')
  const inserts = readFileSync(dataPath, 'utf8')
    .split('\n')
    .filter(line => !line.startsWith('INSERT INTO d1_migrations') && !line.startsWith('INSERT INTO jwks'))
    .join('\n')

  // A data-only dump is ordered alphabetically, not topologically, so rows arrive
  // before the rows they reference. `foreign_keys = OFF` covers the remote import;
  // locally Wrangler wraps the file in a transaction, where SQLite ignores that
  // pragma and only `defer_foreign_keys` holds — checked once at commit, by which
  // point every referenced row exists.
  const payloadPath = join(directory, 'payload.sql')
  writeFileSync(payloadPath, [
    'PRAGMA foreign_keys = OFF;',
    'PRAGMA defer_foreign_keys = ON;',
    ...deleteOrder.map(table => `DELETE FROM "${table}";`),
    inserts,
    'PRAGMA foreign_keys = ON;',
  ].join('\n'), { encoding: 'utf8', mode: 0o600 })

  const target = values.preview ? ['--env', 'preview', '--remote'] : ['--local']
  run(['d1', 'execute', 'DB', ...target, '--file', payloadPath])
  console.log(`Restored ${tables.length} tables from the production DB binding into ${values.preview ? 'preview' : 'local'} D1.`)
} finally {
  rmSync(directory, { recursive: true, force: true })
}
