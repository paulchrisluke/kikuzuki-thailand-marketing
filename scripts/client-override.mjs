#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const { values: args } = parseArgs({
  options: {
    slug: { type: 'string' },
    'place-id': { type: 'string' },
    set: { type: 'string', multiple: true, default: [] },
    unset: { type: 'string', multiple: true, default: [] },
    list: { type: 'boolean', default: false },
  },
})
if (!args.slug || !/^[a-zA-Z0-9_-]+$/.test(args.slug)) throw new Error('--slug is required and must be a valid import slug')
const directory = join(process.cwd(), 'client-imports', args.slug)
const overridesPath = join(directory, 'overrides.json')
const approvedPath = join(directory, 'approved.json')
const overrides = existsSync(overridesPath) ? JSON.parse(await readFile(overridesPath, 'utf8')) : {}
if (args.list) {
  console.log(JSON.stringify(overrides, null, 2))
  process.exit(0)
}
const placeId = args['place-id']?.trim()
if (!placeId) throw new Error('--place-id is required for a location correction')
const manifest = JSON.parse(await readFile(join(directory, 'client-manifest.json'), 'utf8'))
if (!manifest.locations.some(location => location.place_id === placeId)) throw new Error('--place-id must identify a location in the reviewed import manifest')
const supported = new Set(['phone', 'address', 'title', 'website', 'email', 'lat', 'lng'])
const fields = overrides[placeId] ?? {}
for (const pair of args.set) {
  const split = pair.indexOf('=')
  const key = pair.slice(0, split).trim()
  if (split < 1 || !supported.has(key)) throw new Error(`Invalid override: ${pair}`)
  fields[key] = { value: pair.slice(split + 1).trim(), set_at: new Date().toISOString() }
}
for (const key of args.unset) {
  if (!supported.has(key)) throw new Error(`Unknown override field: ${key}`)
  delete fields[key]
}
if (Object.keys(fields).length) overrides[placeId] = fields
else delete overrides[placeId]
await mkdir(directory, { recursive: true })
await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`)
if (existsSync(approvedPath)) await unlink(approvedPath)
console.log('Corrections saved. Regenerate and review the import before approval.')
