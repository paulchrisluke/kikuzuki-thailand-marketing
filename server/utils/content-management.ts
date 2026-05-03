import type { D1Database } from '@cloudflare/workers-types'

export interface SiteContent {
  id: string
  page: string
  field: string
  content?: string
  hero_title?: string
  hero_subtitle?: string
  hero_video_url?: string
  updated_at: string
}

export interface StaffProfile {
  id: string
  name: string
  role: string
  bio?: string
  image_url?: string
  order_index: number
  active: boolean
  updated_at: string
}

export interface AwardRecognition {
  id: string
  title: string
  description?: string
  year?: number
  issuer?: string
  image_url?: string
  order_index: number
  active: boolean
  updated_at: string
}

// Site Content
export const getSiteContent = async (db: D1Database): Promise<SiteContent[]> => {
  const { results } = await db.prepare(
    `SELECT id, page, field, content, hero_title, hero_subtitle, hero_video_url, updated_at 
     FROM site_content ORDER BY page, field`
  ).all<SiteContent>()
  return results ?? []
}

export const getPageContent = async (db: D1Database, page: string): Promise<SiteContent[]> => {
  const { results } = await db.prepare(
    `SELECT id, page, field, content, hero_title, hero_subtitle, hero_video_url, updated_at 
     FROM site_content WHERE page = ? ORDER BY field`
  ).bind(page).all<SiteContent>()
  return results ?? []
}

export const getSiteContentField = async (db: D1Database, page: string, field: string): Promise<SiteContent | null> => {
  const result = await db.prepare(
    `SELECT id, page, field, content, hero_title, hero_subtitle, hero_video_url, updated_at 
     FROM site_content WHERE page = ? AND field = ?`
  ).bind(page, field).first<SiteContent>()
  return result ?? null
}

export const upsertSiteContent = async (db: D1Database, content: Omit<SiteContent, 'updated_at'>) => {
  await db.prepare(`
    INSERT INTO site_content (id, page, field, content, hero_title, hero_subtitle, hero_video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(page, field) DO UPDATE SET 
      content = excluded.content,
      hero_title = excluded.hero_title,
      hero_subtitle = excluded.hero_subtitle,
      hero_video_url = excluded.hero_video_url,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).bind(
    content.id || crypto.randomUUID(),
    content.page,
    content.field,
    content.content || null,
    content.hero_title || null,
    content.hero_subtitle || null,
    content.hero_video_url || null
  ).run()
}

// Staff Profiles
export const getStaffProfiles = async (db: D1Database): Promise<StaffProfile[]> => {
  const { results } = await db.prepare(
    `SELECT id, name, role, bio, image_url, order_index, active, updated_at 
     FROM staff_profiles ORDER BY order_index, name`
  ).all<StaffProfile>()
  return results ?? []
}

export const upsertStaffProfile = async (db: D1Database, profile: Omit<StaffProfile, 'updated_at'>) => {
  await db.prepare(`
    INSERT INTO staff_profiles (id, name, role, bio, image_url, order_index, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name,
      role = excluded.role,
      bio = excluded.bio,
      image_url = excluded.image_url,
      order_index = excluded.order_index,
      active = excluded.active,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).bind(
    profile.id || crypto.randomUUID(),
    profile.name,
    profile.role,
    profile.bio || null,
    profile.image_url || null,
    profile.order_index,
    profile.active ? 1 : 0
  ).run()
}

export const deleteStaffProfile = async (db: D1Database, id: string) => {
  await db.prepare(`DELETE FROM staff_profiles WHERE id = ?`).bind(id).run()
}

// Awards & Recognition
export const getAwardsRecognition = async (db: D1Database): Promise<AwardRecognition[]> => {
  const { results } = await db.prepare(
    `SELECT id, title, description, year, issuer, image_url, order_index, active, updated_at 
     FROM awards_recognition ORDER BY order_index, year DESC`
  ).all<AwardRecognition>()
  return results ?? []
}

export const upsertAwardRecognition = async (db: D1Database, award: Omit<AwardRecognition, 'updated_at'>) => {
  await db.prepare(`
    INSERT INTO awards_recognition (id, title, description, year, issuer, image_url, order_index, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      title = excluded.title,
      description = excluded.description,
      year = excluded.year,
      issuer = excluded.issuer,
      image_url = excluded.image_url,
      order_index = excluded.order_index,
      active = excluded.active,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).bind(
    award.id || crypto.randomUUID(),
    award.title,
    award.description || null,
    award.year || null,
    award.issuer || null,
    award.image_url || null,
    award.order_index,
    award.active ? 1 : 0
  ).run()
}

export const deleteAwardRecognition = async (db: D1Database, id: string) => {
  await db.prepare(`DELETE FROM awards_recognition WHERE id = ?`).bind(id).run()
}
