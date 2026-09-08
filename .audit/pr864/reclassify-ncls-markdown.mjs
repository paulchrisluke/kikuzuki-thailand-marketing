import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { nclsFixture } from '../../seed-definitions/ncls.ts'
import { editorModeFor } from '../../shared/markdown-editor-mode.ts'
const path='seed-definitions/ncls.ts'
let source=readFileSync(path,'utf8')
const blocks=nclsFixture.tables.find(table=>table.table==='content_blocks')
assert(blocks)
let sourceBlocks=0,reclassified=0
for(const row of blocks.rows) {
 if(row.type!=='markdown')continue
 const data=JSON.parse(row.data_json)
 if(data.editor_mode!=='source')continue
 sourceBlocks++
 assert.equal(typeof data.markdown,'string')
 if(editorModeFor(data.markdown)==='source')continue
 const changed=row.data_json.replace('"editor_mode":"source"','"editor_mode":"rich"')
 assert.notEqual(changed,row.data_json)
 const parsed=JSON.parse(changed)
 assert.deepEqual({...parsed,editor_mode:'source'},data)
 const before=`"data_json": ${JSON.stringify(row.data_json)}`
 const after=`"data_json": ${JSON.stringify(changed)}`
 assert(source.includes(before))
 source=source.replace(before,after)
 reclassified++
}
writeFileSync(path,source)
console.log(JSON.stringify({sourceBlocks,reclassified,retainedSource:sourceBlocks-reclassified}))
