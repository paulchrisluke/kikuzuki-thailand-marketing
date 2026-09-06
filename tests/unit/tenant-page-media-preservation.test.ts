import assert from 'node:assert/strict'
import test from 'node:test'
import { preserveOmittedBlockMedia } from '../../server/utils/tenant-pages.ts'
import type { TenantPageBlock } from '../../utils/tenant-page-blocks.ts'

// Regression coverage for the tenant-page block-media preservation boundary
// the audit confirmed is already correct: a text-only update (a block payload
// with no `media` key at all) must keep that block's existing media, while an
// explicit `media: []` (the key present, deliberately empty) must clear it.
test('preserveOmittedBlockMedia restores existing media only when the key is entirely absent', () => {
  const existingBlocks: TenantPageBlock[] = [
    {
      id: 'hero-1',
      type: 'hero',
      position: 0,
      data: {},
      media: [{ asset_id: 'asset-1', slot: 'media', sort_order: 0 }],
    },
  ]

  const textOnlyUpdate = preserveOmittedBlockMedia(
    [{ id: 'hero-1', type: 'hero', data: { alt: 'Updated copy' } }],
    existingBlocks,
  )
  assert.deepEqual(textOnlyUpdate, [
    { id: 'hero-1', type: 'hero', data: { alt: 'Updated copy' }, media: [{ asset_id: 'asset-1', slot: 'media', sort_order: 0 }] },
  ])

  const explicitClear = preserveOmittedBlockMedia(
    [{ id: 'hero-1', type: 'hero', data: { alt: 'Updated copy' }, media: [] }],
    existingBlocks,
  )
  assert.deepEqual(explicitClear, [
    { id: 'hero-1', type: 'hero', data: { alt: 'Updated copy' }, media: [] },
  ])

  const result = preserveOmittedBlockMedia(
    [{ id: 'new-block', type: 'markdown', data: { markdown: 'Hello' } }],
    [],
  )
  assert.deepEqual(result, [{ id: 'new-block', type: 'markdown', data: { markdown: 'Hello' } }])
})
