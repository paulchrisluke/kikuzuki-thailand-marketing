#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const WRANGLER_CONFIG = join(ROOT, 'wrangler.toml')
const WRANGLER_BIN = join(ROOT, 'node_modules', '.bin', 'wrangler')
const WRANGLER_ENV = {
  ...process.env,
  WRANGLER_LOG_PATH: join(tmpdir(), 'krabiclaw-wrangler-logs'),
}
const RESET_SENTINEL = '__preview_reset_in_progress'

function readOption(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function configBlock(source, heading) {
  const escapedHeading = heading.replaceAll('.', '\\.')
  const match = source.match(new RegExp(`^\\[\\[${escapedHeading}\\]\\]([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, 'm'))
  if (!match) throw new Error(`Missing [[${heading}]] in wrangler.toml`)
  return match[1]
}

function configValue(block, key) {
  const match = block.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"\\s*$`, 'm'))
  if (!match) throw new Error(`Missing ${key} in D1 binding`)
  return match[1]
}

function d1Binding(source, heading) {
  const block = configBlock(source, heading)
  return {
    name: configValue(block, 'database_name'),
    id: configValue(block, 'database_id'),
    migrationsDir: configValue(block, 'migrations_dir'),
  }
}

function runWrangler(args, { json = false } = {}) {
  const result = spawnSync(WRANGLER_BIN, args, {
    cwd: ROOT,
    env: WRANGLER_ENV,
    encoding: 'utf8',
    stdio: json ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Wrangler failed (${args.join(' ')})`)
  if (!json) return undefined
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(`Wrangler returned invalid JSON for ${args.join(' ')}`)
  }
}

// The production binding is the top-level [[d1_databases]]; every other
// environment is addressed through wrangler's --env flag.
function envArgs(environment) {
  return environment === 'production' ? [] : ['--env', environment]
}

function queryRows(databaseName, environment, sql) {
  const payload = runWrangler([
    'd1', 'execute', databaseName,
    ...envArgs(environment),
    '--remote',
    '--command', sql,
    '--json',
  ], { json: true })
  const envelopes = Array.isArray(payload) ? payload : [payload]
  return envelopes.flatMap(envelope => Array.isArray(envelope?.results) ? envelope.results : [])
}

function isApplicationObject(row) {
  if (!['table', 'view'].includes(row.type)) return false
  if (row.name === RESET_SENTINEL) return false
  if (row.name === 'sqlite_schema' || row.name === 'sqlite_temp_schema') return false
  if (row.name.startsWith('sqlite_') || row.name.startsWith('_cf_')) return false
  return true
}

function referencedTables(sql) {
  if (!sql) return []
  const references = []
  const pattern = /\bREFERENCES\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))/gi
  for (const match of sql.matchAll(pattern)) {
    references.push(match[1] ?? match[2] ?? match[3] ?? match[4])
  }
  return references
}

export function orderForDrop(objects) {
  const views = objects
    .filter(object => object.type === 'view')
    .sort((left, right) => left.name.localeCompare(right.name))
  const tables = objects.filter(object => object.type === 'table')
  const tableNames = new Set(tables.map(table => table.name))
  const dependencies = new Map(tables.map(table => [
    table.name,
    new Set(referencedTables(table.sql).filter(name => tableNames.has(name) && name !== table.name)),
  ]))
  const indices = new Map()
  const lowLinks = new Map()
  const stack = []
  const onStack = new Set()
  const components = []
  let nextIndex = 0

  function visit(name) {
    indices.set(name, nextIndex)
    lowLinks.set(name, nextIndex++)
    stack.push(name)
    onStack.add(name)
    for (const parent of [...dependencies.get(name)].sort()) {
      if (!indices.has(parent)) {
        visit(parent)
        lowLinks.set(name, Math.min(lowLinks.get(name), lowLinks.get(parent)))
      } else if (onStack.has(parent)) {
        lowLinks.set(name, Math.min(lowLinks.get(name), indices.get(parent)))
      }
    }
    if (lowLinks.get(name) === indices.get(name)) {
      const component = []
      let member
      do {
        member = stack.pop()
        onStack.delete(member)
        component.push(member)
      } while (member !== name)
      components.push(component.sort())
    }
  }
  for (const name of [...tableNames].sort()) {
    if (!indices.has(name)) visit(name)
  }
  const orderedNames = components.reverse().flat()
  const byName = new Map(tables.map(table => [table.name, table]))
  return [...views, ...orderedNames.map(name => byName.get(name))]
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

function expectedMigrations(directory) {
  return readdirSync(join(ROOT, directory))
    .filter(name => name.endsWith('.sql'))
    .sort()
}

function printPlan(environment, target, objects) {
  console.log(`${environment} D1: ${target.name}`)
  console.log(`Database ID: ${target.id}`)
  console.log(`Application objects to drop: ${objects.length}`)
  for (const object of objects) console.log(`  ${object.type} ${object.name}`)
}

const ENVIRONMENTS = {
  preview: 'env.preview.d1_databases',
  staging: 'env.staging.d1_databases',
  production: 'd1_databases',
}

/**
 * Drops every application object in one environment's D1 database and replays
 * the migration chain from the generated baseline. Preview does this on every
 * CI run before reseeding from production. Staging and production do it only
 * during a rebaseline write freeze (docs/database/migrations.md), immediately
 * before the verified data payload is loaded; the database keeps its name and id.
 */
function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/reset-d1.mjs --env <preview|staging|production> [--apply --confirm <database-id> [--frozen]]')
    return
  }
  const environment = readOption('--env') ?? 'preview'
  if (!(environment in ENVIRONMENTS)) throw new Error(`Unknown environment: ${environment}`)

  const source = readFileSync(WRANGLER_CONFIG, 'utf8')
  const bindings = Object.fromEntries(Object.entries(ENVIRONMENTS).map(([name, heading]) => [name, d1Binding(source, heading)]))
  const target = bindings[environment]
  const others = Object.entries(bindings).filter(([name]) => name !== environment)
  if (others.some(([, binding]) => binding.id === target.id)) {
    throw new Error(`Refusing reset: ${environment} database ID is shared with another environment`)
  }
  if (environment === 'preview' && !/preview/i.test(target.name)) {
    throw new Error(`Refusing reset: configured database name is not preview (${target.name})`)
  }

  const objects = orderForDrop(queryRows(
    target.name, environment,
    "SELECT name, type, sql FROM sqlite_schema WHERE type IN ('table', 'view')",
  ).filter(isApplicationObject))
  printPlan(environment, target, objects)

  if (!process.argv.includes('--apply')) {
    console.log(`Dry run only. Apply with: node scripts/reset-d1.mjs --env ${environment} --apply --confirm ${target.id}${environment === 'preview' ? '' : ' --frozen'}`)
    return
  }
  const confirmation = readOption('--confirm')
  const ciConfirmation = environment === 'preview' && process.env.CI === 'true'
    && process.argv.includes('--confirm-configured-preview')
  if (confirmation !== target.id && !ciConfirmation) {
    throw new Error(`Refusing reset: --confirm must exactly match the configured ${environment} database ID`)
  }
  // A shared environment loses every row here. The operator states that the
  // maintenance deployment with DB_WRITE_FROZEN is live and the frozen export is
  // in hand; the transfer payload is loaded right after this script.
  if (environment !== 'preview' && !process.argv.includes('--frozen')) {
    throw new Error(`Refusing reset: ${environment} may only be reset during a write freeze; pass --frozen once the maintenance deployment is live`)
  }

  const execute = command => runWrangler(['d1', 'execute', target.name, ...envArgs(environment), '--remote', '--command', command])
  execute(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(RESET_SENTINEL)} (id INTEGER PRIMARY KEY)`)
  execute([
    'PRAGMA defer_foreign_keys=ON;',
    ...objects.map(object => `DROP ${object.type.toUpperCase()} IF EXISTS ${quoteIdentifier(object.name)};`),
    'PRAGMA defer_foreign_keys=OFF;',
  ].join('\n'))

  const remaining = queryRows(target.name, environment, 'PRAGMA table_list').filter(isApplicationObject)
  if (remaining.length) {
    throw new Error(`Reset left application objects: ${remaining.map(row => row.name).join(', ')}`)
  }

  runWrangler(['d1', 'migrations', 'apply', target.name, ...envArgs(environment), '--remote'])

  const applied = queryRows(target.name, environment, 'SELECT name FROM d1_migrations ORDER BY name')
    .map(row => row.name)
  const expected = expectedMigrations(target.migrationsDir)
  if (JSON.stringify(applied) !== JSON.stringify(expected)) {
    throw new Error(`Migration ledger mismatch: expected ${expected.length}, found ${applied.length}`)
  }
  const foreignKeyFailures = queryRows(target.name, environment, 'PRAGMA foreign_key_check')
  if (foreignKeyFailures.length) {
    throw new Error(`Foreign key check failed: ${JSON.stringify(foreignKeyFailures)}`)
  }
  execute(`DROP TABLE ${quoteIdentifier(RESET_SENTINEL)}`)
  console.log(`Reset complete: ${environment} replayed ${basename(target.migrationsDir)} with ${applied.length} migration(s)`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
