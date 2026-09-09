import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSocialCardGenerationKey,
  selectSocialCardPlacements,
  type SocialCardPlacedAsset,
} from '../../server/utils/social-card.ts'

const placedAsset = (
  owner_type: string,
  owner_id: string,
  slot: string,
  asset_id: string,
): SocialCardPlacedAsset => ({
  owner_type,
  owner_id,
  slot,
  asset_id,
  public_url: `https://img.example/${asset_id}.png`,
  thumbnail_url: null,
  kind: 'image',
  updated_at: '2026-08-29T00:00:00.000Z',
  generation_key: slot === 'social_card' ? `key-${asset_id}` : null,
  source: slot === 'social_card' ? 'generated' : 'uploaded',
})

test('social card source selection uses only media placed on the page owner', () => {
  const selected = selectSocialCardPlacements([
    placedAsset('site', 'site-1', 'social_card', 'site-card'),
    placedAsset('business_location', 'location-1', 'social_card', 'owner-card'),
    placedAsset('business_location', 'location-1', 'hero', 'owner-hero'),
    placedAsset('site', 'site-1', 'social_share', 'site-share'),
  ], { owner_type: 'business_location', owner_id: 'location-1' }, 'site-1')
  assert.equal(selected.current?.asset_id, 'owner-card')
  assert.equal(selected.source?.asset_id, 'owner-hero')
  assert.equal(selectSocialCardPlacements([
    placedAsset('site', 'site-1', 'logo', 'site-logo'),
    placedAsset('site', 'site-1', 'social_share', 'site-share'),
  ], { owner_type: 'site', owner_id: 'site-1' }, 'site-1').source?.asset_id, 'site-share')
  assert.equal(selectSocialCardPlacements([
    placedAsset('site', 'site-1', 'logo', 'site-logo'),
  ], { owner_type: 'site', owner_id: 'site-1' }, 'site-1').source, null)
  const video = { ...placedAsset('content_document', 'post-1', 'cover', 'video-1'), kind: 'video' as const, thumbnail_url: 'https://img.example/poster.png' }
  assert.equal(selectSocialCardPlacements([video], { owner_type: 'content_document', owner_id: 'post-1' }, 'site-1').source?.thumbnail_url, video.thumbnail_url)
  assert.equal(selectSocialCardPlacements([{ ...video, thumbnail_url: null }], { owner_type: 'content_document', owner_id: 'post-1' }, 'site-1').source, null)
})

test('an article social card derives from its leading image block', () => {
  const owner = { owner_type: 'content_document' as const, owner_id: 'article-1' }
  const assets = [
    placedAsset('content_document', 'article-1', 'gallery', 'gallery-1'),
    placedAsset('content_block', 'lead-block', 'media', 'cover-1'),
    placedAsset('content_block', 'other-block', 'media', 'body-1'),
  ]
  assert.equal(selectSocialCardPlacements(assets, owner, 'site-1', 'lead-block').source?.asset_id, 'cover-1')
  // Without a leading image block nothing in the body stands in for the cover.
  assert.equal(selectSocialCardPlacements(assets, owner, 'site-1', null).source?.asset_id, 'gallery-1')
  assert.equal(selectSocialCardPlacements(assets.filter(item => item.owner_type !== 'content_document'), owner, 'site-1', null).source, null)
})

test('social card generation keys change when a byte-producing source changes', () => {
  const base = {
    logoAssetId: 'logo-1',
    payload: { template: 'saya' as const, title: 'Site', siteName: 'Site', backgroundImageUrl: 'https://img.example/background.png' },
  }
  assert.notEqual(
    buildSocialCardGenerationKey({ ...base, sourceAssetId: 'source-1' }),
    buildSocialCardGenerationKey({ ...base, sourceAssetId: 'source-2' }),
  )
  assert.notEqual(
    buildSocialCardGenerationKey({ ...base, sourceAssetId: 'source-1', sourceUpdatedAt: '2026-09-06T00:00:00Z' }),
    buildSocialCardGenerationKey({ ...base, sourceAssetId: 'source-1', sourceUpdatedAt: '2026-09-06T01:00:00Z' }),
  )
})
