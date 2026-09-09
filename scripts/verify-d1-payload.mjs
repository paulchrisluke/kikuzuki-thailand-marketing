#!/usr/bin/env node
// Compares a live D1 database with the rebaseline target it was loaded from,
// table by table, without exporting: row count plus an order-independent size
// fingerprint of every column's quoted value. Both sides are SQLite, so quote()
// is byte-identical. Seconds instead of a multi-minute re-export.
//
//   node scripts/verify-d1-payload.mjs <target.sqlite> --env <preview|staging|production|local> [--without-jwks]
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const WRANGLER_BIN = join(ROOT, 'node_modules', '.bin', 'wrangler')
const args = process.argv.slice(2)
const flag = name => { const i = args.indexOf(name); return i >= 0 ? Boolean(args.splice(i, 1)) : false }
const option = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null }
const withoutJwks = flag('--without-jwks')
const environment = option('--env')
const [targetPath] = args
if (!targetPath || !environment) throw new Error('Usage: verify-d1-payload.mjs <target.sqlite> --env <preview|staging|production|local> [--without-jwks]')
if (!existsSync(targetPath)) throw new Error(`Missing target: ${targetPath}`)

const qi = value => `"${value.replaceAll('"', '""')}"`
const target = new Database(targetPath, { readonly: true })
const tables = target.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name")
  .all().map(row => row.name).filter(name => !(withoutJwks && name === 'jwks'))

function fingerprintSql(table) {
  const columns = target.prepare(`PRAGMA table_info(${qi(table)})`).all().map(row => row.name)
  const bytes = columns.map(name => `length(quote(${qi(name)}))`).join(' + ')
  return `SELECT '${table}' AS t, count(*) AS n, total(${bytes}) AS b FROM ${qi(table)}`
}
const statements = tables.map(fingerprintSql)
const local = new Map(tables.map((table, index) => { const row = target.prepare(statements[index]).get(); return [table, { n: row.n, b: row.b }] }))
target.close()

// One statement per table; wrangler reads them from a file so the argument list stays small.
const location = environment === 'local' ? ['--local'] : [...(environment === 'production' ? [] : ['--env', environment]), '--remote']
const scratch = mkdtempSync(join(tmpdir(), 'krabiclaw-verify-'))
const sqlPath = join(scratch, 'fingerprints.sql')
writeFileSync(sqlPath, statements.map(statement => `${statement};`).join('\n'))
const result = spawnSync(WRANGLER_BIN, ['d1', 'execute', 'DB', ...location, '--file', sqlPath, '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
rmSync(scratch, { recursive: true, force: true })
if (result.status !== 0) throw new Error(`wrangler failed: ${result.stderr || result.stdout}`)
const payload = JSON.parse(result.stdout)
const remoteRows = (Array.isArray(payload) ? payload : [payload]).flatMap(envelope => envelope.results ?? [])
const remote = new Map(remoteRows.map(row => [row.t, { n: row.n, b: row.b }]))

const mismatches = []
for (const table of tables) {
  const a = local.get(table), b = remote.get(table)
  if (!b) { mismatches.push(`${table}: missing remotely`); continue }
  if (a.n !== b.n || Math.round(a.b) !== Math.round(b.b)) mismatches.push(`${table}: local ${a.n} rows/${a.b} bytes, remote ${b.n} rows/${b.b} bytes`)
}
const rows = [...local.values()].reduce((sum, row) => sum + row.n, 0)
if (mismatches.length) {
  console.error(`Verification FAILED for ${environment}:\n${mismatches.map(item => `  - ${item}`).join('\n')}`)
  process.exit(1)
}
console.log(`Verified ${environment}: ${tables.length} tables, ${rows} rows match the transfer target exactly (count and quoted-byte fingerprint).`)
