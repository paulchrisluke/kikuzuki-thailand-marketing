import assert from 'node:assert/strict'
import test from 'node:test'
import databaseWriteFreezeMiddleware from '../../server/middleware/00.database-write-freeze.ts'
import { isDatabaseWriteFrozen, retryFrozenQueueBatch } from '../../server/utils/database-write-freeze.ts'

test('database write freeze is enabled only by the exact true flag', () => {
  assert.equal(isDatabaseWriteFrozen(undefined), false)
  assert.equal(isDatabaseWriteFrozen({}), false)
  assert.equal(isDatabaseWriteFrozen({ DB_WRITE_FROZEN: 'false' }), false)
  assert.equal(isDatabaseWriteFrozen({ DB_WRITE_FROZEN: 'TRUE' }), false)
  assert.equal(isDatabaseWriteFrozen({ DB_WRITE_FROZEN: 'true' }), true)
})

test('frozen queue batches are retried with a delay instead of being processed', () => {
  const calls: unknown[] = []
  const batch = {
    retryAll(options?: unknown) {
      calls.push(options)
    },
  }

  assert.equal(retryFrozenQueueBatch({}, batch), false)
  assert.deepEqual(calls, [])
  assert.equal(retryFrozenQueueBatch({ DB_WRITE_FROZEN: 'true' }, batch), true)
  assert.deepEqual(calls, [{ delaySeconds: 300 }])
})

const frozenEvent = (env: Record<string, string>, method: string) => ({ req: { method, runtime: { cloudflare: { env } } } })

test('a write freeze refuses mutations with a non-cacheable maintenance response and keeps reads serving', async () => {
  const response = await databaseWriteFreezeMiddleware(frozenEvent({ DB_WRITE_FROZEN: 'true' }, 'POST') as never) as Response
  assert.equal(response.status, 503)
  assert.equal(await databaseWriteFreezeMiddleware(frozenEvent({ DB_WRITE_FROZEN: 'true' }, 'GET') as never), undefined)
  assert.equal(await databaseWriteFreezeMiddleware(frozenEvent({ DB_WRITE_FROZEN: 'true' }, 'HEAD') as never), undefined)
  assert.equal(((await databaseWriteFreezeMiddleware(frozenEvent({ DB_WRITE_FROZEN: 'true' }, 'PATCH') as never)) as Response).status, 503)
})

test('maintenance refuses every request, reads included', async () => {
  const response = await databaseWriteFreezeMiddleware(frozenEvent({ DB_MAINTENANCE: 'true' }, 'GET') as never) as Response
  assert.equal(response.status, 503)
  assert.equal(isDatabaseWriteFrozen({ DB_MAINTENANCE: 'true' }), true)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('retry-after'), '300')
  assert.deepEqual(await response.json(), {
    error: 'Service temporarily unavailable during database maintenance',
  })
})

test('HTTP requests continue normally when the freeze is disabled', async () => {
  const event = {
    req: {
      runtime: {
        cloudflare: {
          env: {},
        },
      },
    },
  }

  assert.equal(await databaseWriteFreezeMiddleware(event as never), undefined)
})
