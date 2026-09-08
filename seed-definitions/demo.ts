import { postPublicPath } from '../utils/post-slugs.ts'
import { markdownToContentBlocks } from '../shared/markdown-content-blocks.ts'
import { compileCuratedSiteFixture } from './compile.ts'
import type { CuratedProductDefinition, CuratedSiteDefinition } from './contracts.ts'
import { buildSeedExperienceCategories, buildSeedProductCategories } from './contracts.ts'
import { renderOrganizationBillingSql } from './billing-sql.ts'
import { renderTenantPagesSeedSql } from './tenant-pages.ts'

const DEMO_TIMEZONE = 'America/New_York'

function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}

function sqlValue(value: string | number | boolean | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${escapeSql(value)}'`
}

function sqlJson(value: unknown): string {
  return sqlValue(JSON.stringify(value))
}

function productsAtLocation(
  locationId: string,
  products: Array<Omit<CuratedProductDefinition, 'locationId'>>,
): CuratedProductDefinition[] {
  return products.map((product, sortOrder) => ({ ...product, locationId, sortOrder }))
}

export const demoFixture: CuratedSiteDefinition = {
  fixtureId: 'demo',
  organizationId: 'org-demo',
  siteId: 'site-demo',
  site: {
    slug: 'ember-slice-demo',
    subdomain: 'demo',
    brandName: 'Ember & Slice',
    themeId: 'saya-theme-v1',
    brandDescription:
      'A Brooklyn wood-fired trattoria serving blistered pies, seasonal antipasti, and easy neighborhood hospitality.',
    status: 'active',
    onboardingStatus: 'active',
    contactEmail: 'hello@emberandslice.example',
    defaultCurrency: 'USD',
    vertical: 'restaurant',
    media: [{ asset_id: 'media-demo-logo', slot: 'logo' }],
  },
  settings: {
    "config": {
      "default_timezone": DEMO_TIMEZONE,
      "brand_color": "#C2410C"
    }
  },
  siteLocales: [
    {
      id: 'locale::org-demo::site-demo::en',
      locale: 'en',
      label: 'English',
      isSource: true,
      status: 'published',
    },
    {
      id: 'locale::org-demo::site-demo::th',
      locale: 'th',
      label: 'ไทย',
      isSource: false,
      status: 'published',
    },
  ],
  siteDomains: [
    {
      id: 'domain-demo-prod',
      domain: 'demo.krabiclaw.com',
      type: 'subdomain',
      role: 'canonical',
      status: 'active',
      dnsStatus: 'valid',
    },
  ],
  locations: [
    {
      id: 'loc-demo',
      slug: 'brooklyn',
      title: 'Ember & Slice Brooklyn',
      city: 'Brooklyn',
      address: {
        addressLines: ['184 Wythe Ave'],
        locality: 'Brooklyn',
        administrativeArea: 'NY',
        postalCode: '11249',
        country: 'US',
      },
      phone: '(718) 555-0148',
      email: 'hello@emberandslice.example',
      mapsUrl: 'https://maps.app.goo.gl/ember-slice-brooklyn',
      latitude: 40.7193,
      longitude: -73.9618,
      description:
        'A Brooklyn wood-fired trattoria built around blistered sourdough pies, bright antipasti, and an open oven that runs from lunch through late dinner.',
      shortDescription:
        'Wood-fired pizza, seasonal antipasti, and warm neighborhood hospitality in Brooklyn.',
      openingHours: { periods: [
        { open: { day: 1, hour: 12, minute: 0 }, close: { day: 1, hour: 22, minute: 0 } },
        { open: { day: 2, hour: 12, minute: 0 }, close: { day: 2, hour: 22, minute: 0 } },
        { open: { day: 3, hour: 12, minute: 0 }, close: { day: 3, hour: 22, minute: 0 } },
        { open: { day: 4, hour: 12, minute: 0 }, close: { day: 4, hour: 22, minute: 0 } },
        { open: { day: 5, hour: 12, minute: 0 }, close: { day: 5, hour: 23, minute: 0 } },
        { open: { day: 6, hour: 11, minute: 0 }, close: { day: 6, hour: 23, minute: 0 } },
        { open: { day: 0, hour: 11, minute: 0 }, close: { day: 0, hour: 21, minute: 0 } },
      ] },
      rating: 4.8,
      reviewCount: 188,
      priceLevel: '$$',
      categories: ['Pizza', 'Italian Restaurant', 'Wood-fired Trattoria'],
      instagramUrl: 'https://instagram.com/emberandslice',
      facebookUrl: 'https://facebook.com/emberandslice',
      status: 'active',
      media: [
        { asset_id: 'media-demo-pizza-prep-video', slot: 'hero' },
        { asset_id: 'media-demo-hero', slot: 'gallery' },
        { asset_id: 'media-demo-ext-1', slot: 'gallery' },
        { asset_id: 'media-demo-ext-2', slot: 'gallery' },
        { asset_id: 'media-demo-int-1', slot: 'gallery' },
        { asset_id: 'media-demo-int-2', slot: 'gallery' },
        { asset_id: 'media-demo-int-3', slot: 'gallery' },
        { asset_id: 'media-demo-team-1', slot: 'gallery' },
      ],
    },
    {
      id: 'loc-demo-2',
      slug: 'west-village',
      title: 'Ember & Slice West Village',
      city: 'New York',
      address: {
        addressLines: ['100 7th Ave S'],
        locality: 'New York',
        administrativeArea: 'NY',
        postalCode: '10014',
        country: 'US',
      },
      phone: '(212) 555-0199',
      email: 'hello@emberandslice.example',
      mapsUrl: 'https://maps.app.goo.gl/ember-slice-west-village',
      latitude: 40.7335,
      longitude: -74.0027,
      description:
        'Our signature wood-fired pies and warm hospitality, brought to the heart of the West Village.',
      shortDescription:
        'Wood-fired pizza, seasonal antipasti, and neighborhood hospitality in the West Village.',
      openingHours: { periods: [
        { open: { day: 1, hour: 16, minute: 0 }, close: { day: 1, hour: 23, minute: 0 } },
        { open: { day: 2, hour: 16, minute: 0 }, close: { day: 2, hour: 23, minute: 0 } },
        { open: { day: 3, hour: 16, minute: 0 }, close: { day: 3, hour: 23, minute: 0 } },
        { open: { day: 4, hour: 16, minute: 0 }, close: { day: 4, hour: 23, minute: 0 } },
        { open: { day: 5, hour: 15, minute: 0 }, close: { day: 5, hour: 23, minute: 59 } },
        { open: { day: 6, hour: 15, minute: 0 }, close: { day: 6, hour: 23, minute: 59 } },
        { open: { day: 0, hour: 15, minute: 0 }, close: { day: 0, hour: 23, minute: 0 } },
      ] },
      rating: 4.9,
      reviewCount: 112,
      priceLevel: '$$',
      categories: ['Pizza', 'Italian Restaurant', 'Trattoria'],
      instagramUrl: 'https://instagram.com/emberandslice',
      facebookUrl: 'https://facebook.com/emberandslice',
      status: 'active',
      media: [
        { asset_id: 'media-demo2-hero', slot: 'hero' },
        { asset_id: 'media-demo2-int-1', slot: 'gallery' },
      ],
    },
  ],
  mediaAssets: [
    {
      id: 'media-demo-logo',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'ce8fc9b5-9e87-4bbd-2ac0-120d1c544000',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/ce8fc9b5-9e87-4bbd-2ac0-120d1c544000/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/ce8fc9b5-9e87-4bbd-2ac0-120d1c544000/thumbnail',
      mimeType: 'image/png',
      fileName: 'ember-slice-logo.png',
      altText: 'Ember & Slice logo',
      category: 'other',
    },
    // Loc-demo: hero + video assets
    {
      id: 'media-demo-hero',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '0762ea49-0bd2-4cc8-1044-d6c9b1f00100',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/0762ea49-0bd2-4cc8-1044-d6c9b1f00100/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/0762ea49-0bd2-4cc8-1044-d6c9b1f00100/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'wood-fired-pizza-hero.jpg',
      altText: 'Wood-fired pizza with blistered crust',
      category: 'food',
    },
    {
      id: 'media-demo-margherita-video',
      kind: 'video',
      provider: 'cloudflare_r2',
      source: 'uploaded',
      r2Key: 'sites/site-demo/media/media-demo-margherita-video.mp4',
      cloudflareImageId: '5c517683-419a-47f4-a463-7c287991e400',
      publicUrl: 'https://media.krabiclaw.com/sites/site-demo/media/media-demo-margherita-video.mp4',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/5c517683-419a-47f4-a463-7c287991e400/public',
      mimeType: 'video/mp4',
      fileName: 'krabiclaw-demo-pizza-cutting.mp4',
      altText: 'Fresh Margherita pizza being cut',
      category: 'food',
    },
    {
      id: 'media-demo-pizza-prep-video',
      kind: 'video',
      provider: 'cloudflare_r2',
      source: 'uploaded',
      r2Key: 'sites/site-demo/media/media-demo-pizza-prep-video.mp4',
      cloudflareImageId: '2ebbddca-348d-4409-a411-17a003e1a500',
      publicUrl: 'https://media.krabiclaw.com/sites/site-demo/media/media-demo-pizza-prep-video.mp4',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/2ebbddca-348d-4409-a411-17a003e1a500/public',
      mimeType: 'video/mp4',
      fileName: 'krabiclaw-demo-pizza-prep.mp4',
      altText: 'Pizza dough being prepared and wood-fired',
      category: 'interior',
    },
    // Loc-demo: exterior
    {
      id: 'media-demo-ext-1',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '6ad28d44-8997-46b8-3a06-87833c65c000',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/6ad28d44-8997-46b8-3a06-87833c65c000/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/6ad28d44-8997-46b8-3a06-87833c65c000/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'brooklyn-storefront.jpg',
      altText: 'Neighborhood restaurant storefront',
      category: 'exterior',
    },
    {
      id: 'media-demo-ext-2',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'e7db135b-cd81-4b15-aa22-a07f24d0b900',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/e7db135b-cd81-4b15-aa22-a07f24d0b900/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/e7db135b-cd81-4b15-aa22-a07f24d0b900/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'evening-entrance.jpg',
      altText: 'Warm trattoria entrance at night',
      category: 'exterior',
    },
    // Loc-demo: interior
    {
      id: 'media-demo-int-1',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'fd99958c-6feb-47da-3040-bf5c56705e00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/fd99958c-6feb-47da-3040-bf5c56705e00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/fd99958c-6feb-47da-3040-bf5c56705e00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'dining-room.jpg',
      altText: 'Cozy Brooklyn dining room',
      category: 'interior',
    },
    {
      id: 'media-demo-int-2',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '03e7f501-7689-4607-3acb-ec6f0d958500',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/03e7f501-7689-4607-3acb-ec6f0d958500/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/03e7f501-7689-4607-3acb-ec6f0d958500/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'oven-counter.jpg',
      altText: 'Open kitchen counter near the oven',
      category: 'interior',
    },
    {
      id: 'media-demo-int-3',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '01f1ec1c-1440-41d1-5323-1cf279b10600',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/01f1ec1c-1440-41d1-5323-1cf279b10600/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/01f1ec1c-1440-41d1-5323-1cf279b10600/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'table-service.jpg',
      altText: 'Table set for trattoria service',
      category: 'interior',
    },
    // Loc-demo: team
    {
      id: 'media-demo-team-1',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'b877d25c-e835-48b8-1faf-00e0c4614000',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/b877d25c-e835-48b8-1faf-00e0c4614000/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/b877d25c-e835-48b8-1faf-00e0c4614000/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'pizza-team.jpg',
      altText: 'Ember & Slice kitchen team',
      category: 'team',
    },
    // Loc-demo: menu food
    {
      id: 'media-demo-margherita',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '59e0fb6a-06dc-400c-9b38-5cd2d957bd00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/59e0fb6a-06dc-400c-9b38-5cd2d957bd00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/59e0fb6a-06dc-400c-9b38-5cd2d957bd00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'margherita.jpg',
      altText: 'Margherita pizza with basil',
      category: 'food',
    },
    {
      id: 'media-demo-pepperoni',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '0d5c6306-8783-475c-ae49-d40be5783c00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/0d5c6306-8783-475c-ae49-d40be5783c00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/0d5c6306-8783-475c-ae49-d40be5783c00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'pepperoni-calabrese.jpg',
      altText: 'Pepperoni Calabrese pizza',
      category: 'food',
    },
    {
      id: 'media-demo-funghi',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'a352e160-d8b2-443f-a539-0c585f1fda00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/a352e160-d8b2-443f-a539-0c585f1fda00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/a352e160-d8b2-443f-a539-0c585f1fda00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'funghi-bianco.jpg',
      altText: 'Mushroom white pizza',
      category: 'food',
    },
    {
      id: 'media-demo-burrata',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'cca97463-0109-4ea6-60dd-64001fd87d00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/cca97463-0109-4ea6-60dd-64001fd87d00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/cca97463-0109-4ea6-60dd-64001fd87d00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'burrata.jpg',
      altText: 'Burrata with tomatoes and herbs',
      category: 'food',
    },
    {
      id: 'media-demo-knots',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'af94834c-67b7-4dc9-a893-564ffcd2cf00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/af94834c-67b7-4dc9-a893-564ffcd2cf00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/af94834c-67b7-4dc9-a893-564ffcd2cf00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'garlic-knots.jpg',
      altText: 'Garlic knots with marinara',
      category: 'food',
    },
    {
      id: 'media-demo-soppressata',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '65efc617-c59b-46cb-6165-2c55217ef200',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/65efc617-c59b-46cb-6165-2c55217ef200/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/65efc617-c59b-46cb-6165-2c55217ef200/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'soppressata-hot-honey.jpg',
      altText: 'Soppressata hot honey pizza',
      category: 'food',
    },
    {
      id: 'media-demo-caesar',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'cc5c1e78-a0d0-4a87-e56c-fd9f36645d00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/cc5c1e78-a0d0-4a87-e56c-fd9f36645d00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/cc5c1e78-a0d0-4a87-e56c-fd9f36645d00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'little-gem-caesar.jpg',
      altText: 'Little gem Caesar salad',
      category: 'food',
    },
    {
      id: 'media-demo-rigatoni',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'b3fdb896-a13b-4fc2-1f28-9a3611e9a100',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/b3fdb896-a13b-4fc2-1f28-9a3611e9a100/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/b3fdb896-a13b-4fc2-1f28-9a3611e9a100/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'rigatoni-pomodoro.jpg',
      altText: 'Rigatoni pomodoro',
      category: 'food',
    },
    {
      id: 'media-demo-lemonade',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '9756adb3-1ef3-46cf-aa93-f80495979b00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/9756adb3-1ef3-46cf-aa93-f80495979b00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/9756adb3-1ef3-46cf-aa93-f80495979b00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'sparkling-lemonade.jpg',
      altText: 'Sparkling lemonade',
      category: 'food',
    },
    {
      id: 'media-demo-italian-soda',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'de02de1d-a1cb-48a1-9cbe-c3c383cc9000',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/de02de1d-a1cb-48a1-9cbe-c3c383cc9000/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/de02de1d-a1cb-48a1-9cbe-c3c383cc9000/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'italian-soda.jpg',
      altText: 'Italian soda',
      category: 'food',
    },
    // Loc-demo: post images
    {
      id: 'media-demo-post1',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '294bda34-8a59-4f17-623b-e2a5feec7c00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/294bda34-8a59-4f17-623b-e2a5feec7c00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/294bda34-8a59-4f17-623b-e2a5feec7c00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'post-oven.jpg',
      altText: 'Pizza coming out of the oven',
      category: 'food',
    },
    {
      id: 'media-demo-post2',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '276a3c4d-9bfe-45bd-90e7-85899356f700',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/276a3c4d-9bfe-45bd-90e7-85899356f700/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/276a3c4d-9bfe-45bd-90e7-85899356f700/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'post-dining-room.jpg',
      altText: 'Dining room during dinner service',
      category: 'interior',
    },
    {
      id: 'media-demo-post3',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '1246e510-65ce-4335-1309-0353b47ae100',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/1246e510-65ce-4335-1309-0353b47ae100/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/1246e510-65ce-4335-1309-0353b47ae100/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'post-margherita.jpg',
      altText: 'Margherita pizza special',
      category: 'food',
    },
    // Loc-demo-2: assets
    {
      id: 'media-demo2-hero',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'e3ac3094-6e43-4ffe-7659-67365cc21d00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/e3ac3094-6e43-4ffe-7659-67365cc21d00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/e3ac3094-6e43-4ffe-7659-67365cc21d00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'west-village-hero.jpg',
      altText: 'West Village restaurant storefront',
      category: 'exterior',
    },
    {
      id: 'media-demo2-int-1',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: 'e76fe844-f1e0-4fcd-c1ed-8f9ad2dd6700',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/e76fe844-f1e0-4fcd-c1ed-8f9ad2dd6700/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/e76fe844-f1e0-4fcd-c1ed-8f9ad2dd6700/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'west-village-interior.jpg',
      altText: 'Cozy West Village dining room',
      category: 'interior',
    },
    // Experience media
    {
      id: 'media-demo-exp-class',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '245066b6-926f-4dbb-e731-53ebb0e22700',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/245066b6-926f-4dbb-e731-53ebb0e22700/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/245066b6-926f-4dbb-e731-53ebb0e22700/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'pizza-making-class.jpg',
      altText: 'Guests shaping pizza dough at a hands-on pizza making class',
      category: 'food',
    },
    {
      id: 'media-demo-exp-wine',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '9b3d4f55-4b43-4a98-40d4-225947dc7300',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/9b3d4f55-4b43-4a98-40d4-225947dc7300/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/9b3d4f55-4b43-4a98-40d4-225947dc7300/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'natural-wine-pizza-night.jpg',
      altText: 'Pizza and wine set for a long-table dinner evening',
      category: 'interior',
    },
    {
      id: 'media-demo-exp-family',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '0b7af787-3380-4adc-2804-17792dd73300',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/0b7af787-3380-4adc-2804-17792dd73300/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/0b7af787-3380-4adc-2804-17792dd73300/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'family-pizza-night.jpg',
      altText: 'Family-style dinner table set for pizza night',
      category: 'interior',
    },
    // Article cover images
    {
      id: 'media-demo-article-sourdough',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '76012754-2517-4fc5-0885-e61c23a27900',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/76012754-2517-4fc5-0885-e61c23a27900/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/76012754-2517-4fc5-0885-e61c23a27900/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'article-sourdough-dough.jpg',
      altText: 'Pizza dough being prepared',
      category: 'food',
    },
    {
      id: 'media-demo-article-wine',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '6a78b1d1-5afc-4b27-ff79-801cdf5b2e00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/6a78b1d1-5afc-4b27-ff79-801cdf5b2e00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/6a78b1d1-5afc-4b27-ff79-801cdf5b2e00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'article-wine-pizza.jpg',
      altText: 'Wine and pizza pairing',
      category: 'food',
    },
    {
      id: 'media-demo-article-oven',
      provider: 'cloudflare_images',
      source: 'uploaded',
      cloudflareImageId: '40f35c96-bb6c-4486-8599-998ecc092f00',
      publicUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/40f35c96-bb6c-4486-8599-998ecc092f00/public',
      thumbnailUrl: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/40f35c96-bb6c-4486-8599-998ecc092f00/thumbnail',
      mimeType: 'image/jpeg',
      fileName: 'article-wood-oven-restaurant.jpg',
      altText: 'Wood-fired oven restaurant interior',
      category: 'interior',
    },
  ],
  tenantPageContent: [
    // Home page
    {
      id: 'sc-demo-home-hero',
      locationId: null,
      page: 'home',
      field: 'hero',
      content: null,
      heroTitle: 'Wood fire. Brooklyn nights.',
      heroSubtitle: 'Blistered pies & warm neighborhood vibes.',
      media: [{ asset_id: 'media-demo-hero', slot: 'media' }],
      type: 'text',
    },
    {
      id: 'sc-demo-cta',
      locationId: null,
      page: 'home',
      field: 'cta.title',
      content: 'Book a table near the oven.',
      media: [],
      type: 'text',
    },
    // About page
    {
      id: 'sc-demo-story-image',
      locationId: null,
      page: 'about',
      field: 'story.image',
      content: null,
      media: [{ asset_id: 'media-demo-team-1', slot: 'media' }],
      type: 'media',
    },
    {
      id: 'sc-demo-story-title',
      locationId: null,
      page: 'about',
      field: 'story.headline',
      content: 'A trattoria shaped by the oven.',
      media: [],
      type: 'text',
    },
    {
      id: 'sc-demo-story-body',
      locationId: null,
      page: 'about',
      field: 'story.body',
      content:
        'Ember & Slice started with a sourdough starter, a borrowed mixer, and a pop-up oven behind a Brooklyn wine bar. The pies sold out before sunset, then again the next weekend, and then every weekend after that.\n\nToday the room is permanent, but the promise is the same: slow dough, live fire, seasonal produce, and the kind of service that makes a weeknight feel like an occasion.',
      media: [],
      type: 'richtext',
    },
    {
      id: 'sc-demo-journey',
      locationId: null,
      page: 'about',
      field: 'journey.body',
      media: [],
      content:
        'We cold-ferment our dough, stretch every pie to order, and cook it hot enough for a crisp rim and a tender center. The menu changes around the market, but the Margherita never leaves the board.\n\nThe oven anchors the room. Everything else moves around it.',
      type: 'textarea',
    },
    {
      id: 'sc-demo-experience',
      locationId: null,
      page: 'about',
      field: 'experience.body',
      content:
        'Come for a quick counter pie, stay for antipasti and another round, or bring a group and let the table fill itself. Ember & Slice is casual by design, but the details matter.\n\nGood tomatoes. Good flour. Good fire. No shortcuts.',
      media: [],
      type: 'textarea',
    },
    // Experiences page
    {
      id: 'sc-demo-exp-kicker',
      locationId: null,
      page: 'experiences',
      field: 'hero.kicker',
      content: 'Experiences',
      media: [],
      type: 'text',
    },
    {
      id: 'sc-demo-exp-title',
      locationId: null,
      page: 'experiences',
      field: 'hero.title',
      content: 'Pizza classes, tasting nights, and big-table evenings.',
      media: [],
      type: 'text',
    },
    {
      id: 'sc-demo-exp-subtitle',
      locationId: null,
      page: 'experiences',
      field: 'hero.subtitle',
      content: 'Book a hands-on pizza class, a natural wine pairing night, or a family-style evening built around the oven.',
      media: [],
      type: 'textarea',
    },
  ],
  experiences: [
    {
      id: 'exp-demo-pizza-class',
      locationId: 'loc-demo',
      title: 'Pizza Making Class',
      slug: 'pizza-making-class',
      tagline: 'Stretch dough, top your pie, and fire it yourself.',
      includedItems: [
        'Dough, toppings, apron, and all class materials',
        'One personal pizza cooked during the session',
        'A glass of house wine or sparkling lemonade',
      ],
      whatToBring: [
        'Comfortable clothes that can handle a little flour',
        'Closed-toe shoes for working around the oven',
        'An appetite and a phone for photos',
      ],
      meetingPoint: 'Ember & Slice Brooklyn, main dining room host stand',
      cancellationPolicy: 'Free cancellation up to 24 hours before the class. Cancellations within 24 hours, late arrivals, and no-shows are non-refundable because ingredients and seating are prepared in advance.',
      body:
        'Our flagship pizza making class brings guests right up to the bench and oven. You will learn how we stretch our dough, build a balanced pie, and work with high-heat live fire without feeling rushed.\n\nEach booking includes dough, toppings, one personal pizza, and a glass of house wine or sparkling lemonade. Great for couples, visitors, and anyone who wants a hands-on dinner plan in Brooklyn.',
      media: [{ asset_id: 'media-demo-exp-class', slot: 'gallery' }],
      tags: ['Hands-on', 'Beginner friendly'],
      details: [
        { key: 'format', label: 'Format', values: ['Small group class', 'Hands-on instruction'] },
        { key: 'language', label: 'Language', values: ['English'] },
      ],
      price: '$95 per guest',
      priceAmount: 95,
      durationMinutes: 120,
      maxCapacity: 10,
      recurringSlots: { sunday: ['14:00', '18:00'], monday: ['14:00', '18:00'], tuesday: ['14:00', '18:00'], wednesday: ['14:00', '18:00'], thursday: ['14:00', '18:00'], friday: ['14:00', '18:00'], saturday: ['14:00', '18:00'] },
      status: 'active',
      sortOrder: 1,
      featured: true,
      featuredSortOrder: 1,
      seoTitle: 'Pizza Making Class Brooklyn | Ember & Slice',
      seoDescription:
        'Book a hands-on pizza making class at Ember & Slice in Brooklyn. Stretch dough, build your pie, and fire it in our oven.',
    },
    {
      id: 'exp-demo-wine-night',
      locationId: 'loc-demo',
      title: 'Natural Wine & Pizza Night',
      slug: 'natural-wine-and-pizza-night',
      tagline: 'Small pours, hot pies, and long-table energy.',
      includedItems: [
        'Guided wine tasting pours',
        'Shared dinner of off-menu pies and seasonal antipasti',
        'Table service and pairing notes from the team',
      ],
      whatToBring: [
        'Smart casual attire for an evening dinner service',
        'A light jacket if you prefer cooler indoor seating',
        'An open palate for a changing wine list',
      ],
      meetingPoint: 'Ember & Slice Brooklyn, shared dining room seating host stand',
      cancellationPolicy: 'Free cancellation up to 24 hours before the reservation. Cancellations within 24 hours, late arrivals, and no-shows are non-refundable due to limited shared seating and wine prep.',
      body:
        'This evening is part tasting, part dinner party. We pair a rotating lineup of natural wines with off-menu pies, seasonal antipasti, and a little background on why each pairing works.\n\nBest for date nights, visiting friends, and anyone who wants the room at its loudest and warmest. Seats are shared at the table, and the menu changes with the week.',
      media: [{ asset_id: 'media-demo-exp-wine', slot: 'gallery' }],
      price: '$78 per guest',
      priceAmount: 78,
      durationMinutes: 150,
      maxCapacity: 16,
      recurringSlots: { sunday: ['19:30'], monday: ['19:30'], tuesday: ['19:30'], wednesday: ['19:30'], thursday: ['19:30'], friday: ['19:30'], saturday: ['19:30'] },
      status: 'active',
      sortOrder: 2,
      featured: true,
      featuredSortOrder: 2,
      seoTitle: 'Natural Wine & Pizza Night Brooklyn | Ember & Slice',
      seoDescription:
        'Reserve Natural Wine & Pizza Night at Ember & Slice in Brooklyn for curated pours, seasonal pies, and a long-table dinner.',
    },
    {
      id: 'exp-demo-family-night',
      locationId: 'loc-demo',
      title: 'Family Pizza Night',
      slug: 'family-pizza-night',
      tagline: 'Big-table dinner, easy pacing, and pizza for all ages.',
      includedItems: [
        'Mini pies for kids and large-format pizzas for the table',
        'Salads and shared sides',
        'Full table service throughout the dinner',
      ],
      whatToBring: [
        'Casual family-friendly clothes',
        'Any kids’ preferred drinks or snacks if needed',
        'Patience for a little flour and a lot of fun',
      ],
      meetingPoint: 'Ember & Slice Brooklyn, family night host stand near the front entrance',
      cancellationPolicy: 'Free cancellation up to 24 hours before the booking. Cancellations within 24 hours, late arrivals, and no-shows are non-refundable because food and table space are reserved specifically for your group.',
      body:
        'Family Pizza Night is our easiest way to turn a Sunday dinner into something a little more memorable. Kids shape mini pies, grown-ups share large-format pizzas and salads, and the kitchen keeps the pacing relaxed.\n\nIdeal for families, birthday dinners, and mixed-age groups who want an experience that feels special without feeling formal.',
      media: [{ asset_id: 'media-demo-exp-family', slot: 'gallery' }],
      price: '$140 per table',
      priceAmount: 140,
      durationMinutes: 105,
      maxCapacity: 6,
      recurringSlots: { sunday: ['17:00', '18:30'], monday: ['17:00', '18:30'], tuesday: ['17:00', '18:30'], wednesday: ['17:00', '18:30'], thursday: ['17:00', '18:30'], friday: ['17:00', '18:30'], saturday: ['17:00', '18:30'] },
      status: 'active',
      sortOrder: 3,
      featured: true,
      featuredSortOrder: 3,
      seoTitle: 'Family Pizza Night Brooklyn | Ember & Slice',
      seoDescription:
        'Book Family Pizza Night at Ember & Slice in Brooklyn for a relaxed group dinner built around the oven.',
    },
  ],
  reviews: [
    {
      id: 'rev-demo-1',
      locationId: 'loc-demo',
      authorName: 'Maya R.',
      rating: 5,
      content: 'The Margherita had that perfect leopard-spotted crust and the basil hit the table smelling fresh. Exactly what I want from a neighborhood pizza night.',
      ownerReply: null,
      ownerReplyAt: null,
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-2',
      locationId: 'loc-demo',
      authorName: 'Julian P.',
      rating: 5,
      content: 'Sat at the counter and watched the oven all night. Pepperoni Calabrese, burrata, and a spritz made this feel like a tiny vacation.',
      ownerReply: 'Thank you Julian. The counter seats are our favorite too - come back for the Funghi Bianco next time.',
      ownerReplyAt: '2026-04-22T09:15:00.000Z',
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-3',
      locationId: 'loc-demo',
      authorName: 'Priya S.',
      rating: 4,
      content: 'Great crust, warm service, and the garlic knots vanished before the pizza landed. It gets loud at peak dinner but in a good way.',
      ownerReply: 'Thanks Priya. Dinner definitely has energy, and we are glad the knots did their job.',
      ownerReplyAt: '2026-04-15T11:30:00.000Z',
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-4',
      locationId: 'loc-demo',
      authorName: 'Noah L.',
      rating: 5,
      content: 'The hot honey soppressata is ridiculous. Sweet, spicy, smoky, and somehow still balanced. Best pie I have had in Williamsburg this year.',
      ownerReply: null,
      ownerReplyAt: null,
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-5',
      locationId: 'loc-demo',
      authorName: 'Elena C.',
      rating: 4,
      content: 'Lovely date-night spot without feeling precious. Caesar was sharp and cold, pizza was blistered, staff knew the menu well.',
      ownerReply: null,
      ownerReplyAt: null,
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-6',
      locationId: 'loc-demo',
      authorName: 'Chris B.',
      rating: 3,
      content: 'Food was strong but our table was about 15 minutes late on a busy Friday. I would come earlier next time.',
      ownerReply: 'Hi Chris - sorry for the Friday wait. We tightened our turn times and would love to host you again on a smoother night.',
      ownerReplyAt: '2026-03-30T14:45:00.000Z',
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo2-1',
      locationId: 'loc-demo-2',
      authorName: 'Michael T.',
      rating: 5,
      content: 'Unbelievable sourdough pizza right in the West Village! The Margherita is simple, fresh, and perfectly charred. Truly a hidden gem.',
      ownerReply: 'Thank you Michael! We are thrilled you enjoyed the neighborhood vibes and our signature crust.',
      ownerReplyAt: '2026-05-15T12:00:00.000Z',
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo2-2',
      locationId: 'loc-demo-2',
      authorName: 'Emma W.',
      rating: 5,
      content: 'Beautiful space, exceptionally friendly service, and a fantastic corner view. Highly recommend the Burrata and the Hot Honey pie!',
      ownerReply: null,
      ownerReplyAt: null,
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-7',
      locationId: 'loc-demo',
      authorName: 'Sarah K.',
      rating: 5,
      content: 'The sourdough crust here is absolutely incredible—perfect char, airy texture, and that distinctive flavor that only comes from proper fermentation. Best pizza in Brooklyn, hands down.',
      ownerReply: null,
      ownerReplyAt: null,
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-8',
      locationId: 'loc-demo',
      authorName: 'David M.',
      rating: 5,
      content: 'From the moment we walked in, the hospitality was exceptional. The team made us feel like regulars even on our first visit. That warmth combined with incredible food makes this place special.',
      ownerReply: 'Thank you David! There is nothing we love more than making new guests feel at home. Come back soon!',
      ownerReplyAt: '2026-04-28T14:20:00.000Z',
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-9',
      locationId: 'loc-demo',
      authorName: 'Jennifer L.',
      rating: 5,
      content: 'The natural wine pairing recommendations were spot on. Our server guided us through three different bottles that perfectly complemented each course. It elevated the whole experience.',
      ownerReply: null,
      ownerReplyAt: null,
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-10',
      locationId: 'loc-demo',
      authorName: 'Robert H.',
      rating: 4,
      content: 'The atmosphere is perfect—cozy but energetic, great music, and that open oven creates such a warm focal point for the room. It feels like a neighborhood gem that genuinely cares about quality.',
      ownerReply: null,
      ownerReplyAt: null,
      status: 'approved',
      source: 'google',
    },
    {
      id: 'rev-demo-11',
      locationId: 'loc-demo',
      authorName: 'Amanda T.',
      rating: 5,
      content: 'This has become our go-to spot for date night. We live a few blocks away and find ourselves here at least once a week. The consistency is remarkable—always delicious, always welcoming.',
      ownerReply: 'Amanda, neighbors like you are why we do this. Thank you for being part of our neighborhood!',
      ownerReplyAt: '2026-04-20T16:45:00.000Z',
      status: 'approved',
      source: 'google',
    },
  ],
  products: [
    ...productsAtLocation('loc-demo', [
        {
          id: 'mi-1',
          category: 'Wood-Fired Pizza',
          name: 'Margherita',
          slug: 'margherita',
          description: 'San Marzano tomato, fior di latte, basil, extra virgin olive oil, sea salt',
          priceAmount: 18,
          media: [
            { asset_id: 'media-demo-margherita', slot: 'gallery' },
            { asset_id: 'media-demo-margherita-video', slot: 'gallery' },
          ],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: '["Vegetarian"]',
          available: true,
          sortOrder: 1,
          featured: true,
          featuredSortOrder: 1,
        },
        {
          id: 'mi-2',
          category: 'Wood-Fired Pizza',
          name: 'Pepperoni Calabrese',
          slug: 'pepperoni-calabrese',
          description: 'Tomato, mozzarella, cupping pepperoni, Calabrian chile, oregano',
          priceAmount: 21,
          media: [{ asset_id: 'media-demo-pepperoni', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: null,
          available: true,
          sortOrder: 2,
          featured: true,
          featuredSortOrder: 2,
        },
        {
          id: 'mi-3',
          category: 'Wood-Fired Pizza',
          name: 'Funghi Bianco',
          slug: 'funghi-bianco',
          description: 'Roasted mushrooms, ricotta crema, garlic, thyme, mozzarella, pecorino',
          priceAmount: 22,
          media: [{ asset_id: 'media-demo-funghi', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: '["Vegetarian"]',
          available: true,
          sortOrder: 3,
        },
        {
          id: 'mi-4',
          category: 'Wood-Fired Pizza',
          name: 'Soppressata Hot Honey',
          slug: 'soppressata-hot-honey',
          description: 'Spicy soppressata, tomato, mozzarella, pickled Fresno chile, Brooklyn hot honey',
          priceAmount: 23,
          media: [{ asset_id: 'media-demo-soppressata', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: null,
          available: true,
          sortOrder: 4,
        },
        {
          id: 'mi-5',
          category: 'Antipasti',
          name: 'Burrata',
          slug: 'burrata',
          description: 'Creamy burrata, roasted cherry tomatoes, basil oil, grilled sourdough',
          priceAmount: 16,
          media: [{ asset_id: 'media-demo-burrata', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: '["Vegetarian"]',
          available: true,
          sortOrder: 1,
          featured: true,
          featuredSortOrder: 3,
        },
        {
          id: 'mi-6',
          category: 'Antipasti',
          name: 'Garlic Knots',
          slug: 'garlic-knots',
          description: 'Wood-fired knots, parsley, roasted garlic butter, marinara',
          priceAmount: 9,
          media: [{ asset_id: 'media-demo-knots', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: '["Vegetarian"]',
          available: true,
          sortOrder: 2,
        },
        {
          id: 'mi-7',
          category: 'Pasta & Salads',
          name: 'Little Gem Caesar',
          slug: 'little-gem-caesar',
          description: 'Little gem lettuce, anchovy dressing, sourdough crumbs, shaved pecorino',
          priceAmount: 14,
          media: [{ asset_id: 'media-demo-caesar', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy", "Fish"]',
          dietaryNotes: null,
          available: true,
          sortOrder: 1,
        },
        {
          id: 'mi-8',
          category: 'Pasta & Salads',
          name: 'Rigatoni Pomodoro',
          slug: 'rigatoni-pomodoro',
          description: 'Rigatoni, slow tomato sauce, basil, parmesan',
          priceAmount: 19,
          media: [{ asset_id: 'media-demo-rigatoni', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: '["Vegetarian"]',
          available: true,
          sortOrder: 2,
        },
        {
          id: 'mi-9',
          category: 'Drinks',
          name: 'Sparkling Lemonade',
          slug: 'sparkling-lemonade',
          description: 'House lemon cordial, soda, rosemary',
          priceAmount: 6,
          media: [{ asset_id: 'media-demo-lemonade', slot: 'gallery' }],
          allergens: null,
          dietaryNotes: '["Vegan", "Gluten-free"]',
          available: true,
          sortOrder: 1,
        },
        {
          id: 'mi-10',
          category: 'Drinks',
          name: 'Italian Soda',
          slug: 'italian-soda',
          description: 'Blood orange, grapefruit, or limonata',
          priceAmount: 5,
          media: [{ asset_id: 'media-demo-italian-soda', slot: 'gallery' }],
          allergens: null,
          dietaryNotes: '["Vegan", "Gluten-free"]',
          available: true,
          sortOrder: 2,
        },
    ]),
    ...productsAtLocation('loc-demo-2', [
        {
          id: 'mi-demo2-1',
          category: 'Wood-Fired Pizza',
          name: 'Margherita',
          slug: 'margherita',
          description: 'San Marzano tomato, fior di latte, basil, extra virgin olive oil, sea salt',
          priceAmount: 18,
          media: [
            { asset_id: 'media-demo-margherita', slot: 'gallery' },
            { asset_id: 'media-demo-margherita-video', slot: 'gallery' },
          ],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: '["Vegetarian"]',
          available: true,
          sortOrder: 1,
          featured: true,
          featuredSortOrder: 1,
        },
        {
          id: 'mi-demo2-2',
          category: 'Wood-Fired Pizza',
          name: 'Pepperoni Calabrese',
          slug: 'pepperoni-calabrese',
          description: 'Tomato, mozzarella, cupping pepperoni, Calabrian chile, oregano',
          priceAmount: 21,
          media: [{ asset_id: 'media-demo-pepperoni', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: null,
          available: true,
          sortOrder: 2,
          featured: true,
          featuredSortOrder: 2,
        },
        {
          id: 'mi-demo2-3',
          category: 'Antipasti',
          name: 'Burrata',
          slug: 'burrata',
          description: 'Creamy burrata, roasted cherry tomatoes, basil oil, grilled sourdough',
          priceAmount: 16,
          media: [{ asset_id: 'media-demo-burrata', slot: 'gallery' }],
          allergens: '["Gluten", "Dairy"]',
          dietaryNotes: '["Vegetarian"]',
          available: true,
          sortOrder: 1,
          featured: true,
          featuredSortOrder: 3,
        },
        {
          id: 'mi-demo2-4',
          category: 'Drinks',
          name: 'Sparkling Lemonade',
          slug: 'sparkling-lemonade',
          description: 'House lemon cordial, soda, rosemary',
          priceAmount: 6,
          media: [{ asset_id: 'media-demo-lemonade', slot: 'gallery' }],
          allergens: null,
          dietaryNotes: '["Vegan", "Gluten-free"]',
          available: true,
          sortOrder: 1,
        },
    ]),
  ],
  locationQa: [
    {
      id: 'qa-demo-1',
      locationId: 'loc-demo',
      question: 'Do you take reservations?',
      questionAuthor: 'A Guest',
      answer: 'Yes. We hold room for walk-ins, but reservations are recommended for dinner and weekends.',
      answerAuthor: 'Ember & Slice Brooklyn',
      isOwnerAnswer: true,
      upvoteCount: 14,
      source: 'manual',
      status: 'published',
      sortOrder: 1,
    },
    {
      id: 'qa-demo-2',
      locationId: 'loc-demo',
      question: 'Do you offer gluten-free crust?',
      questionAuthor: 'Another Guest',
      answer: 'Not yet. Our dough room uses wheat flour all day, so we cannot safely guarantee a gluten-free crust.',
      answerAuthor: 'Ember & Slice Brooklyn',
      isOwnerAnswer: true,
      upvoteCount: 8,
      source: 'manual',
      status: 'published',
      sortOrder: 2,
    },
    {
      id: 'qa-demo-3',
      locationId: 'loc-demo',
      question: 'Can I order takeout?',
      questionAuthor: 'A Guest',
      answer: 'Yes. Call us directly for pickup. Wood-fired pies travel best when picked up close to oven time.',
      answerAuthor: 'Ember & Slice Brooklyn',
      isOwnerAnswer: true,
      upvoteCount: 11,
      source: 'manual',
      status: 'published',
      sortOrder: 3,
    },
    {
      id: 'qa-demo-4',
      locationId: 'loc-demo',
      question: 'What are your busiest times?',
      questionAuthor: 'A Guest',
      answer: 'Friday and Saturday from 7pm to 9pm are peak. Earlier dinner or Sunday lunch is calmer.',
      answerAuthor: 'Ember & Slice Brooklyn',
      isOwnerAnswer: true,
      upvoteCount: 6,
      source: 'manual',
      status: 'published',
      sortOrder: 4,
    },
    {
      id: 'qa-demo-5',
      locationId: 'loc-demo',
      question: 'Do you have vegetarian options?',
      questionAuthor: 'A Guest',
      answer: 'Absolutely. Margherita, Funghi Bianco, Burrata, Garlic Knots, and Rigatoni Pomodoro are vegetarian.',
      answerAuthor: 'Ember & Slice Brooklyn',
      isOwnerAnswer: true,
      upvoteCount: 5,
      source: 'manual',
      status: 'published',
      sortOrder: 5,
    },
    {
      id: 'qa-demo2-1',
      locationId: 'loc-demo-2',
      question: 'Do you offer outdoor seating?',
      questionAuthor: 'Outdoor Diner',
      answer: 'Absolutely! We have a lovely patio setup for the warmer months.',
      answerAuthor: 'Ember & Slice West Village',
      isOwnerAnswer: true,
      upvoteCount: 8,
      source: 'manual',
      status: 'published',
      sortOrder: 1,
    },
    {
      id: 'qa-demo2-2',
      locationId: 'loc-demo-2',
      question: 'Do you offer gluten-free crust?',
      questionAuthor: 'Coeliac Foodie',
      answer: 'Yes, we offer gluten-free crust for any of our wood-fired pizzas for an additional charge.',
      answerAuthor: 'Ember & Slice West Village',
      isOwnerAnswer: true,
      upvoteCount: 5,
      source: 'manual',
      status: 'published',
      sortOrder: 2,
    },
  ],
  qaTranslations: [
    {
      id: 'qa-demo-1-th',
      locale: 'th',
      originalId: 'qa-demo-1',
      question: 'คุณรับจองโต๊ะไหม',
      answer: 'ใช่ เราจัดที่ว่างสำหรับลูกค้าเดินเข้ามา แต่ขอแนะนำให้จองสำหรับมื้อเย็นและวันหยุด',
    },
    {
      id: 'qa-demo-2-th',
      locale: 'th',
      originalId: 'qa-demo-2',
      question: 'คุณมีแป้งไร์กลูเตนฟรีไหม',
      answer: 'ยังไม่ ห้องผสมแป้งของเราใช้แป้งสาลีตลอดทั้งวัน ดังนั้นเราไม่สามารถรับประกันแป้งไร์กลูเตนฟรีได้อย่างปลอดภัย',
    },
    {
      id: 'qa-demo-3-th',
      locale: 'th',
      originalId: 'qa-demo-3',
      question: 'ฉันสามารถสั่งทานบ้านได้ไหม',
      answer: 'ใช่ โทรหาเราโดยตรงเพื่อรับของ พิซซ่าเตาฟืนเดินทางได้ดีที่สุดเมื่อหยิบใกล้เวลาย่าง',
    },
    {
      id: 'qa-demo-4-th',
      locale: 'th',
      originalId: 'qa-demo-4',
      question: 'เวลาที่แออัดที่สุดคือเมื่อไร',
      answer: 'วันศุกร์และวันเสาร์ตั้งแต่ 7 ถึง 9 โมงเย็นคือช่วงพีค มื้อเย็นตั้งแต่ต้นหรืออาหารกลางวันวันอาทิตย์จะสงบกว่า',
    },
    {
      id: 'qa-demo-5-th',
      locale: 'th',
      originalId: 'qa-demo-5',
      question: 'คุณมีตัวเลือกมังสวิรัติไหม',
      answer: 'แน่นอน มาร์เกอริต้า ฟันจี บิองโก บูร์ราตา การ์ลิกน็อต และริกาโตนีโปโมโดโรเป็นมังสวิรัติ',
    },
    {
      id: 'qa-demo2-1-th',
      locale: 'th',
      originalId: 'qa-demo2-1',
      question: 'คุณมีที่นั่งกลางแจ้งไหม',
      answer: 'แน่นอน! เรามีการจัดเตรียมพาทิโอที่สวยงามสำหรับเดือนที่อบอุ่น',
    },
    {
      id: 'qa-demo2-2-th',
      locale: 'th',
      originalId: 'qa-demo2-2',
      question: 'คุณเสนอแป้งไร์กลูเตนฟรีไหม',
      answer: 'ใช่ เราเสนอแป้งไร์กลูเตนฟรีสำหรับพิซซ่าเตาฟืนทุกชนิดโดยเสียค่าใช้จ่ายเพิ่มเติม',
    },
  ],
  postTranslations: [
    {
      id: 'post-demo-1-th',
      locale: 'th',
      originalId: 'post-demo-1',
      title: 'อาหารกลางวันวันหยุดเริ่มตั้งแต่ 11 โมง',
      body: 'เตาจะติดไฟเร็วขึ้นในวันเสาร์และวันอาทิตย์ มาทานพิซซ่ากลางวัน การ์ลิกน็อต และสปริตซ์ตั้งแต่ 11 โมงเช้า',
    },
    {
      id: 'post-demo-2-th',
      locale: 'th',
      originalId: 'post-demo-2',
      title: null,
      body: 'ฟันจี บิองโกของเรากลับมาแล้วด้วยเห็ดย่าง ครีมริคอตต้า ใบสะระแหน่ และหิมะเปคโคริโนเล็กน้อยที่เคาน์เตอร์',
    },
    {
      id: 'post-demo-3-th',
      locale: 'th',
      originalId: 'post-demo-3',
      title: 'มาร์เกอริต้าวันจันทร์',
      body: 'ทุกวันจันทร์ในเดือนพฤษภาคม: พิซซ่ามาร์เกอริต้าราคา 14 ดอลลาร์ตั้งแต่เปิดถึงปิด ทานในร้านเท่านั้น หนึ่งต่อคน',
      metadata: { event: { title: 'ข้อเสนอมาร์เกอริต้าวันจันทร์' }, offer: { terms_conditions: 'ทานในร้านทุกวันจันทร์ในเดือนพฤษภาคม จำกัดพิซซ่ามาร์เกอริต้าหนึ่งถาดต่อคน' } },
    },
    {
      id: 'post-demo-4-th',
      locale: 'th',
      originalId: 'post-demo-4',
      title: 'มื้ออาหารโต๊ะยาวเก็บเกี่ยว',
      body: 'ร่วมกับเราสำหรับมื้ออาหารครอบครัวแบบครั้งเดียวที่สร้างขึ้นรอบผลผลิตปลายฤดูร้อนและเตาฟืนไม้',
      metadata: { event: { title: 'มื้ออาหารโต๊ะยาวเก็บเกี่ยว' } },
    },
  ],
  posts: [
    {
      id: 'post-demo-1',
      locationId: 'loc-demo',
      post_type: 'standard',
      title: 'Weekend lunch now starts at 11',
      body: 'The oven is lighting up earlier on Saturdays and Sundays. Come by for lunch pies, garlic knots, and spritzes from 11am.',
      media: [{ asset_id: 'media-demo-post1', slot: 'cover' }],
      status: 'published',
      publishedAt: '2026-05-01T12:00:00.000Z',
      createdBy: 'user-demo',
    },
    {
      id: 'post-demo-2',
      locationId: 'loc-demo',
      post_type: 'standard',
      title: null,
      body: 'Our Funghi Bianco is back with roasted mushrooms, ricotta crema, thyme, and a little pecorino snow at the pass.',
      media: [{ asset_id: 'media-demo-post2', slot: 'cover' }],
      status: 'published',
      publishedAt: '2026-04-18T10:00:00.000Z',
      createdBy: 'user-demo',
    },
    {
      id: 'post-demo-3',
      locationId: 'loc-demo',
      post_type: 'offer',
      title: 'Margherita Monday',
      body: 'Every Monday in May: Margherita pies are $14 from open to close. Dine-in only, one per guest.',
      event: { title: 'Monday Margherita offer', schedule: { start_date: '2026-05-01', start_time: '00:00:00', end_date: '2026-05-31', end_time: '23:59:59' } },
      offer: { coupon_code: 'MONDAY14', terms_conditions: 'Dine-in Mondays in May; limit one Margherita pizza per guest.' },
      media: [{ asset_id: 'media-demo-post3', slot: 'cover' }],
      status: 'published',
      publishedAt: '2026-04-10T09:00:00.000Z',
      createdBy: 'user-demo',
    },
    {
      id: 'post-demo-4',
      locationId: 'loc-demo',
      post_type: 'event',
      title: 'Harvest Table Supper',
      body: 'Join us for a one-night family-style supper built around late-summer produce and the wood-fired oven.',
      event: { title: 'Harvest Table Supper', schedule: { start_date: '2026-10-10', start_time: '19:00:00', end_date: '2026-10-10', end_time: '22:00:00' } },
      call_to_action: { action_type: 'book', url: 'https://demo.krabiclaw.com/reservations' },
      media: [],
      status: 'published',
      publishedAt: '2026-09-01T09:00:00.000Z',
      createdBy: 'user-demo',
    },
  ],
  tenantPageLocaleFields: [
    {
      id: 'sct-demo-th-home-hero',
      locationId: null,
      locale: 'th',
      page: 'home',
      field: 'hero',
      content: null,
      heroTitle: 'ไฟฟืนและค่ำคืนในบรูคลิน',
      heroSubtitle: 'พิซซ่าแป้งซาวโดว์ขอบพองกรอบ แอนติพาสติตามฤดูกาล และห้องอาหารที่อบอุ่นด้วยแสงจากเตา',
      value: 'ไฟฟืนและค่ำคืนในบรูคลิน',
      type: 'text',
      status: 'published',
      sourceHash: 'demo-pizza-home-hero-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'sct-demo-th-cta',
      locationId: null,
      locale: 'th',
      page: 'home',
      field: 'cta.title',
      content: 'จองโต๊ะใกล้เตาอบ',
      heroTitle: null,
      heroSubtitle: null,
      value: 'จองโต๊ะใกล้เตาอบ',
      type: 'text',
      status: 'published',
      sourceHash: 'demo-pizza-cta-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'sct-demo-th-story-title',
      locationId: null,
      locale: 'th',
      page: 'about',
      field: 'story.headline',
      content: 'แทรตโทเรียที่มีเตาอบเป็นหัวใจ',
      heroTitle: null,
      heroSubtitle: null,
      value: 'แทรตโทเรียที่มีเตาอบเป็นหัวใจ',
      type: 'text',
      status: 'published',
      sourceHash: 'demo-pizza-story-title-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'sct-demo-th-story-body',
      locationId: null,
      locale: 'th',
      page: 'about',
      field: 'story.body',
      content: 'Ember & Slice เริ่มจากแป้งซาวโดว์ เครื่องผสมที่ยืมมา และเตาอบป๊อปอัพหลังบาร์ไวน์แห่งหนึ่งในบรูคลิน พิซซ่าขายหมดก่อนพระอาทิตย์ตก แล้วก็ขายหมดอีกในสุดสัปดาห์ถัดมา และทุกสุดสัปดาห์หลังจากนั้น\n\nวันนี้ร้านมีที่อยู่ถาวรแล้ว แต่คำสัญญายังเหมือนเดิม: แป้งที่ใช้เวลา ไฟจริง วัตถุดิบตามฤดูกาล และการบริการที่ทำให้คืนธรรมดารู้สึกพิเศษ',
      heroTitle: null,
      heroSubtitle: null,
      value: 'Ember & Slice เริ่มจากแป้งซาวโดว์ เครื่องผสมที่ยืมมา และเตาอบป๊อปอัพหลังบาร์ไวน์แห่งหนึ่งในบรูคลิน',
      type: 'richtext',
      status: 'published',
      sourceHash: 'demo-pizza-story-body-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'sct-demo-th-journey',
      locationId: null,
      locale: 'th',
      page: 'about',
      field: 'journey.body',
      content: 'เราหมักแป้งในอุณหภูมิต่ำ ยืดแป้งทุกแผ่นตามออเดอร์ และย่างในอุณหภูมิสูงพอที่จะได้ขอบกรอบและศูนย์กลางที่นุ่ม เมนูเปลี่ยนไปตามตลาด แต่มาร์เกอริต้าจะไม่หายไปจากเมนู\n\nเตาอบเป็นใจกลางของห้อง ทุกอย่างหมุนรอบเตาอบ',
      heroTitle: null,
      heroSubtitle: null,
      value: 'เราหมักแป้งในอุณหภูมิต่ำ ยืดแป้งทุกแผ่นตามออเดอร์ และย่างในอุณหภูมิสูงพอที่จะได้ขอบกรอบและศูนย์กลางที่นุ่ม เมนูเปลี่ยนไปตามตลาด แต่มาร์เกอริต้าจะไม่หายไปจากเมนู',
      type: 'textarea',
      status: 'published',
      sourceHash: 'demo-pizza-journey-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'sct-demo-th-experience',
      locationId: null,
      locale: 'th',
      page: 'about',
      field: 'experience.body',
      content: 'มาทานพิซซ่าแผ่นเดียวจากเคาน์เตอร์ หรืออยู่ต่อกับแอนติพาสติและเครื่องดื่มอีกแก้ว หรือพากลุ่มมาและปล่อยให้โต๊ะเต็มไปด้วยตัวเอง Ember & Slice ออกแบบมาให้เป็นกันเอง แต่รายละเอียดสำคัญ\n\nมะเขือเทศดี แป้งดี ไฟดี ไม่มีทางลัด',
      heroTitle: null,
      heroSubtitle: null,
      value: 'มาทานพิซซ่าแผ่นเดียวจากเคาน์เตอร์ หรืออยู่ต่อกับแอนติพาสติและเครื่องดื่มอีกแก้ว หรือพากลุ่มมาและปล่อยให้โต๊ะเต็มไปด้วยตัวเอง Ember & Slice ออกแบบมาให้เป็นกันเอง แต่รายละเอียดสำคัญ',
      type: 'textarea',
      status: 'published',
      sourceHash: 'demo-pizza-experience-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'sct-demo-th-exp-kicker',
      locationId: null,
      locale: 'th',
      page: 'experiences',
      field: 'hero.kicker',
      content: 'ประสบการณ์',
      heroTitle: null,
      heroSubtitle: null,
      value: 'ประสบการณ์',
      type: 'text',
      status: 'published',
      sourceHash: 'demo-pizza-exp-kicker-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'sct-demo-th-exp-title',
      locationId: null,
      locale: 'th',
      page: 'experiences',
      field: 'hero.title',
      content: 'คลาสทำพิซซ่า ค่ำคืนวิญญาณ และมื้ออาหารแบบโต๊ะยาว',
      heroTitle: null,
      heroSubtitle: null,
      value: 'คลาสทำพิซซ่า ค่ำคืนวิญญาณ และมื้ออาหารแบบโต๊ะยาว',
      type: 'text',
      status: 'published',
      sourceHash: 'demo-pizza-exp-title-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'sct-demo-th-exp-subtitle',
      locationId: null,
      locale: 'th',
      page: 'experiences',
      field: 'hero.subtitle',
      content: 'จองคลาสทำพิซซ่าแบบลงมือทำ ค่ำคืนคู่วิญญาณ หรือมื้ออาหารแบบครอบครัวรอบเตาอบ',
      heroTitle: null,
      heroSubtitle: null,
      value: 'จองคลาสทำพิซซ่าแบบลงมือทำ ค่ำคืนคู่วิญญาณ หรือมื้ออาหารแบบครอบครัวรอบเตาอบ',
      type: 'textarea',
      status: 'published',
      sourceHash: 'demo-pizza-exp-subtitle-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
  ],
  businessLocationTranslations: [
    {
      id: 'blt-demo-th-loc',
      locationId: 'loc-demo',
      locale: 'th',
      title: 'Ember & Slice บรูคลิน',
      address: '184 Wythe Ave',
      city: 'บรูคลิน',
      description: 'แทรตโทเรียพิซซ่าเตาฟืนในบรูคลิน เสิร์ฟพิซซ่าแป้งซาวโดว์ แอนติพาสติตามฤดูกาล และบรรยากาศอบอุ่นรอบเตาอบ',
      shortDescription: 'พิซซ่าเตาฟืน แอนติพาสติตามฤดูกาล และการต้อนรับแบบเพื่อนบ้านในบรูคลิน',
      status: 'published',
      sourceHash: 'demo-pizza-location-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'blt-demo-th-loc-2',
      locationId: 'loc-demo-2',
      locale: 'th',
      title: 'Ember & Slice เวสต์วิลเลจ',
      address: '100 7th Ave S',
      city: 'นิวยอร์ก',
      description: 'พิซซ่าเตาฟืนลายเซ็นและการต้อนรับที่อบอุ่น นำมาสู่ใจกลางของเวสต์วิลเลจ',
      shortDescription: 'พิซซ่าเตาฟืน แอนติพาสติตามฤดูกาล และการต้อนรับแบบเพื่อนบ้านในเวสต์วิลเลจ',
      status: 'published',
      sourceHash: 'demo-pizza-location-2-v1',
      translatedAt: '2026-05-01T00:00:00.000Z',
      reviewedAt: '2026-05-01T00:00:00.000Z',
    },
  ],
  resourceLocalizations: [
    // Product resource localizations
    {
      id: 'rl-demo-th-margherita',
      resourceType: 'product',
      resourceId: 'mi-1',
      locale: 'th',
      valuesJson: { name: 'มาร์เกอริต้า', description: 'มะเขือเทศซานมาร์นา ฟิออร์ดีลาตเต้ ใบบาซิลิก น้ำมันมะกอกคั่นเย็น และเกลือทะเล' },
    },
    {
      id: 'rl-demo-th-pepperoni',
      resourceType: 'product',
      resourceId: 'mi-2',
      locale: 'th',
      valuesJson: { name: 'เป็ปเปอโรนีคาลาเบรเซ', description: 'มะเขือเทศ มอซซาเรลล่า เป็ปเปอโรนีคัพปิ้ง พริกแคลเบรเซียน และโอริกาโน' },
    },
    {
      id: 'rl-demo-th-funghi',
      resourceType: 'product',
      resourceId: 'mi-3',
      locale: 'th',
      valuesJson: { name: 'ฟันจี บิองโก', description: 'เห็ดย่าง ครีมริคอตต้า กระเทียม ใบสะระแหน่ มอซซาเรลล่า และเปคโคริโน' },
    },
    {
      id: 'rl-demo-th-soppressata',
      resourceType: 'product',
      resourceId: 'mi-4',
      locale: 'th',
      valuesJson: { name: 'ซอปเปรสซาตาฮอนนี่ฮันนี่', description: 'ซอปเปรสซาตาเผ็ด มะเขือเทศ มอซซาเรลล่า พริกเฟรสโน่ดอง และฮอนนี่ฮันนี่บรูคลิน' },
    },
    {
      id: 'rl-demo-th-burrata',
      resourceType: 'product',
      resourceId: 'mi-5',
      locale: 'th',
      valuesJson: { name: 'บูร์ราตา', description: 'บูร์ราตาเนียนครีม มะเขือเทศย่าง น้ำมันใบบาซิลิก และขนมปังซาวโดว์ย่าง' },
    },
    {
      id: 'rl-demo-th-knots',
      resourceType: 'product',
      resourceId: 'mi-6',
      locale: 'th',
      valuesJson: { name: 'การ์ลิกน็อต', description: 'ขนมปังซาวโดว์ผูกมัด พร้อมซอสมะเขือเทศมารินารา' },
    },
    {
      id: 'rl-demo-th-caesar',
      resourceType: 'product',
      resourceId: 'mi-7',
      locale: 'th',
      valuesJson: { name: 'ซีซาร์เล็ตเทอซิทเจม', description: 'ผักเล็ตเทอซิท ซอสแอนโชวี่ ครัมบ์ขนมปังซาวโดว์ และเปคโคริโนขูด' },
    },
    {
      id: 'rl-demo-th-rigatoni',
      resourceType: 'product',
      resourceId: 'mi-8',
      locale: 'th',
      valuesJson: { name: 'ริกาโตนีโปโมโดโร', description: 'ริกาโตนี ซอสมะเขือเทศสูตรช้า ใบบาซิลิก และพาร์เมซาน' },
    },
    {
      id: 'rl-demo-th-lemonade',
      resourceType: 'product',
      resourceId: 'mi-9',
      locale: 'th',
      valuesJson: { name: 'สปาร์กกลิ้งเลมอเนด', description: 'คอร์ดเดิลเลมอนบ้าน โซดา และโรสแมรี่' },
    },
    {
      id: 'rl-demo-th-italian-soda',
      resourceType: 'product',
      resourceId: 'mi-10',
      locale: 'th',
      valuesJson: { name: 'อิตาเลียนโซดา', description: 'ส้มแดง เกรปฟรูต หรือลิโมนาตา' },
    },
    // Experience resource localizations
    {
      id: 'rl-demo-th-pizza-class',
      resourceType: 'product',
      resourceId: 'exp-demo-pizza-class',
      routePath: '/th/experiences/pizza-making-class',
      locale: 'th',
      valuesJson: { name: 'คลาสทำพิซซ่า', experience: { tagline: 'ยืดแป้ง ตกแต่งพิซซ่า และย่างเอง' } },
    },
    {
      id: 'rl-demo-th-wine-night',
      resourceType: 'product',
      resourceId: 'exp-demo-wine-night',
      routePath: '/th/experiences/natural-wine-and-pizza-night',
      locale: 'th',
      valuesJson: { name: 'ค่ำคืนไวน์ธรรมชาติและพิซซ่า', experience: { tagline: 'เสิร์ฟเล็กน้อย พิซซ่าร้อน และบรรยากาศโต๊ะยาว' } },
    },
    {
      id: 'rl-demo-th-family-night',
      resourceType: 'product',
      resourceId: 'exp-demo-family-night',
      routePath: '/th/experiences/family-pizza-night',
      locale: 'th',
      valuesJson: { name: 'ค่ำคืนพิซซ่าครอบครัว', experience: { tagline: 'มื้ออาหารโต๊ะยาว เวลาผ่อนคลาย และพิซซ่าสำหรับทุกวัย' } },
    },
  ],
  organizationBilling: {
    status: 'active',
    plan: 'growth',
  },
  publicRoutes: [
    { path: '/experiences', title: /Experiences \| Ember & Slice/, text: 'Pizza Making Class' },
    { path: '/experiences/pizza-making-class', title: /Pizza Making Class Brooklyn \| Ember & Slice/, text: 'Stretch dough' },
    { path: '/experiences/natural-wine-and-pizza-night', title: /Natural Wine & Pizza Night Brooklyn \| Ember & Slice/, text: 'Small pours' },
    { path: '/experiences/family-pizza-night', title: /Family Pizza Night Brooklyn \| Ember & Slice/, text: 'Big-table dinner' },
  ],
}

export const compiledDemoSeed = compileCuratedSiteFixture(demoFixture)

export function renderCompiledDemoCoreSeedBlock(): string {
  const settings = compiledDemoSeed.settings

  const siteLocaleRows = compiledDemoSeed.siteLocales
    .map((entry) => `  (${[
      sqlValue(entry.id),
      sqlValue(compiledDemoSeed.identity.organizationId),
      sqlValue(compiledDemoSeed.identity.siteId),
      sqlValue(entry.locale),
      sqlValue(entry.label),
      sqlValue(entry.isSource),
      sqlValue(entry.status),
    ].join(', ')})`)
    .join(',\n')

  const siteDomainRows = compiledDemoSeed.siteDomains
    .map((entry) => `  (${[
      sqlValue(entry.id),
      sqlValue(compiledDemoSeed.identity.organizationId),
      sqlValue(compiledDemoSeed.identity.siteId),
      sqlValue(entry.domain),
      sqlValue(entry.type),
      sqlValue(entry.role),
      sqlValue(entry.status),
      sqlValue(entry.dnsStatus),
    ].join(', ')})`)
    .join(',\n')

  return `-- BEGIN GENERATED: demo_core
-- Canonical demo site core generated from the curated fixture contract.
INSERT OR REPLACE INTO sites (
  id, organization_id, theme_id, slug, subdomain,
  brand_name, brand_description,
  status, onboarding_status,
  contact_email, default_currency, vertical, settings_json, analytics_data_start_at
) VALUES (
  ${sqlValue(compiledDemoSeed.identity.siteId)},
  ${sqlValue(compiledDemoSeed.identity.organizationId)},
  ${sqlValue(compiledDemoSeed.site.themeId)},
  ${sqlValue(compiledDemoSeed.site.slug)},
  ${sqlValue(compiledDemoSeed.site.subdomain)},
  ${sqlValue(compiledDemoSeed.site.brandName)},
  ${sqlValue(compiledDemoSeed.site.brandDescription)},
  ${sqlValue(compiledDemoSeed.site.status)},
  ${sqlValue(compiledDemoSeed.site.onboardingStatus)},
  ${sqlValue(compiledDemoSeed.site.contactEmail)},
  ${sqlValue(compiledDemoSeed.site.defaultCurrency)},
  ${sqlValue(compiledDemoSeed.site.vertical)},
  ${sqlJson(settings)},
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);


INSERT OR REPLACE INTO site_locales
  (id, organization_id, site_id, locale, label, is_source, status)
VALUES
${siteLocaleRows};

INSERT OR REPLACE INTO site_domains (id, organization_id, site_id, domain, type, role, status, dns_status)
VALUES
${siteDomainRows};
-- END GENERATED: demo_core`
}

export function renderCompiledDemoMediaBlock(): string {
  const mediaRows = compiledDemoSeed.mediaAssets
    .map((media) => `  (${[
      sqlValue(media.id),
      sqlValue(media.organizationId),
      sqlValue(media.siteId),
      sqlValue(media.kind),
      sqlValue(media.provider),
      sqlValue(media.source),
      sqlValue(media.cloudflareImageId),
      sqlValue(media.r2Key),
      sqlValue(media.publicUrl),
      sqlValue(media.thumbnailUrl),
      sqlValue(media.mimeType),
      sqlValue(media.fileName),
      sqlValue(media.altText),
      sqlValue(media.category),
      sqlValue(media.status),
    ].join(', ')})`)
    .join(',\n')

  const mediaPlacementRows = [
    ...compiledDemoSeed.site.media.map((media, index) => [`placement-site-${compiledDemoSeed.identity.siteId}-${media.slot}-${index}`, 'site', compiledDemoSeed.identity.siteId, media.slot, media.asset_id, index]),
    ...compiledDemoSeed.locations.flatMap(location => location.media.map((media, index) => [`placement-location-${location.id}-${media.slot}-${index}`, 'business_location', location.id, media.slot, media.asset_id, index])),
  ].map(([id, ownerType, ownerId, slot, assetId, sortOrder]) => `  (${[
    sqlValue(String(id)),
    sqlValue(compiledDemoSeed.identity.organizationId),
    sqlValue(compiledDemoSeed.identity.siteId),
    sqlValue(String(ownerType)),
    sqlValue(String(ownerId)),
    sqlValue(String(slot)),
    sqlValue(String(assetId)),
    sqlValue(Number(sortOrder)),
    sqlValue('active'),
  ].join(', ')})`).join(',\n')

  const locationRowsNoHero = compiledDemoSeed.locations
    .map((location) => `  (${[
      sqlValue(location.id),
      sqlValue(compiledDemoSeed.identity.organizationId),
      sqlValue(compiledDemoSeed.identity.siteId),
      sqlValue(location.slug),
      sqlValue(location.title),
      sqlValue(location.city),
      sqlJson(location.address),
      sqlValue(location.phone),
      sqlValue(location.email),
      sqlValue(location.mapsUrl),
      sqlValue(location.latitude),
      sqlValue(location.longitude),
      sqlValue(location.description),
      sqlValue(location.shortDescription),
      sqlJson(location.openingHours),
      sqlValue(location.rating),
      sqlValue(location.reviewCount),
      sqlValue(location.priceLevel),
      sqlJson(location.categories),
      sqlValue(location.instagramUrl),
      sqlValue(location.facebookUrl),
      sqlValue(location.status),
      sqlValue(DEMO_TIMEZONE),
    ].join(', ')})`)
    .join(',\n')

  return `-- BEGIN GENERATED: demo_media
INSERT OR REPLACE INTO business_locations (
  id, organization_id, site_id, slug, title, city,
  address, phone, email, maps_url,
  latitude, longitude,
  description, short_description,
  opening_hours,
  rating, review_count,
  price_level, categories,
  instagram_url, facebook_url,
  status, timezone
) VALUES
${locationRowsNoHero};

-- All media assets for the demo tenant.
INSERT OR REPLACE INTO media_assets
  (id, organization_id, site_id,
   kind, provider, source,
   cloudflare_image_id, r2_key, public_url, thumbnail_url,
   mime_type, file_name, alt_text, category, status)
VALUES
${mediaRows};

INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES
${mediaPlacementRows};

-- END GENERATED: demo_media`
}

export function renderCompiledDemoReviewsBlock(): string {
  const reviewRows = compiledDemoSeed.reviews
    .map((review) => `  (${[
      sqlValue(review.id),
      sqlValue(review.organizationId),
      sqlValue(review.siteId),
      sqlValue(review.locationId),
      sqlValue(review.authorName),
      sqlValue(review.rating),
      sqlValue(review.content),
      sqlValue(review.ownerReply),
      sqlValue(review.ownerReplyAt),
      sqlValue(review.status),
      sqlValue(review.source),
    ].join(', ')})`)
    .join(',\n')

  return `-- BEGIN GENERATED: demo_reviews
-- Reviews for the demo tenant.
INSERT OR IGNORE INTO reviews
  (id, organization_id, site_id, location_id,
   author_name, rating, content,
   owner_reply, owner_reply_at,
   status, source)
VALUES
${reviewRows};
-- END GENERATED: demo_reviews`
}

export function renderCompiledDemoProductsBlock(): string {
  const { categories, categoryIdByProductId, sortOrderByProductId } = buildSeedProductCategories(compiledDemoSeed.products)
  const productCategoryRows = categories
    .map(category => `  (${[
      sqlValue(category.id),
      sqlValue(category.organizationId),
      sqlValue(category.siteId),
      sqlValue(category.locationId),
      sqlValue('standard'),
      sqlValue(category.name),
      sqlValue(category.slug),
      sqlValue(category.sortOrder),
      sqlValue('seed:demo'),
      sqlValue('seed:demo'),
    ].join(', ')})`)
    .join(',\n')
  const productRows = compiledDemoSeed.products
    .map((product) => `  (${[
      sqlValue(product.id),
      sqlValue(product.organizationId),
      sqlValue(product.siteId),
      sqlValue(product.locationId),
      sqlValue('standard'),
      sqlValue(categoryIdByProductId.get(product.id)!),
      sqlValue(product.name),
      sqlValue(product.slug),
      sqlValue(product.description),
      sqlValue(true),
      sqlValue(product.available),
      sqlValue(product.featured),
      sqlValue(product.featuredSortOrder),
      sqlValue(sortOrderByProductId.get(product.id)!),
      sqlJson([]),
      sqlJson([
        ...(product.allergens ? [{ key: 'allergens', label: 'Allergens', values: JSON.parse(product.allergens) }] : []),
        ...(product.dietaryNotes ? [{ key: 'dietary-notes', label: 'Dietary notes', values: JSON.parse(product.dietaryNotes) }] : []),
      ]),
      sqlValue('template'),
      sqlValue('seed:demo'),
      sqlValue('seed:demo'),
    ].join(', ')})`)
    .join(',\n')
  const productPriceRows = compiledDemoSeed.products
    .map(product => `  (${[
      sqlValue(`price-${product.id}`), sqlValue(product.organizationId), sqlValue(product.siteId),
      sqlValue(product.locationId), sqlValue(product.id), sqlValue(Math.round(product.priceAmount * 100)),
      sqlValue(compiledDemoSeed.site.defaultCurrency), sqlValue('item'), sqlValue('unspecified'),
      'NULL', sqlValue('2026-01-01T00:00:00.000Z'), 'NULL', sqlValue('template'),
      sqlValue('seed:demo'), sqlValue('2026-01-01T00:00:00.000Z'),
    ].join(', ')})`)
    .join(',\n')
  const productMediaRows = compiledDemoSeed.products.flatMap(product => {
    const gallery = product.media.map((media, index) => ({ ...media, slot: 'gallery', index }))
    const primary = product.media[0] ? [{ ...product.media[0], slot: 'image', index: 0 }] : []
    return [...primary, ...gallery].map(media => `  (${[
      sqlValue(`${product.id}-${media.slot}-${media.index}`),
      sqlValue(product.organizationId), sqlValue(product.siteId),
      sqlValue('product'), sqlValue(product.id), sqlValue(media.slot),
      sqlValue(media.asset_id), media.index, sqlValue('active'),
    ].join(', ')})`)
  })
    .join(',\n')
  const productMediaSql = productMediaRows
    ? `

INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES
${productMediaRows};`
    : ''

  return `-- BEGIN GENERATED: demo_products
INSERT OR REPLACE INTO product_categories
  (id, organization_id, site_id, location_id, product_type, name, slug, sort_order, created_by, updated_by)
VALUES
${productCategoryRows};

INSERT OR REPLACE INTO products
  (id, organization_id, site_id, location_id, product_type, category_id, name, slug, description,
   is_visible, available, featured, featured_sort_order, sort_order,
   tags_json, details_json, source, created_by, updated_by)
VALUES
${productRows};

INSERT OR REPLACE INTO prices
  (id, organization_id, site_id, location_id, product_id, amount_minor, currency, unit, tax_behavior,
   compare_at_amount_minor, valid_from, valid_until, provenance, created_by, created_at)
VALUES
${productPriceRows};${productMediaSql}
-- END GENERATED: demo_products`
}

export function renderCompiledDemoQaBlock(): string {
  const qaRows = compiledDemoSeed.locationQa
    .map((qa) => `  (${[
      sqlValue(qa.id),
      sqlValue(qa.organizationId),
      sqlValue(qa.siteId),
      sqlValue(qa.locationId),
      sqlValue(qa.question),
      sqlValue(qa.answer),
      sqlValue('qa'), sqlValue('root'), sqlValue('en'),
      sqlJson({ question_author: qa.questionAuthor, answer_author: qa.answerAuthor, is_owner_answer: Number(qa.isOwnerAnswer), upvote_count: qa.upvoteCount }),
      sqlValue(qa.source),
      sqlValue(qa.status),
      sqlValue(qa.sortOrder),
    ].join(', ')})`)
    .join(',\n')

  const qaTranslations = compiledDemoSeed.qaTranslations?.map((qa) => {
    const originalQa = compiledDemoSeed.locationQa.find(q => q.id === qa.originalId)
    if (!originalQa) throw new Error(`Original Q&A not found: ${qa.originalId}`)
    return `INSERT INTO content_documents
  (id, organization_id, site_id, title, summary, kind, row_role, locale, root_id, root_role, source, status, visibility)
VALUES (${sqlValue(qa.id)}, ${sqlValue(originalQa.organizationId)}, ${sqlValue(originalQa.siteId)},
  ${sqlValue(qa.question)}, ${sqlValue(qa.answer)}, 'qa', 'representation', ${sqlValue(qa.locale)},
  ${sqlValue(originalQa.id)}, 'root', NULL, NULL, NULL);`
  }).join('\n') ?? ''

  return `-- BEGIN GENERATED: demo_qa
-- Location Q&A for the demo tenant.
INSERT INTO content_documents
  (id, organization_id, site_id, location_id, title, summary, kind, row_role, locale, metadata_json, source, status, sort_order)
VALUES
${qaRows};

${qaTranslations}
-- END GENERATED: demo_qa`
}

export function renderCompiledDemoPostsBlock(): string {
  const postRows = compiledDemoSeed.posts
    .map((post) => `  (${[
      sqlValue(post.id),
      sqlValue(post.organizationId),
      sqlValue(post.siteId),
      sqlValue(post.locationId),
      sqlValue(post.title), sqlValue(post.body),
      sqlValue('social_post'), sqlValue('root'), sqlValue('en'), sqlValue('template'),
      sqlJson({ post_type: post.post_type, call_to_action: post.call_to_action, event: post.event, offer: post.offer, alert_type: post.alert_type }),
      sqlValue(post.status),
      sqlValue(post.publishedAt),
      sqlValue(post.createdBy),
    ].join(', ')})`)
    .join(',\n')

  const postMediaRows = compiledDemoSeed.posts.flatMap(post => post.media.map((media, index) => `  (${[
    sqlValue(`placement-post-${post.id}-${media.slot}-${index}`), sqlValue(post.organizationId), sqlValue(post.siteId),
    sqlValue('content_document'), sqlValue(post.id), sqlValue(media.slot), sqlValue(media.asset_id), index, sqlValue('active'),
  ].join(', ')})`)).join(',\n')

  const postTranslations = compiledDemoSeed.postTranslations?.map((post) => {
    const originalPost = compiledDemoSeed.posts.find(p => p.id === post.originalId)
    if (!originalPost) throw new Error(`Original post not found: ${post.originalId}`)
    return `INSERT INTO content_documents
  (id, organization_id, site_id, title, summary, kind, row_role, locale, root_id, root_role, source, status, visibility, path, metadata_json)
VALUES (${sqlValue(post.id)}, ${sqlValue(originalPost.organizationId)}, ${sqlValue(originalPost.siteId)},
  ${sqlValue(post.title)}, ${sqlValue(post.body)}, 'social_post', 'representation', ${sqlValue(post.locale)},
  ${sqlValue(originalPost.id)}, 'root', NULL, NULL, NULL, ${sqlValue(postPublicPath(originalPost.id))}, ${sqlJson(post.metadata ?? {})});`
  }).join('\n') ?? ''

  return `-- BEGIN GENERATED: demo_posts
INSERT INTO content_documents
  (id, organization_id, site_id, location_id, title, summary, kind, row_role, locale, source, metadata_json, status, published_at, created_by)
VALUES
${postRows};

${postMediaRows ? `INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES
${postMediaRows};` : ''}

${postTranslations}
-- END GENERATED: demo_posts`
}

export function renderCompiledDemoResourceLocalizationsBlock(): string {
  const resourceRows = compiledDemoSeed.resourceLocalizations?.map((rl) => `  (${[
    sqlValue(rl.id),
    sqlValue(compiledDemoSeed.identity.organizationId),
    sqlValue(compiledDemoSeed.identity.siteId),
    sqlValue(rl.resourceType),
    sqlValue(rl.resourceId),
    sqlValue(rl.locale),
    sqlValue(rl.routePath ?? null),
    sqlJson(rl.valuesJson),
    sqlValue('seed:demo'),
    sqlValue('seed:demo'),
  ].join(', ')})`).join(',\n') || ''

  return `-- BEGIN GENERATED: demo_resource_localizations
-- Resource localizations for the demo tenant.
INSERT INTO resource_localizations
  (id, organization_id, site_id, resource_type, resource_id, locale, route_path, values_json, created_by_user_id, updated_by_user_id)
VALUES
${resourceRows};
-- END GENERATED: demo_resource_localizations`
}

/**
 * `bodyAssetId` is the picture inside the article, and it must not be the one
 * placed on the document as `featured`. The featured image already renders as
 * the article's lead, so seeding the same asset in both put the identical photo
 * on screen twice, one directly beneath the other, on every demo article.
 */
function demoArticleBlocks(body: string, title: string, blockId: string, bodyAssetId: string) {
  const content = markdownToContentBlocks(body)
  const first = content[0]
  if (first?.type === 'heading' && first.level === 1 && first.data.text === title) content.shift()
  const blocks = content.map((block, index) => ({ ...block, id: index === 0 ? blockId : `${blockId}-${index}`, position: index }))
  const image = { id: `${blockId}-image`, type: 'image' as const, level: null, position: blocks.length, data: {}, assetId: bodyAssetId }
  return [...blocks, image]
}

function renderDemoArticleBlocks(documentId: string, blocks: ReturnType<typeof demoArticleBlocks>, publishedAt: string, sourceBlocks?: ReturnType<typeof demoArticleBlocks>) {
  if (sourceBlocks && sourceBlocks.length !== blocks.length) {
    throw new Error(`Translated article ${documentId} has no matching source block structure`)
  }
  const rows = blocks.map((block, index) => {
    const source = sourceBlocks?.[index]
    if (sourceBlocks && (!source || block.type !== source.type || block.level !== source.level)) {
      throw new Error(`Translated article ${documentId} has no matching source block at position ${index}`)
    }
    const sourceBlockId = source ? source.id : null
    return `(${sqlValue(block.id)}, ${sqlValue(documentId)}, NULL, ${sqlValue(block.type)}, ${block.position}, ${sqlValue(block.level)}, ${sqlJson(block.data)}, ${sqlValue(publishedAt)}, ${sqlValue(publishedAt)}, ${sqlValue(sourceBlockId)})`
  }).join(',\n')
  const placements = blocks.filter(block => block.type === 'image').map(block => `INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES (${sqlValue(`${block.id}-media`)}, 'org-demo', 'site-demo', 'content_block', ${sqlValue(block.id)}, 'media', ${sqlValue(block.assetId)}, 0, 'active');`).join('\n')
  return `INSERT OR REPLACE INTO content_blocks
  (id, document_id, parent_block_id, type, position, level, data_json, created_at, updated_at, source_block_id)
VALUES ${rows};
${placements}`
}

export function renderCompiledDemoBlogBlock(): string {
  const publishedAt = '2026-07-08T00:00:00.000Z'
  const postId = 'blog-demo-wood-fired-guide'
  const blockId = 'content-block-demo-wood-fired-guide'
  const body = `# How We Build a Wood-Fired Pizza Night

At Ember & Slice, a great pizza night starts long before the oven is lit.

## Start with the dough

We cold-ferment our dough so it bakes with a light, airy rim and a crisp base.

## Build the room around the oven

The menu, music, and pacing of service all revolve around the heat and rhythm of the oven.

## Finish with neighborhood hospitality

We want the room to feel energetic but never rushed, whether you come in for one pie or settle in for the evening.`
  const blocks = demoArticleBlocks(body, 'How We Build a Wood-Fired Pizza Night', blockId, 'media-demo-post1')

  return `-- BEGIN GENERATED: demo_blog
-- Tenant blog post for local demo verification.
INSERT INTO content_documents
  (id, organization_id, site_id, title, slug, summary, metadata_json, status,
   author_id, published_at, created_at, updated_at,
   seo_description, seo_keywords, path, robots, kind, row_role, locale, visibility)
VALUES (
  ${sqlValue(postId)},
  ${sqlValue('org-demo')},
  ${sqlValue('site-demo')},
  ${sqlValue('How We Build a Wood-Fired Pizza Night')},
  ${sqlValue('how-we-build-a-wood-fired-pizza-night')},
  ${sqlValue('A quick behind-the-scenes look at how Ember & Slice builds its signature wood-fired dinner service.')},
  ${sqlJson({ category: 'Behind the scenes', hide_from_nav: false })},
  'published',
  ${sqlValue('user-demo')},
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue('Behind the scenes at Ember & Slice: dough, oven rhythm, and the service details that shape our wood-fired pizza nights.')},
  ${sqlValue('wood-fired pizza, restaurant blog, brooklyn pizza, behind the scenes')},
  ${sqlValue('/blog/how-we-build-a-wood-fired-pizza-night')},
  ${sqlValue('index,follow')},
  'article', 'root', 'en', 'public'
);

INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES ('placement-blog-demo-wood-fired-guide-featured', 'org-demo', 'site-demo', 'content_document', ${sqlValue(postId)}, 'featured', 'media-demo-hero', 0, 'active');


${renderDemoArticleBlocks(postId, blocks, publishedAt)}
-- END GENERATED: demo_blog`
}

export function renderCompiledDemoArticlesBlock(): string {
  const publishedAt = '2026-07-08T00:00:00.000Z'
  const article1Id = 'article-demo-sourdough-crust'
  const article1BlockId = 'content-block-demo-sourdough-crust'
  const article1Body = `# The Secret to Our 72-Hour Sourdough Crust

At Ember & Slice, we believe that great pizza starts with great dough. Our 72-hour sourdough process is the foundation of every pie that comes out of our wood-fired oven.

## The Science of Slow Fermentation

Our dough begins with a simple formula: flour, water, salt, and our active sourdough starter. But the magic happens in the timing. We cold-ferment our dough for 72 hours, a process that develops complex flavors and creates the texture our customers love.

During this extended fermentation, natural enzymes break down complex carbohydrates, making the dough more digestible and developing subtle tangy notes that you won't find in commercial yeast doughs. The long rest also allows the gluten structure to strengthen naturally, giving us that perfect balance of chew and crisp.

## Cold Proofing for Texture

After mixing, our dough goes straight into cold proofing. This slow, cold fermentation is key to achieving the open, airy crumb structure that makes our crust so distinctive. The cold environment keeps yeast activity slow and steady, preventing over-fermentation while allowing flavor development to continue uninterrupted.

## Hand-Stretching for Perfection

When we stretch your pizza, we're not just shaping dough—we're preserving the carbon dioxide bubbles created during fermentation. This careful hand-stretching technique, rather than mechanical rolling, maintains the delicate structure that gives our crust its characteristic leopard-spotted char and tender interior.

## High-Temperature Wood-Fired Baking

Our oven runs at 700-800°F, cooking each pizza in 60-90 seconds. This intense heat is necessary to achieve the contrast we're known for: a crisp, leopard-spotted crust with a tender, airy interior. The quick bake locks in the flavors developed during those 72 hours of fermentation.

## Why It Matters

Every element of our process serves a purpose. The 72-hour fermentation isn't just tradition—it's the foundation of the flavor, texture, and digestibility that make Ember & Slice pizzas unique. When you bite into that first slice, you're tasting three days of careful timing, temperature control, and patience.`

  const article1Blocks = demoArticleBlocks(article1Body, 'The Secret to Our 72-Hour Sourdough Crust', article1BlockId, 'media-demo-margherita')

  const article2Id = 'article-demo-natural-wine-pairing'
  const article2BlockId = 'content-block-demo-natural-wine-pairing'
  const article2Body = `# Why We Only Pair Natural Wines with Wood-Fired Pizza

Walk into Ember & Slice and you'll notice something immediately: our wine list is exclusively natural. This isn't a trend or a marketing angle—it's a deliberate philosophical choice that shapes how we think about food and wine pairing.

## Low-Intervention Philosophy

Natural wines are made with minimal intervention in both the vineyard and the cellar. No synthetic pesticides or herbicides, no added yeast or bacteria, no fining or filtration. The result is wine that expresses its terroir honestly—wines that are alive, vibrant, and constantly evolving.

This approach mirrors our food philosophy. Just as we source high-quality, seasonal ingredients and let them speak for themselves on our pizzas, we seek wines that are authentic expressions of their origin.

## Acidity and Freshness

Wood-fired pizza, with its high-heat cooking and charred crust, has inherent richness and intensity. Natural wines, with their bright acidity and fresh fruit profiles, provide the perfect counterpoint. The acidity cuts through the cheese and char, while the fresh fruit complements the seasonal toppings we use throughout the year.

## Practical Pairing Examples

**Margherita:** A crisp, mineral-driven white wine with citrus notes enhances the fresh basil and San Marzano tomatoes while cutting through the richness of the fior di latte.

**Pepperoni Calabrese:** A light-bodied red with bright red fruit and gentle tannins stands up to the spicy pepperoni without overwhelming the dish.

**Funghi Bianco:** An orange wine with good texture and earthy notes complements the roasted mushrooms and ricotta crema beautifully.

## Beyond Pairing—Creating an Experience

Natural wines are conversation starters. They have stories—about the winemaker, the vineyard, the vintage. When you share a bottle at Ember & Slice, you're not just getting a beverage pairing—you're participating in a broader story of small-scale agriculture, traditional methods, and respect for ingredients.

This aligns perfectly with our mission: to create a dining experience that's connected, thoughtful, and rooted in quality. Every element of what we serve, from the dough to the wine, is chosen with intention and care.`

  const article2Blocks = demoArticleBlocks(article2Body, 'Why We Only Pair Natural Wines with Wood-Fired Pizza', article2BlockId, 'media-demo-exp-wine')

  const article3Id = 'article-demo-ember-slice-story'
  const article3BlockId = 'content-block-demo-ember-slice-story'
  const article3Body = `# From Pop-Up to Brooklyn Staple: The Ember & Slice Story

Ember & Slice didn't start with a grand business plan or venture capital. It started with a sourdough starter, a borrowed mixer, and a simple idea: Brooklyn deserved great wood-fired pizza served with genuine hospitality.

## The Pop-Up Days

In the summer of 2019, we set up a temporary wood-fired oven behind a Brooklyn wine bar. The concept was simple: make great pizza, serve it with natural wine, create a warm atmosphere. We had no idea if it would work.

The first weekend, we sold out before sunset. The next weekend, the same. Then the weekend after that. People kept coming back—neighborhood regulars, curious foodies, people who just wanted a great pie and a welcoming place to eat it.

## Building the Foundation

During those pop-up months, we refined our dough. We experimented with fermentation times, flour blends, and hydration levels. We learned that 72 hours of cold fermentation gave us the crust we were looking for—airy, crisp, with complex flavor development.

We also learned something about hospitality: people wanted more than just good food. They wanted connection. They wanted to feel seen and welcomed. They wanted a place that felt like home, even if they'd never been there before.

## The Permanent Space

When we found our permanent location on Wythe Avenue, we knew we wanted to build around the oven. The oven isn't just equipment—it's the heart of the restaurant. The menu, the layout, the flow of service—all of it revolves around that open flame.

We opened the doors in 2020, and the neighborhood embraced us. The people who had followed us from the pop-up days brought their friends. New neighbors discovered us. We became part of the fabric of Williamsburg.

## Growing with the Community

As we grew, we stayed true to our founding principles. We kept the 72-hour dough. We kept the wood-fired oven. We kept the natural wine focus. We kept the warm, unpretentious hospitality.

We also expanded our experiences. The pizza making classes, the natural wine nights, the family pizza nights—these all grew out of requests from our community. People wanted to learn from us, celebrate with us, share special moments with us.

## Looking Forward

Today, Ember & Slice is a Brooklyn staple, but we still operate like a pop-up in spirit. We're still experimental, still refining, still listening to our community. The oven still anchors the room, and we still believe that great pizza and genuine hospitality can transform an ordinary evening into something special.

This is our story. We're grateful you're part of it.`

  const article3Blocks = demoArticleBlocks(article3Body, 'From Pop-Up to Brooklyn Staple: The Ember & Slice Story', article3BlockId, 'media-demo-team-1')

  const thaiTranslations = [
    {
      id: 'article-demo-sourdough-crust-th',
      originalId: article1Id,
      title: 'ความลับของแป้งซาวโดว์ 72 ชั่วโมงของเรา',
      slug: '72-hour-sourdough-crust-secret',
      summary: 'เริ่มต้นด้วยสูตรง่ายๆ: แป้ง น้ำ เกลือ และสตาร์ทเซอร์โดว์ที่เป็นชีวิตของเรา แต่ความมหัศจรรย์อยู่ที่เวลา',
      body: `# ความลับของแป้งซาวโดว์ 72 ชั่วโมงของเรา

ที่ Ember & Slice เราเชื่อว่าพิซซ่าที่ดีต้องเริ่มต้นด้วยแป้งที่ดี กระบวนการแป้งซาวโดว์ 72 ชั่วโมงของเราเป็นรากฐานของพิซซ่าทุกแผ่นที่ออกจากเตาฟืนไม้ของเรา

## วิทยาศาสตร์ของการหมักช้า

แป้งของเราเริ่มต้นด้วยสูตรง่ายๆ: แป้ง น้ำ เกลือ และสตาร์ทเซอร์โดว์ที่เป็นชีวิตของเรา แต่ความมหัศจรรย์อยู่ที่เวลา เราหมักแป้งในอุณหภูมิต่ำเป็นเวลา 72 ชั่วโมง ซึ่งเป็นกระบวนการที่พัฒนารสชาติที่ซับซ้อนและสร้างเนื้อสัมผัสที่ลูกค้ารัก

ระหว่างการหมักที่ยาวนานนี้ เอนไซม์ตามธรรมชาติย่อยสลายคาร์โบไฮเดรตที่ซับซ้อน ทำให้แป้งย่อยย่อยได้ง่ายขึ้นและพัฒนารสเปรี้ยวที่ละเอียดซึ่งคุณจะไม่พบในแป้งยีสต์เชิงพาณิชย์ การพักผ่อนที่ยาวนานยังช่วยให้โครงสร้างกลูเตนแข็งแรงขึ้นตามธรรมชาติ ทำให้เราได้ความสมดุลที่สมบูรณ์แบบของเคี้ยวและกรอบ

## การหมักเย็นเพื่อเนื้อสัมผัส

หลังจากผสม แป้งของเราจะเข้าสู่การหมักเย็นทันที การหมักช้าในอุณหภูมิต่ำนี้เป็นกุญแจในการสร้างโครงสร้างครัมบ์ที่เปิดและโฟมกลางที่ทำให้ขอบของเราโดดเด่น สภาพแวดล้อมที่เย็นช่วยคงกิจกรรมของยีสต์ให้ช้าและสม่ำเสมอ ป้องกันการหมักเกินขณะที่ยังอนุญาตให้การพัฒนารสชาติดำเนินต่อไปโดยไม่ขัดจังหวะ

## การยืดแป้งด้วยมือเพื่อความสมบูรณ์แบบ

เมื่อเรายืดพิซซ่าของคุณ เราไม่ได้เพียงแค่รูปแบบแป้ง—เรากำลังรักษาฟองคาร์บอนไดอกไซด์ที่เกิดขึ้นระหว่างการหมัก เทคนิคการยืดด้วยมืออย่างระมัดระวังนี้ แทนที่จะใช้การม้วนกลไฟฟ้า ช่วยรักษาโครงสร้างที่บอบบางที่ให้ขอบของเรามีลายเสือดำและด้านในที่นุ่มนวล

## การอบด้วยไฟไม้ที่อุณหภูมิสูง

เตาของเราทำงานที่ 700-800°F อบพิซซ่าแต่ละแผ่นใน 60-90 วินาที ความร้อนที่รุนแรงนี้จำเป็นเพื่อให้ได้ความตัดกันที่เรามีชื่อ: ขอบกรอบที่กรอบและมีลายเสือดำกับด้านในที่นุ่มอบอุ่น การอบที่รวดเร็วล็อกรสชาติที่พัฒนาขึ้นในช่วง 72 ชั่วโมงของการหมัก

## ทำไมมันสำคัญ

ทุกองค์ประกอบของกระบวนการของเรามีจุดประสงค์ การหมัก 72 ชั่วโมงไม่ใช่แค่ประเพณี—มันเป็นรากฐานของรสชาติ เนื้อสัมผัส และการย่อยย่อยที่ทำให้พิซซ่า Ember & Slice โดดเด่น เมื่อคุณกัดชิ้นแรก คุณรสชาติได้ถึงสามวันของการจัดการเวลาอย่างระมัดระวัง การควบคุมอุณหภูมิ และความอดทน`,
    },
    {
      id: 'article-demo-natural-wine-pairing-th',
      originalId: article2Id,
      title: 'ทำไมเราจึงจับคู่ไวน์ธรรมชาติกับพิซซ่าเตาฟืนไม้เท่านั้น',
      slug: 'natural-wine-pizza-pairing-guide',
      summary: 'เดินเข้ามาใน Ember & Slice และคุณจะสังเกตสิ่งหนึ่งทันที: รายการไวน์ของเราเป็นไวน์ธรรมชาติโดยเฉพาะ นี่ไม่ใช่เทรนด์หรือมุมการตลาด—มันเป็นทางเลือกทางปรัชญาที่เจาะจงที่กำหนดวิธีที่เราคิดเกี่ยวกับการจับคู่อาหารและไวน์',
      body: `# ทำไมเราจึงจับคู่ไวน์ธรรมชาติกับพิซซ่าเตาฟืนไม้เท่านั้น

เดินเข้ามาใน Ember & Slice และคุณจะสังเกตสิ่งหนึ่งทันที: รายการไวน์ของเราเป็นไวน์ธรรมชาติโดยเฉพาะ นี่ไม่ใช่เทรนด์หรือมุมการตลาด—มันเป็นทางเลือกทางปรัชญาที่เจาะจงที่กำหนดวิธีที่เราคิดเกี่ยวกับการจับคู่อาหารและไวน์

## ปรัชญาการแทรกแซงต่ำ

ไวน์ธรรมชาติทำขึ้นด้วยการแทรกแซงขั้นต่ำทั้งในไร่องุ่นและในห้องเก็บ ไม่มีสารกำจัดศัตรูพืชหรือสารเคมีเสริม ไม่มีการเติมยีสต์หรือแบคทีเรีย ไม่มีการใส่สีหรือการกรอง ผลลัพธ์คือไวน์ที่แสดงถึงแหล่งกำเนิดอย่างซื่อตรง—ไวน์ที่มีชีวิต สดใส และพัฒนาอย่างต่อเนื่อง

แนวทางนี้สะท้อนปรัชญาอาหารของเรา เช่นเดียวกับที่เราซื้อวัตถุดิบคุณภาพสูงตามฤดูกาลและปล่อยให้พวกมันพูดเล่าเองบนพิซซ่าของเรา เรามองหาไวน์ที่เป็นการแสดงออกที่ซื่อตรงของแหล่งกำเนิด

## ความเปรี้ยวและความสดใส

พิซซ่าเตาฟืนไม้ ด้วยการอบด้วยความร้อนสูงและขอบที่ไหม้ มีความอุดมและความเข้มโดยธรรมชาติ ไวน์ธรรมชาติ ด้วยความเปรี้ยวสดใสและโปรไฟล์ผลไม้สด ให้ความตัดกันที่สมบูรณ์แบบ ความเปรี้ยวตัดผ่านชีสและลายไหม้ ในขณะที่ผลไม้สดเสริมท็อปปิ้งตามฤดูกาลที่เราใช้ตลอดทั้งปี

## ตัวอย่างการจับคู่ในทางปฏิบัติ

**มาร์เกอริต้า:** ไวน์ขาวที่มีความเปรี้ยวและแร่นแร่ด้วยบันทึกส้มช่วยเติมเต็มใบซ่าโซมและมะเขือเทศซานมาร์นาโนในขณะที่ตัดผ่านความอุดมของฟิอร์ดีลาตเต้

**เป็ปเปอโรนีคาลาเบรเซ:** ไวน์แดงตัวเบาที่มีผลไม้แดงสดใสและแทนนินที่อ่อนๆ ยืนหน้าเป็ปเปอโรนีเผ็ดโดยไม่เด่นเกินไป

**ฟันจี บิองโก:** ไวน์ส้มที่มีเนื้อสัมผัสดีและรสชาติดินช่วยเติมเต็มเห็ดที่ย่างและครีมริคอตต้าได้อย่างสวยงาม

## นอกเหนือการจับคู่—สร้างประสบการณ์

ไวน์ธรรมชาติเป็นจุดเริ่มต้นของการสนทนา พวกมันมีเรื่องราว—เกี่ยวกับผู้ผลิตไวน์ ไร่องุ่น และปีที่ผลิต เมื่อคุณแบ่งขวงที่ Ember & Slice คุณไม่ได้รับเพียงเครื่องดื่มที่จับคู่—คุณมีส่วนร่วมในเรื่องราวที่กว้างขึ้นของการเกษตรขนาดเล็ก วิธีการแบบดั้งเดิม และความเคารพต่อวัตถุดิบ

สิ่งนี้สอดคล้องกับภารกิจของเรา: การสร้างประสบการณ์การรับประทานอาหารที่เชื่อมโยง มีความคิด และตั้งอยู่บนคุณภาพ ทุกองค์ประกอบของสิ่งที่เราเสิร์ฟ ตั้งแต่แป้งไปจนถึงไวน์ ถูกเลือกด้วยเจตนาและความเอาใจ`,
    },
    {
      id: 'article-demo-ember-slice-story-th',
      originalId: article3Id,
      title: 'จากป๊อปอัพสู่สัญลักษณ์ของบรูคลิน: เรื่องราวของ Ember & Slice',
      slug: 'ember-and-slice-brooklyn-story',
      summary: 'Ember & Slice ไม่ได้เริ่มต้นด้วยแผนธุรกิจที่ยิ่งใหญ่หรือเงินทุนจากเวนเจอร์แคปิตอล มันเริ่มต้นด้วยสตาร์ทเซอร์โดว์ เครื่องผสมที่ยืมมา และแนวคิดง่ายๆ: บรูคลินสมควรได้พิซซ่าเตาฟืนไม้ที่ดีพร้อมการต้อนรับที่จริงใจ',
      body: `# จากป๊อปอัพสู่สัญลักษณ์ของบรูคลิน: เรื่องราวของ Ember & Slice

Ember & Slice ไม่ได้เริ่มต้นด้วยแผนธุรกิจที่ยิ่งใหญ่หรือเงินทุนจากเวนเจอร์แคปิตอล มันเริ่มต้นด้วยสตาร์ทเซอร์โดว์ เครื่องผสมที่ยืมมา และแนวคิดง่ายๆ: บรูคลินสมควรได้พิซซ่าเตาฟืนไม้ที่ดีพร้อมการต้อนรับที่จริงใจ

## วันป๊อปอัพ

ในฤดูร้อนปี 2019 เราติดตั้งเตาฟืนไม้ชั่วคราวไว้หลังบาร์ไวน์แห่งหนึ่งในบรูคลิน แนวคิดง่ายๆ: ทำพิซซ่าที่ดี เสิร์ฟพร้อมไวน์ธรรมชาติ สร้างบรรยากาศที่อบอุ่น เราไม่รู้ว่ามันจะทำงานได้หรือไม่

สุดสัปดาห์แรก เราขายหมดก่อนพระอาทิตย์ตก สุดสัปดาห์ถัดมา เหมือนกัน แล้วก็อีกสุดสัปดาห์หลังจากนั้น คนกลับมาซ้ำ—ลูกค้าประจำในละแวก นักกินที่สนใจอาหาร และคนที่แค่อยากได้พิซซ่าที่ดีและสถานที่ต้อนรับที่อบอุ่น

## การสร้างรากฐาน

ระหว่างเดือนป๊อปอัพ เราปรับปรุงแป้งของเรา เราทดลองเวลาการหมัก ส่วนผสมแป้ง และระดับความชื้น เราเรียนรู้ว่าการหมักเย็น 72 ชั่วโมงให้เราได้ขอบที่เราตามหา—โฟมกลางที่โล่งและกรอบ พร้อมการพัฒนารสชาติที่ซับซ้อน

เรายังเรียนรู้สิ่งหนึ่งเกี่ยวกับการต้อนรับ: คนต้องการมากกว่าอาหารที่ดี พวกเขาต้องการการเชื่อมโยง พวกเขาต้องการรู้สึกว่าเห็นและต้อนรับอย่างอบอุ่น พวกเขาต้องการสถานที่ที่รู้สึกเหมือนบ้าน แม้ว่าพวกเขาจะไม่เคยมาที่นี่มาก่อน

## สถานที่ถาวร

เมื่อเราพบสถานที่ถาวรบน Wythe Avenue เรารู้ว่าเราต้องการสร้างรอบเตาอบ เตาอบไม่ใช่แค่อุปกรณ์—มันเป็นหัวใจของร้านอาหาร เมนู การจัดวาง การไหลของการบริการ—ทุกอย่างหมุนรอบเปลวไฟที่เปิดนั้น

เราเปิดประตูในปี 2020 และชุมชนยอมรับเรา คนที่ติดตามเรามาจากวันป๊อปอัพพาเพื่อนมาด้วย ลูกค้าบ้านใหม่ค้นพบเรา เรากลายเป็นส่วนหนึ่งของพื้นที่ของ Williamsburg

## เติบโตไปกับชุมชน

เมื่อเราเติบโต เรายังคงรักษาหลักการพื้นฐานของเรา เรายังคงแป้ง 72 ชั่วโมง เรายังคงเตาฟืนไม้ เรายังคงความโฟกัสไวน์ธรรมชาติ เรายังคงการต้อนรับที่อบอุ่นและเรียบง่าย

เรายังขยายประสบการณ์ของเรา คลาสทำพิซซ่า ค่ำคืนไวน์ธรรมชาติ ค่ำคืนพิซซ่าครอบครัว—สิ่งเหล่านี้ทั้งหมดเติบโตจากคำขอจากชุมชนของเรา คนต้องการเรียนรู้จากเรา เฉลิมฉลองกับเรา แบ่งปันช่วงเวลาพิเศษกับเรา

## มองไปข้างหน้า

วันนี้ Ember & Slice เป็นสัญลักษณ์ของบรูคลิน แต่เรายังดำเนินงานเหมือนป๊อปอัพในด้านจิตวิญญาณ เรายังทดลอง ยังปรับปรุง ยังฟังชุมชนของเรา เตาอบยังเป็นจุดศูนย์กลางของห้อง และเรายังเชื่อว่าพิซซ่าที่ดีและการต้อนรับที่จริงใจสามารถแปลงค่ำคืนธรรมดาให้กลายเป็นสิ่งพิเศษได้

นี่คือเรื่องราวของเรา เราขอบคุณที่เป็นส่วนหนึ่งของมัน`,
    },
  ]

  const sourceArticles = new Map([
    [article1Id, { blocks: article1Blocks, assetId: 'media-demo-margherita' }],
    [article2Id, { blocks: article2Blocks, assetId: 'media-demo-exp-wine' }],
    [article3Id, { blocks: article3Blocks, assetId: 'media-demo-team-1' }],
  ])
  const thaiSql = thaiTranslations.map((th) => {
    const thaiBlockId = `content-block-${th.id}`
    const original = sourceArticles.get(th.originalId)
    if (!original) throw new Error(`Original article not found: ${th.originalId}`)
    const blocks = demoArticleBlocks(th.body, th.title, thaiBlockId, original.assetId)
    return `INSERT INTO content_documents
  (id, organization_id, site_id, title, slug, summary, metadata_json, status,
   author_id, published_at, created_at, updated_at,
   seo_description, seo_keywords, path, robots, kind, row_role, locale, visibility,
   root_id, root_role, source)
VALUES (
  ${sqlValue(th.id)},
  ${sqlValue('org-demo')},
  ${sqlValue('site-demo')},
  ${sqlValue(th.title)},
  ${sqlValue(th.slug)},
  ${sqlValue(th.summary)},
  ${sqlJson({ category: 'Article', hide_from_nav: false })},
  NULL,
  NULL,
  NULL,
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue(th.summary)},
  ${sqlValue('pizza, restaurant blog, brooklyn pizza, article')},
  ${sqlValue(`/blog/${th.slug}`)},
  ${sqlValue('index,follow')},
  'article', 'representation', 'th', NULL,
  ${sqlValue(th.originalId)},
  'root', NULL
);

${renderDemoArticleBlocks(th.id, blocks, publishedAt, original.blocks)}`
  }).join('\n')

  return `-- BEGIN GENERATED: demo_articles
-- Editorial articles for the demo tenant.
INSERT INTO content_documents
  (id, organization_id, site_id, title, slug, summary, metadata_json, status,
   author_id, published_at, created_at, updated_at,
   seo_description, seo_keywords, path, robots, kind, row_role, locale, visibility)
VALUES (
  ${sqlValue(article1Id)},
  ${sqlValue('org-demo')},
  ${sqlValue('site-demo')},
  ${sqlValue('The Secret to Our 72-Hour Sourdough Crust')},
  ${sqlValue('72-hour-sourdough-crust-secret')},
  ${sqlValue('Our 72-hour sourdough process creates the foundation for every wood-fired pie at Ember & Slice.')},
  ${sqlJson({ category: 'Behind the scenes', hide_from_nav: false })},
  'published',
  ${sqlValue('user-demo')},
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue('Learn about Ember & Slice\'s 72-hour sourdough fermentation process and how it creates our signature crust.')},
  ${sqlValue('sourdough pizza, fermentation, crust, brooklyn pizza, wood-fired')},
  ${sqlValue('/blog/72-hour-sourdough-crust-secret')},
  ${sqlValue('index,follow')},
  'article', 'root', 'en', 'public'
);

INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES ('placement-article-sourdough-featured', 'org-demo', 'site-demo', 'content_document', ${sqlValue(article1Id)}, 'featured', 'media-demo-article-sourdough', 0, 'active');

${renderDemoArticleBlocks(article1Id, article1Blocks, publishedAt)}

INSERT INTO content_documents
  (id, organization_id, site_id, title, slug, summary, metadata_json, status,
   author_id, published_at, created_at, updated_at,
   seo_description, seo_keywords, path, robots, kind, row_role, locale, visibility)
VALUES (
  ${sqlValue(article2Id)},
  ${sqlValue('org-demo')},
  ${sqlValue('site-demo')},
  ${sqlValue('Why We Only Pair Natural Wines with Wood-Fired Pizza')},
  ${sqlValue('natural-wine-pizza-pairing-guide')},
  ${sqlValue('Discover why Ember & Slice exclusively pairs natural wines with wood-fired pizza.')},
  ${sqlJson({ category: 'Wine & Pairing', hide_from_nav: false })},
  'published',
  ${sqlValue('user-demo')},
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue('Our guide to natural wine and wood-fired pizza pairings at Ember & Slice.')},
  ${sqlValue('natural wine, pizza pairing, brooklyn wine, restaurant wine list')},
  ${sqlValue('/blog/natural-wine-pizza-pairing-guide')},
  ${sqlValue('index,follow')},
  'article', 'root', 'en', 'public'
);

INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES ('placement-article-wine-featured', 'org-demo', 'site-demo', 'content_document', ${sqlValue(article2Id)}, 'featured', 'media-demo-article-wine', 0, 'active');

${renderDemoArticleBlocks(article2Id, article2Blocks, publishedAt)}

INSERT INTO content_documents
  (id, organization_id, site_id, title, slug, summary, metadata_json, status,
   author_id, published_at, created_at, updated_at,
   seo_description, seo_keywords, path, robots, kind, row_role, locale, visibility)
VALUES (
  ${sqlValue(article3Id)},
  ${sqlValue('org-demo')},
  ${sqlValue('site-demo')},
  ${sqlValue('From Pop-Up to Brooklyn Staple: The Ember & Slice Story')},
  ${sqlValue('ember-and-slice-brooklyn-story')},
  ${sqlValue('The story of how Ember & Slice grew from a pop-up to a beloved Brooklyn institution.')},
  ${sqlJson({ category: 'Our Story', hide_from_nav: false })},
  'published',
  ${sqlValue('user-demo')},
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue(publishedAt)},
  ${sqlValue('From pop-up to Brooklyn staple: the Ember & Slice origin story.')},
  ${sqlValue('brooklyn restaurant, pizza story, small business, ember and slice')},
  ${sqlValue('/blog/ember-and-slice-brooklyn-story')},
  ${sqlValue('index,follow')},
  'article', 'root', 'en', 'public'
);

INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES ('placement-article-oven-featured', 'org-demo', 'site-demo', 'content_document', ${sqlValue(article3Id)}, 'featured', 'media-demo-article-oven', 0, 'active');

${renderDemoArticleBlocks(article3Id, article3Blocks, publishedAt)}
${thaiSql}
-- END GENERATED: demo_articles`
}

export function renderDemoExperienceSeedBlock(): string {
  const experienceMedia = compiledDemoSeed.experiences.flatMap(experience => experience.media.map((media, index) => ({ experience, media, index })))
  const { categories: experienceCategories, categoryIdForLocation, sortOrderFor } = buildSeedExperienceCategories(compiledDemoSeed.experiences, compiledDemoSeed.identity)
  const experienceCategoryRows = experienceCategories
    .map(category => `  (${[
      sqlValue(category.id), sqlValue(category.organizationId), sqlValue(category.siteId),
      sqlValue(category.locationId), sqlValue('experience'), sqlValue(category.name),
      sqlValue(category.slug), sqlValue(category.sortOrder),
      sqlValue('seed:demo'), sqlValue('seed:demo'),
    ].join(', ')})`)
    .join(',\n')
  const experienceProductRows = compiledDemoSeed.experiences
    .map(experience => `  (${[
      sqlValue(experience.id), sqlValue(experience.organizationId), sqlValue(experience.siteId),
      sqlValue(experience.locationId), sqlValue('experience'), sqlValue(categoryIdForLocation(experience.locationId)),
      sqlValue(experience.title), sqlValue(experience.slug), sqlValue(experience.body),
      sqlValue(experience.status !== 'inactive'), sqlValue(experience.status !== 'sold_out'),
      sqlValue(experience.featured), sqlValue(experience.featuredSortOrder), sqlValue(sortOrderFor(experience.id)),
      sqlJson(experience.tags), sqlJson(experience.details), sqlValue(experience.seoTitle), sqlValue(experience.seoDescription),
      sqlValue('template'), sqlValue('seed:demo'), sqlValue('seed:demo'),
      sqlJson({ tagline: experience.tagline, pricing_note: experience.priceAmount == null ? experience.price : null, duration_minutes: experience.durationMinutes, max_capacity: experience.maxCapacity, recurring_slots: experience.recurringSlots, included_items: experience.includedItems?.length ? experience.includedItems : null, what_to_bring: experience.whatToBring?.length ? experience.whatToBring : null, meeting_point: experience.meetingPoint ?? null, cancellation_policy: experience.cancellationPolicy ?? null }),
    ].join(', ')})`)
    .join(',\n')
  const experiencePriceRows = compiledDemoSeed.experiences
    .filter(experience => experience.priceAmount != null)
    .map(experience => {
      const unit = /per table/i.test(experience.price) ? 'table' : /per guest|per person/i.test(experience.price) ? 'person' : null
      if (!unit) throw new Error(`Unmapped demo experience pricing unit: ${experience.id} (${experience.price})`)
      return `  (${[
        sqlValue(`price-${experience.id}`), sqlValue(experience.organizationId), sqlValue(experience.siteId),
        sqlValue(experience.locationId), sqlValue(experience.id), sqlValue(Math.round(experience.priceAmount! * 100)),
        sqlValue(compiledDemoSeed.site.defaultCurrency), sqlValue(unit), sqlValue('unspecified'), 'NULL',
        sqlValue('2026-01-01T00:00:00.000Z'), 'NULL', sqlValue('template'), sqlValue('seed:demo'),
        sqlValue('2026-01-01T00:00:00.000Z'),
      ].join(', ')})`
    })
    .join(',\n')
  const coverBlock = experienceMedia.length
    ? `

INSERT OR REPLACE INTO media_placements
  (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
VALUES
${experienceMedia
  .map(({ experience, media, index }) => `  (${[
    sqlValue(`em-${experience.id}-${media.slot}-${index}`),
    sqlValue(experience.organizationId),
    sqlValue(experience.siteId),
    sqlValue('product'), sqlValue(experience.id), sqlValue(media.slot),
    sqlValue(media.asset_id),
    index, sqlValue('active'),
  ].join(', ')})`)
  .join(',\n')};`
    : ''

  return `-- BEGIN GENERATED: demo_experiences
-- Hybrid restaurant + experiences showcase for the platform demo.
INSERT OR REPLACE INTO product_categories
  (id, organization_id, site_id, location_id, product_type, name, slug, sort_order, created_by, updated_by)
VALUES
${experienceCategoryRows};

INSERT OR REPLACE INTO products
  (id, organization_id, site_id, location_id, product_type, category_id, name, slug, description,
   is_visible, available, featured, featured_sort_order, sort_order, tags_json, details_json,
   seo_title, seo_description, source, created_by, updated_by, experience_json)
VALUES
${experienceProductRows};

INSERT OR REPLACE INTO prices
  (id, organization_id, site_id, location_id, product_id, amount_minor, currency, unit, tax_behavior,
   compare_at_amount_minor, valid_from, valid_until, provenance, created_by, created_at)
VALUES
${experiencePriceRows};${coverBlock}
-- END GENERATED: demo_experiences`
}

export function renderCompiledDemoInboxBlock(): string {
  const now = new Date().toISOString()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: DEMO_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
  const day = (offset: number) => {
    const date = new Date(today + 'T00:00:00.000Z')
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
  }
  const requests: Array<{
    id: string; kind: 'contact' | 'reservation' | 'experience_booking'; location: string;
    name: string; email: string; phone: string | null; notes: string | null;
    date?: string; time?: string; party?: number; status?: string;
    state: 'needs_attention' | 'waiting_on_guest' | 'resolved'; created: string; updated: string;
    subject?: string; entryId?: string;
  }> = [
    { id: 'contact-demo-private-event', kind: 'contact', location: 'loc-demo', name: 'Maya Chen', email: 'maya.chen@example.com', phone: null, subject: 'Private dinner inquiry', notes: 'Hi! Could you host a birthday dinner for 18 people next month? We would love a family-style menu.', state: 'needs_attention', created: '2026-08-21T02:15:00.000Z', updated: '2026-08-21T02:15:00.000Z', entryId: 'entry-demo-contact-private-event-submission' },
    { id: 'reservation-demo-window-table', kind: 'reservation', location: 'loc-demo-2', name: 'Daniel Ortiz', email: 'daniel.ortiz@example.com', phone: '+1 917 555 0142', notes: 'Window table if possible; one guest has a dairy allergy.', date: '2026-08-23', time: '19:30', party: 4, status: 'pending', state: 'needs_attention', created: '2026-08-21T03:20:00.000Z', updated: '2026-08-21T03:20:00.000Z', entryId: 'entry-demo-reservation-window-table-submission' },
    { id: 'reservation-demo-completed', kind: 'reservation', location: 'loc-demo', name: 'Priya Shah', email: 'priya.shah@example.com', phone: '+1 646 555 0188', notes: 'Anniversary dinner.', date: '2026-08-20', time: '18:00', party: 2, status: 'completed', state: 'resolved', created: '2026-08-19T08:45:00.000Z', updated: '2026-08-20T13:30:00.000Z', entryId: 'entry-demo-reservation-completed-submission' },
    { id: 'booking-demo-pizza-class', kind: 'experience_booking', location: 'loc-demo', name: 'Sophie Laurent', email: 'sophie.laurent@example.com', phone: '+1 347 555 0109', notes: 'Two adults and one 12-year-old. Is vegetarian dough available?', date: '2026-08-24', time: '14:00', party: 3, status: 'confirmed', state: 'waiting_on_guest', created: '2026-08-21T04:10:00.000Z', updated: '2026-08-21T04:25:00.000Z', entryId: 'entry-demo-booking-pizza-class-submission' },
    { id: 'reservation-demo-today-maya', kind: 'reservation', location: 'loc-demo', name: 'Maya Chen', email: 'maya.today@example.test', phone: '+1-555-0101', notes: 'Window table if available.', date: day(0), time: '12:30', party: 2, status: 'confirmed', state: 'needs_attention', created: now, updated: now, entryId: 'entry-reservation-demo-today-maya' },
    { id: 'reservation-demo-today-daniel', kind: 'reservation', location: 'loc-demo-2', name: 'Daniel Ortiz', email: 'daniel.today@example.test', phone: '+1-555-0102', notes: null, date: day(0), time: '19:30', party: 4, status: 'confirmed', state: 'needs_attention', created: now, updated: now, entryId: 'entry-reservation-demo-today-daniel' },
    { id: 'reservation-demo-upcoming-priya', kind: 'reservation', location: 'loc-demo', name: 'Priya Shah', email: 'priya.upcoming@example.test', phone: '+1-555-0103', notes: null, date: day(3), time: '18:00', party: 3, status: 'confirmed', state: 'needs_attention', created: now, updated: now, entryId: 'entry-reservation-demo-upcoming-priya' },
    { id: 'booking-demo-today-sophie', kind: 'experience_booking', location: 'loc-demo', name: 'Sophie Laurent', email: 'sophie.today@example.test', phone: '+1-555-0104', notes: null, date: day(0), time: '14:00', party: 3, status: 'confirmed', state: 'needs_attention', created: now, updated: now },
    { id: 'booking-demo-upcoming-jordan', kind: 'experience_booking', location: 'loc-demo', name: 'Jordan Lee', email: 'jordan.upcoming@example.test', phone: '+1-555-0105', notes: null, date: day(7), time: '14:00', party: 2, status: 'confirmed', state: 'needs_attention', created: now, updated: now },
  ]
  return requests.map(row => {
    const guest = { name: row.name, email: row.email, phone: row.phone }
    const payload = row.kind === 'contact'
      ? { guest, subject: row.subject, message: row.notes, consent_at: null, ip_hash: null }
      : { guest, notes: row.notes, party_size_is_minimum: false, ip_hash: null,
          cancellation: { token_hash: null, expires_at: null, used_at: null },
          completion: { at: row.status === 'completed' ? row.updated : null, source: row.status === 'completed' ? 'manual' : null },
          review: { request_sent_at: null, reminder_sent_at: null, submitted_at: null } }
    return `INSERT OR REPLACE INTO requests
      (id, kind, organization_id, site_id, location_id, product_id, status, booking_date, time_slot, party_size, conversation_state, resolved_at, payload_json, created_at, updated_at)
      VALUES (${[row.id, row.kind, 'org-demo', 'site-demo', row.location, row.kind === 'experience_booking' ? 'exp-demo-pizza-class' : null, row.status ?? null, row.date ?? null, row.time ?? null, row.party ?? null, row.state, row.state === 'resolved' ? row.updated : null].map(sqlValue).join(', ')}, ${sqlJson(payload)}, ${sqlValue(row.created)}, ${sqlValue(row.updated)});
    INSERT OR REPLACE INTO activity_entries
      (id, kind, scope_kind, request_id, actor_kind, channel, event_name, payload_json, dedupe_key, sequence, occurred_at, created_at)
      VALUES (${sqlValue(row.entryId ?? 'entry-' + row.id + '-submission')}, 'submission', 'request', ${sqlValue(row.id)}, 'guest', 'web', ${sqlValue(row.kind + '_submitted')}, ${sqlJson({ kind: row.kind })}, ${sqlValue('request:' + row.id + ':submission')}, 1, ${sqlValue(row.created)}, ${sqlValue(row.created)});`
  }).join('\n') + `
INSERT OR REPLACE INTO activity_entries
  (id, kind, scope_kind, request_id, actor_kind, actor_user_id, channel, body, event_name, payload_json, dedupe_key, sequence, occurred_at, created_at)
VALUES
  ('entry-demo-booking-pizza-class-reply', 'message', 'request', 'booking-demo-pizza-class', 'member', 'user-demo', 'email',
   'Yes—we can make the entire class vegetarian. We will reserve three places for you.', NULL, '{}', 'entry:entry-demo-booking-pizza-class-reply', 2, '2026-08-21T04:25:00.000Z', '2026-08-21T04:25:00.000Z'),
  ('entry-demo-reservation-completed-resolution', 'resolution', 'request', 'reservation-demo-completed', 'member', 'user-demo', 'system',
   NULL, 'thread.resolved', '${JSON.stringify({ reason: 'completed' })}', 'entry:entry-demo-reservation-completed-resolution', 2, '2026-08-20T13:30:00.000Z', '2026-08-20T13:30:00.000Z');
`
}

export function renderCompiledDemoContentBlock(): string {
  return '-- BEGIN GENERATED: demo_content\n-- Page composition is seeded by demo_tenant_pages.\n-- END GENERATED: demo_content'
}

export function renderCompiledDemoTenantPagesBlock(): string {
  const sourceRows = compiledDemoSeed.tenantPageContent.filter(entry => !entry.locationId)
  return renderTenantPagesSeedSql({
    siteId: 'site-demo',
    organizationId: 'org-demo',
    sourceLocale: compiledDemoSeed.siteLocales.find(locale => locale.isSource)!.locale,
    locales: compiledDemoSeed.siteLocales.map(locale => ({ locale: locale.locale, status: locale.status })),
    rows: sourceRows,
    localeFields: compiledDemoSeed.tenantPageLocaleFields.filter(entry => !entry.locationId),
    pages: ['locations', 'menu', 'order', 'experiences', 'reservations', 'qa', 'reviews', 'posts', 'photos'],
    additionalPages: compiledDemoSeed.locations.map(location => ({
      page: 'location',
      path: `/locations/${location.slug}`,
      title: location.title,
    })),
    sqlValue,
    sqlJson,
  })
}

export function renderCompiledDemoBillingBlock(): string {
  const { identity, organizationBilling } = compiledDemoSeed
  const parts: string[] = []

  if (organizationBilling) {
    parts.push(renderOrganizationBillingSql(identity.organizationId, organizationBilling, sqlValue))
  }

  return `-- BEGIN GENERATED: demo_billing
${parts.join('\n\n')}
-- END GENERATED: demo_billing`
}
