#!/usr/bin/env node
// Every .vue file parses and its template compiles.
//
// ESLint and vue-tsc both pass on a single-file component whose template or
// script block is not closed: ESLint's Vue parser recovers, and vue-tsc reads
// the blocks it can find rather than the file's shape. A splice that dropped a
// `</script>` shipped through both and only failed when the page was loaded,
// as a 500 at request time.
//
// This is the check that catches it, and it is cheap: parse each component and
// compile its template.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse, compileTemplate } from 'vue/compiler-sfc'

const ROOT = process.cwd()
const ROOTS = ['app', 'components', 'layouts', 'lib', 'pages']
const SKIP = new Set(['node_modules', '.nuxt', '.output', '.tmp', '.git', 'dist', '.claude', '.scratch', '.agents'])

function collect(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) collect(path, found)
    else if (entry.endsWith('.vue')) found.push(path)
  }
  return found
}

const files = ROOTS
  .map(dir => join(ROOT, dir))
  .filter((dir) => { try { return statSync(dir).isDirectory() } catch { return false } })
  .flatMap(dir => collect(dir))

const failures = []

for (const file of files) {
  const name = relative(ROOT, file)
  const source = readFileSync(file, 'utf8')

  const { descriptor, errors } = parse(source, { filename: file })
  for (const error of errors) failures.push(`${name}: ${error.message}`)
  if (errors.length) continue

  // An unclosed block leaves the parser with no block at all rather than a
  // broken one, so absence is the symptom worth naming.
  if (!descriptor.template && !descriptor.script && !descriptor.scriptSetup) {
    failures.push(`${name}: no <template> or <script> block — check the file's tags are closed`)
    continue
  }

  if (descriptor.template) {
    const compiled = compileTemplate({
      id: name,
      filename: file,
      source: descriptor.template.content,
      compilerOptions: { expressionPlugins: ['typescript'] },
    })
    for (const error of compiled.errors) {
      failures.push(`${name}: ${typeof error === 'string' ? error : error.message}`)
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`not ok  ${failure}`)
  console.error(`\n${failures.length} single-file component(s) failed to parse.`)
  process.exit(1)
}

console.log(`ok  ${files.length} single-file components parse and compile`)
