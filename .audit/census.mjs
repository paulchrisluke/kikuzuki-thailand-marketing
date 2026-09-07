import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { createHash } from 'node:crypto'
import Database from 'better-sqlite3'

const [sourcePath, outputPath] = process.argv.slice(2)
const source = new Database(':memory:')
source.pragma('foreign_keys = OFF')
source.exec(readFileSync(sourcePath, 'utf8'))
const baseline = new Database(':memory:')
for (const file of readdirSync('migrations').filter(file => file.endsWith('.sql')).sort()) {
  baseline.exec(readFileSync(resolve('migrations', file), 'utf8'))
}
const quote = name => `"${name.replaceAll('"', '""')}"`
function schema(db) {
  return db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND tbl_name != 'd1_migrations' ORDER BY type, name").all()
}
const report = {
  source_file: basename(sourcePath),
  observed_at: new Date().toISOString(),
  foreign_key_violations: source.pragma('foreign_key_check').length,
  schema: schema(source),
  baseline_schema: schema(baseline),
  tables: [],
}
for (const { name } of source.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY name").all()) {
  const rows = source.prepare(`SELECT * FROM ${quote(name)}`).all()
  const columns = source.pragma(`table_info(${quote(name)})`)
  const names = columns.map(column => column.name).sort()
  report.tables.push({
    name,
    row_count: rows.length,
    logical_hash: createHash('sha256').update(rows.map(row => JSON.stringify(names.map(key => row[key]))).sort().join('\n')).digest('hex'),
    columns: columns.map(column => ({
      ...column,
      null_count: rows.filter(row => row[column.name] === null).length,
      storage_types: source.prepare(`SELECT typeof(${quote(column.name)}) type, count(*) count FROM ${quote(name)} GROUP BY 1 ORDER BY 1`).all(),
    })),
    foreign_keys: source.pragma(`foreign_key_list(${quote(name)})`),
    indexes: source.pragma(`index_list(${quote(name)})`).map(index => ({ ...index, columns: source.pragma(`index_xinfo(${quote(index.name)})`) })),
  })
}
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
const defaultedNullable = report.tables.flatMap(table => table.columns.filter(column => column.notnull === 0 && column.dflt_value !== null).map(column => ({ table: table.name, column: column.name, null_count: column.null_count })))
console.log(JSON.stringify({ tables: report.tables.length, columns: report.tables.reduce((sum, table) => sum + table.columns.length, 0), foreign_key_violations: report.foreign_key_violations, defaulted_nullable: defaultedNullable }, null, 2))
