import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const run = promisify(execFile)
const baselinePath = process.argv[2] ?? '.audit/pr864/current-comment-index.json'
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
if (!Array.isArray(baseline.comments)) throw new Error('Baseline must contain a comments array')
const endpoints = [
  ['issue-comments', 'repos/paulchrisluke/krabiclaw/issues/864/comments'],
  ['review-comments', 'repos/paulchrisluke/krabiclaw/pulls/864/comments'],
  ['reviews', 'repos/paulchrisluke/krabiclaw/pulls/864/reviews'],
]
const batches = await Promise.all(endpoints.map(async ([type, endpoint]) => {
  const { stdout } = await run('gh', ['api', '--paginate', '--slurp', endpoint], { maxBuffer: 32 * 1024 * 1024 })
  const pages = JSON.parse(stdout)
  if (!Array.isArray(pages) || pages.some(page => !Array.isArray(page))) throw new Error('Unexpected paginated response for ' + endpoint)
  return pages.flat().map(comment => {
    if (!Number.isSafeInteger(comment.id) || typeof comment.user?.login !== 'string' || typeof comment.body !== 'string') {
      throw new Error('Invalid comment record from ' + endpoint)
    }
    return {
      type, id: comment.id, author: comment.user.login, createdAt: comment.created_at,
      updated: type === 'reviews' ? comment.submitted_at : comment.updated_at,
      sha256: createHash('sha256').update(comment.body).digest('hex'), body: comment.body, url: comment.html_url,
    }
  })
}))
const current = { retrievedAt: new Date().toISOString(), baselinePath, comments: batches.flat() }
const key = comment => comment.type + ':' + comment.id
const oldByKey = new Map(baseline.comments.map(comment => [key(comment), comment]))
const newByKey = new Map(current.comments.map(comment => [key(comment), comment]))
const changes = []
for (const comment of current.comments) {
  const old = oldByKey.get(key(comment))
  if (!old || old.sha256 !== comment.sha256 || old.updated !== comment.updated) changes.push({
    kind: !old ? 'added' : old.sha256 !== comment.sha256 ? 'body-edited' : 'timestamp-changed',
    type: comment.type, id: comment.id, author: comment.author, url: comment.url,
    previousHash: old?.sha256, currentHash: comment.sha256, previousUpdated: old?.updated, currentUpdated: comment.updated,
  })
}
for (const comment of baseline.comments) {
  if (!newByKey.has(key(comment))) changes.push({ kind: 'removed', type: comment.type, id: comment.id,
    author: comment.author, url: comment.url, previousHash: comment.sha256 })
}
const report = { retrievedAt: current.retrievedAt, baselinePath, counts: Object.fromEntries(batches.map((batch, index) => [endpoints[index][0], batch.length])),
  requiresReview: changes.length > 0, ownerChanges: changes.filter(change => change.author === 'paulchrisluke'), changes }
const stamp = current.retrievedAt.replaceAll(':', '-').replaceAll('.', '-')
const prefix = '.audit/pr864/comment-refresh-' + stamp
writeFileSync(prefix + '.json', JSON.stringify(current, null, 2) + '\n')
writeFileSync(prefix + '-diff.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ ...report, snapshot: prefix + '.json', comparison: prefix + '-diff.json' }, null, 2))
process.exitCode = report.requiresReview ? 2 : 0
