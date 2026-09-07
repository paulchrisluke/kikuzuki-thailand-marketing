import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'

const baseline = readFileSync(resolve(process.argv[2] ?? 'migrations/0000_epoch_5_baseline.sql'))
const db = new DatabaseSync(':memory:')
db.exec(baseline.toString('utf8'))
const quote = value => '"' + value.replaceAll('"', '""') + '"'
const tables = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(table => ({
  ...table,
  columns: db.prepare('PRAGMA table_info(' + quote(table.name) + ')').all(),
  foreign_keys: db.prepare('PRAGMA foreign_key_list(' + quote(table.name) + ')').all(),
  indexes: db.prepare('PRAGMA index_list(' + quote(table.name) + ')').all().map(index => ({
    ...index,
    columns: db.prepare('PRAGMA index_info(' + quote(index.name) + ')').all(),
    sql: db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(index.name)?.sql ?? null,
  })),
}))
const columns = tables.flatMap(table => table.columns.map(column => [
  table.name, column.name, column.type, column.notnull, column.dflt_value, column.pk,
  table.indexes.filter(index => index.columns.some(value => value.name === column.name)).map(index => index.sql ?? index.name).join('; '),
  table.foreign_keys.filter(key => key.from === column.name).map(key => 'group ' + key.id + ' ' + key.from + ' -> ' + key.table + '.' + key.to + ' ON DELETE ' + key.on_delete).join('; '),
]))
const cell = value => String(value ?? '').replaceAll('\t', ' ').replaceAll('\r', ' ').replaceAll('\n', ' ')
writeFileSync('.audit/829-target-schema.json', JSON.stringify(tables, null, 2) + '\n')
writeFileSync('.audit/829-target-columns.tsv', [['table', 'column', 'type', 'not_null', 'default', 'primary_key', 'indexes', 'foreign_keys'], ...columns].map(row => row.map(cell).join('\t')).join('\n') + '\n')
db.close()
console.log(JSON.stringify({ baseline_sha256: createHash('sha256').update(baseline).digest('hex'), tables: tables.length, columns: columns.length }))
