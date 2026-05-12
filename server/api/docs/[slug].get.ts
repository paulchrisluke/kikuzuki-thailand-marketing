// GET /api/docs/[slug] - Get specific documentation file
import { readFile } from 'fs/promises'
import { join } from 'path'
import { jsonResponse } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) return jsonResponse({ error: 'Slug required' }, { status: 400 })

  try {
    const filePath = join(process.cwd(), 'docs', `${slug}.md`)
    const content = await readFile(filePath, 'utf-8')
    const titleMatch = content.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1] : slug

    return jsonResponse({ slug, title, content })
  } catch (error) {
    return jsonResponse({ error: 'Documentation not found' }, { status: 404 })
  }
})
