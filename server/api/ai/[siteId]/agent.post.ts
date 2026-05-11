// POST /api/ai/[siteId]/agent
// Conversational agent with tool use. Takes conversation history, runs a tool loop,
// and returns the final text reply plus a log of tool calls made.

import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'
import { callAiGateway, type AiTool, type AiMessage } from '~/server/utils/ai-gateway'
import { hasCredits, chargeCredits } from '~/server/utils/ai-credits'
import { listPosts, createPost, publishPost } from '~/server/utils/post-management'
import { getMenus, getMenuWithItems, createMenu, updateMenu, createMenuItem, updateMenuItem, deleteMenu } from '~/server/utils/menu-management'

const MAX_ITERATIONS = 10
const MODEL = 'claude-sonnet-4-6'

const TOOLS: AiTool[] = [
  {
    name: 'get_posts',
    description: 'List posts for this site. Optionally filter by status.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'published', 'archived'],
          description: 'Filter by status. Omit to get all posts.',
        },
      },
    },
  },
  {
    name: 'create_post',
    description: 'Create a new draft post. The post is saved as a draft — NOT published until publish_post is called.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short headline (max 80 chars). Optional.' },
        body: { type: 'string', description: 'Post body (max 400 chars). Friendly, warm tone.' },
      },
      required: ['body'],
    },
  },
  {
    name: 'publish_post',
    description: 'Publish a draft post to the website. Only call after confirming content with the user.',
    input_schema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'ID of the post to publish.' },
      },
      required: ['post_id'],
    },
  },
  {
    name: 'get_menu',
    description: 'Get the current menu with all its sections and items.',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string', description: 'Specific menu ID. Omit to get the first available menu.' },
      },
    },
  },
  {
    name: 'create_menu',
    description: 'Create a new menu. Call this to add a menu like "Take Me Away" or "Ao Nang Menu".',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Menu name, e.g. "Take Me Away" or "Ao Nang Menu".' },
        description: { type: 'string', description: 'Optional description for the menu.' },
        location_id: { type: 'string', description: 'Optional location ID to link this menu to a specific location.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'rename_menu',
    description: 'Rename an existing menu. Use this to change a menu name like renaming "fsad" to "Ao Nang Menu".',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string', description: 'ID of the menu to rename.' },
        name: { type: 'string', description: 'New menu name.' },
        description: { type: 'string', description: 'Optional new description.' },
      },
      required: ['menu_id', 'name'],
    },
  },
  {
    name: 'add_menu_items_batch',
    description: 'Add multiple menu items in a single call. ALWAYS use this instead of calling add_menu_item repeatedly. Accepts up to 100 items at once.',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string', description: 'ID of the menu to add items to.' },
        items: {
          type: 'array',
          description: 'Items to add.',
          items: {
            type: 'object',
            properties: {
              section: { type: 'string', description: 'Section/category name.' },
              name: { type: 'string', description: 'Dish name.' },
              description: { type: 'string', description: 'Short description. Optional.' },
              price: { type: 'string', description: 'Price string, e.g. "฿120". Optional.' },
            },
            required: ['section', 'name'],
          },
        },
      },
      required: ['menu_id', 'items'],
    },
  },
  {
    name: 'get_site_stats',
    description: 'Get a summary of site content: post counts by status, number of menus, number of menu items.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'rename_site',
    description: 'Update the brand name of the site. Also keeps the internal site name in sync.',
    input_schema: {
      type: 'object',
      properties: {
        brand_name: { type: 'string', description: 'The new brand name.' },
      },
      required: ['brand_name'],
    },
  },
  {
    name: 'get_locations',
    description: 'List all locations (branches) for this site.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_location',
    description: 'Create a new location/branch for this site.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Location name, e.g. "Take Me Away" or "Ao Nang Branch".' },
        city: { type: 'string', description: 'City name.' },
        phone: { type: 'string', description: 'Phone number.' },
        address: { type: 'string', description: 'Street address.' },
        is_primary: { type: 'boolean', description: 'Set as the primary location.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_location',
    description: 'Update an existing location. Updating the title ALSO automatically updates the URL slug to match — pass the desired title to sync the slug. Call get_locations first to get the location ID.',
    input_schema: {
      type: 'object',
      properties: {
        location_id: { type: 'string', description: 'ID of the location to update.' },
        title: { type: 'string', description: 'New name. Setting this also regenerates the URL slug.' },
        city: { type: 'string', description: 'City name.' },
        phone: { type: 'string', description: 'Phone number.' },
        address: { type: 'string', description: 'Street address.' },
      },
      required: ['location_id'],
    },
  },
  {
    name: 'add_menu_item',
    description: 'Add a new item to a menu. Call get_menu first to get the menu ID.',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string', description: 'ID of the menu to add to.' },
        section: { type: 'string', description: 'Section/category, e.g. "Mains", "Desserts".' },
        name: { type: 'string', description: 'Dish name.' },
        description: { type: 'string', description: 'Short description. Optional.' },
        price: { type: 'string', description: 'Price string, e.g. "฿120". Optional.' },
      },
      required: ['menu_id', 'section', 'name'],
    },
  },
  {
    name: 'update_menu_item',
    description: 'Update an existing menu item — name, price, description, or availability.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string', description: 'ID of the menu item to update.' },
        name: { type: 'string', description: 'New name.' },
        description: { type: 'string', description: 'New description.' },
        price: { type: 'string', description: 'New price string.' },
        available: { type: 'boolean', description: 'Set item as available or unavailable.' },
      },
      required: ['item_id'],
    },
  },
  {
    name: 'publish_menu',
    description: 'Publish a draft menu so it appears on the live site.',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string', description: 'ID of the menu to publish.' },
      },
      required: ['menu_id'],
    },
  },
  {
    name: 'delete_menu',
    description: 'Permanently delete a menu and all its items. Only use after the user confirms they want it deleted.',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string', description: 'ID of the menu to delete.' },
      },
      required: ['menu_id'],
    },
  },
]

const CONFIRM_REQUIRED = new Set(['publish_post', 'publish_menu', 'delete_menu'])

// Tools that mutate and should not run if the recent conversation shows no confirmation
function requiresConfirmation(name: string, recentMessages: AiMessage[]): boolean {
  if (!CONFIRM_REQUIRED.has(name)) return false
  const CONFIRM_WORDS = /\b(yes|ok|go ahead|do it|publish|confirm|proceed|sure)\b/i
  // Check the last 3 user turns for confirmation
  const userTurns = recentMessages
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => (typeof m.content === 'string' ? m.content : ''))
  return !userTurns.some(t => CONFIRM_WORDS.test(t))
}

async function executeTool(
  name: string,
  input: Record<string, any>,
  ctx: { db: any; orgId: string; siteId: string; userId: string; agentMessages?: AiMessage[] }
): Promise<any> {
  const { db, orgId, siteId, userId } = ctx

  if (requiresConfirmation(name, ctx.agentMessages ?? [])) {
    return {
      __requires_confirmation: true,
      message: `Please confirm you want to ${name.replace(/_/g, ' ')} before I proceed.`,
    }
  }

  switch (name) {
    case 'get_posts': {
      const posts = await listPosts(db, orgId, siteId, input.status)
      return posts.slice(0, 10).map(p => ({
        id: p.id,
        title: p.title,
        body: p.body.slice(0, 120) + (p.body.length > 120 ? '…' : ''),
        status: p.status,
        updated_at: p.updated_at,
      }))
    }

    case 'create_post': {
      const post = await createPost(db, orgId, siteId, { title: input.title, body: input.body }, userId)
      return { id: post.id, title: post.title, body: post.body, status: post.status }
    }

    case 'publish_post': {
      const result = await publishPost(db, orgId, siteId, input.post_id, ['site'])
      if (!result) return { error: 'Post not found or already published.' }
      return { id: result.id, title: result.title, status: result.status, published_at: result.published_at }
    }

    case 'get_menu': {
      if (input.menu_id) {
        const menu = await getMenuWithItems(db, orgId, siteId, input.menu_id)
        if (!menu) return { error: 'Menu not found.' }
        return menu
      }
      const menus = await getMenus(db, orgId, siteId)
      if (!menus.length) return { message: 'No menus found for this site.' }
      return await getMenuWithItems(db, orgId, siteId, menus[0]!.id) ?? { error: 'Failed to load menu.' }
    }

    case 'create_menu': {
      const menu = await createMenu(db, orgId, siteId, { name: input.name, description: input.description, locationId: input.location_id }, userId)
      return { id: menu.id, name: menu.name, description: menu.description, status: menu.status }
    }

    case 'rename_menu': {
      const menu = await updateMenu(db, orgId, siteId, input.menu_id, { name: input.name, description: input.description }, userId)
      return { id: menu.id, name: menu.name, description: menu.description, status: menu.status }
    }

    case 'confirm_bulk_operation': {
      return {
        confirmation_required: true,
        operation: input.operation,
        count: input.count,
        message: `About to perform: ${input.operation} (${input.count} items). Please confirm by saying "yes" or "proceed".`
      }
    }

    case 'get_site_stats': {
      const [postStats, menuCount, itemCount] = await Promise.all([
        db.prepare(
          'SELECT status, COUNT(*) as count FROM posts WHERE organization_id = ? AND site_id = ? GROUP BY status'
        ).bind(orgId, siteId).all(),
        db.prepare(
          'SELECT COUNT(*) as count FROM menus WHERE organization_id = ? AND site_id = ?'
        ).bind(orgId, siteId).first(),
        db.prepare(
          'SELECT COUNT(*) as count FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.organization_id = ? AND m.site_id = ?'
        ).bind(orgId, siteId).first(),
      ])
      const bySatus = (postStats.results ?? []).reduce((acc: any, row: any) => {
        acc[row.status] = row.count
        return acc
      }, {})
      return {
        posts: { draft: bySatus.draft ?? 0, published: bySatus.published ?? 0, archived: bySatus.archived ?? 0 },
        menus: menuCount?.count ?? 0,
        menu_items: itemCount?.count ?? 0,
      }
    }

    case 'rename_site': {
      const now = new Date().toISOString()
      const newSubdomain = input.brand_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      await db.prepare(
        'UPDATE sites SET brand_name = ?, name = ?, subdomain = ?, updated_at = ? WHERE id = ? AND organization_id = ?'
      ).bind(input.brand_name, input.brand_name, newSubdomain, now, siteId, orgId).run()
      return { brand_name: input.brand_name, subdomain: newSubdomain, updated: true }
    }

    case 'get_locations': {
      const rows = await db.prepare(
        `SELECT id, title, city, phone, status, is_primary
         FROM business_locations WHERE organization_id = ? AND site_id = ?
         ORDER BY is_primary DESC, title ASC`
      ).bind(orgId, siteId).all()
      return rows.results ?? []
    }

    case 'create_location': {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      await db.prepare(
        `INSERT INTO business_locations
           (id, organization_id, site_id, title, slug, city, phone, address, is_primary, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      ).bind(
        id, orgId, siteId,
        input.title, slug,
        input.city ?? null, input.phone ?? null,
        input.address ? JSON.stringify({ street: input.address }) : null,
        input.is_primary ? 1 : 0,
        now, now
      ).run()
      return { id, title: input.title, slug, status: 'active' }
    }

    case 'update_location': {
      const now = new Date().toISOString()
      const sets: string[] = ['updated_at = ?']
      const params: any[] = [now]
      if (input.title !== undefined) {
        sets.push('title = ?')
        params.push(input.title)
        // Keep slug in sync with title
        const newSlug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        sets.push('slug = ?')
        params.push(newSlug)
      }
      if (input.city !== undefined)  { sets.push('city = ?');  params.push(input.city) }
      if (input.phone !== undefined) { sets.push('phone = ?'); params.push(input.phone) }
      if (input.address !== undefined) {
        sets.push('address = ?')
        params.push(JSON.stringify({ street: input.address }))
      }
      params.push(input.location_id, orgId)
      await db.prepare(
        `UPDATE business_locations SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`
      ).bind(...params).run()
      const updated = await db.prepare(
        'SELECT id, title, city, phone, status FROM business_locations WHERE id = ? LIMIT 1'
      ).bind(input.location_id).first()
      return updated ?? { error: 'Location not found.' }
    }

    case 'add_menu_item': {
      const item = await createMenuItem(
        db, input.menu_id,
        { section: input.section, name: input.name, description: input.description, price: input.price },
        userId
      )
      return { id: item.id, name: item.name, section: item.section, price: item.price }
    }

    case 'update_menu_item': {
      const updates: any = {}
      if (input.name !== undefined)        updates.name = input.name
      if (input.description !== undefined) updates.description = input.description
      if (input.price !== undefined)       updates.price = input.price
      if (input.available !== undefined)   updates.available = input.available
      const item = await updateMenuItem(db, input.item_id, updates, userId)
      return { id: item.id, name: item.name, price: item.price, available: item.available }
    }

    case 'add_menu_items_batch': {
      const items: any[] = Array.isArray(input.items) ? input.items.slice(0, 100) : []
      const created = await Promise.all(
        items.map((item: any) =>
          createMenuItem(db, input.menu_id, {
            section: String(item.section || 'Menu').slice(0, 100),
            name: String(item.name || '').slice(0, 200),
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            price: item.price ? String(item.price).slice(0, 50) : undefined,
          }, userId)
        )
      )
      return { added: created.length, menu_id: input.menu_id }
    }

    case 'publish_menu': {
      const now = new Date().toISOString()
      await db.prepare(
        `UPDATE menus SET status = 'published', updated_at = ?, updated_by = ?
         WHERE id = ? AND organization_id = ? AND site_id = ?`
      ).bind(now, userId, input.menu_id, orgId, siteId).run()
      return { menu_id: input.menu_id, status: 'published' }
    }

    case 'delete_menu': {
      await deleteMenu(db, orgId, siteId, input.menu_id)
      return { menu_id: input.menu_id, deleted: true }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  if (!siteId) return jsonResponse({ error: 'Site ID required' }, { status: 400 })

  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const session = await getAuthSession(event, env)
  if (!session?.user?.id) return jsonResponse({ error: 'Authentication required' }, { status: 401 })

  const site = await db.prepare(`
    SELECT s.id, s.organization_id, s.brand_name FROM sites s
    JOIN organization o ON s.organization_id = o.id
    JOIN member m ON o.id = m.organizationId
    WHERE s.id = ? AND m.userId = ? AND m.role IN ('owner','admin','editor') LIMIT 1
  `).bind(siteId, session.user.id).first()
  if (!site) return jsonResponse({ error: 'Site not found or access denied' }, { status: 404 })

  const orgId: string = site.organization_id
  const userId: string = session.user.id

  const isDev = process.env.NODE_ENV === 'development'
  if (!isDev) {
    const creditOk = await hasCredits(db, orgId)
    if (!creditOk) return jsonResponse({ error: 'No AI credits remaining.' }, { status: 402 })
  }

  let body: { messages?: any[]; currentPage?: string }
  try { body = await readBody(event) } catch {
    return jsonResponse({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.messages) || !body.messages.length) {
    return jsonResponse({ error: 'messages array required' }, { status: 400 })
  }

  const siteName = (site.brand_name as string | null) ?? 'your site'
  const currentPage = body.currentPage ?? 'dashboard'

  const SYSTEM = `You are ChowBot, an AI assistant for restaurant website owners using Kikuzuki.
Help manage site content — posts, menus, locations, and more — with concise, action-oriented responses.

Site: ${siteName}
Current page: ${currentPage}

Capabilities (always use tools — never say you can't do something the tools support):
- Posts: list, create, publish
- Menus: create, rename, view items, add items (batch), update items, publish, delete
- Locations/branches: list, create, update (title auto-syncs slug)
- Site: rename brand name (also updates subdomain/URL slug)
- Stats: post counts, menu counts

Guidelines:
- Use tools to take real actions immediately — never say "I'll do that" without calling a tool
- After creating a post, show the content and confirm before publishing
- When adding multiple menu items, ALWAYS use add_menu_items_batch — pass ALL items in one call, never loop
- After add_menu_items_batch, reply: "Added X items to [menu name]."
- Before publish_post, publish_menu, or delete_menu, confirm with the user first
- Menus are DRAFT by default — they only appear on the live site after publish_menu is called
- Keep responses short — this is a chat panel
- Never say a feature is unavailable if a tool supports it`

  // Limit history to the last 8 client messages and cap each message at 4000 chars.
  // This prevents rate-limit errors from long pasted content. Tool-loop messages added
  // below are always kept intact — never windowed mid-loop, which would split
  // tool_use / tool_result pairs and cause a 400 from the API.
  const MAX_MSG_CHARS = 4000
  let initialMessages = body.messages.slice(-8)
  // Anthropic requires the first message to be from the user.
  while (initialMessages.length > 0 && initialMessages[0]?.role !== 'user') {
    initialMessages = initialMessages.slice(1)
  }
  const agentMessages: AiMessage[] = initialMessages.map((m: any) => {
    const raw = typeof m.content === 'string' ? m.content : String(m.content ?? '')
    return {
      role: m.role as 'user' | 'assistant',
      content: raw.length > MAX_MSG_CHARS ? raw.slice(0, MAX_MSG_CHARS) + '\n…[truncated]' : raw,
    }
  })

  // --- SSE streaming response ---
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const enc = new TextEncoder()

  const push = async (data: object) => {
    try {
      await writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch {
      // client disconnected — ignore
    }
  }

  const ctx = { db, orgId: orgId!, siteId: siteId!, userId: userId!, agentMessages }
  const toolCalls: Array<{ name: string; input: any; result: any }> = []
  let totalInput = 0
  let totalOutput = 0
  let cfLogId: string | null = null

  ;(async () => {
    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        let aiResponse
        let lastErr: any
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            aiResponse = await callAiGateway(env, agentMessages, {
              system: SYSTEM,
              tools: TOOLS,
              maxTokens: 8192,
              metadata: { org_id: orgId, site_id: siteId, action: 'chowbot' },
            })
            break
          } catch (err: any) {
            lastErr = err
            const is429 = err?.message?.includes('429') || err?.message?.includes('rate_limit')
            if (is429 && attempt === 0) {
              await new Promise(r => setTimeout(r, 8000))
              continue
            }
            console.error('[agent] callAiGateway error:', err?.message)
            await push({ type: 'error', message: is429
              ? 'Rate limit hit — please wait a moment and try again.'
              : (err?.message ?? 'AI generation failed. Please try again.')
            })
            return
          }
        }
        if (!aiResponse) {
          console.error('[agent] callAiGateway failed after retry:', lastErr?.message)
          await push({ type: 'error', message: 'AI generation failed after retry. Please try again.' })
          return
        }

        totalInput += aiResponse.usage.input_tokens
        totalOutput += aiResponse.usage.output_tokens
        cfLogId = aiResponse.cfLogId

        if (aiResponse.stop_reason === 'end_turn') {
          await push({ type: 'text', content: aiResponse.content.find(b => b.type === 'text')?.text ?? '' })
          break
        }

        if (aiResponse.stop_reason === 'tool_use') {
          agentMessages.push({ role: 'assistant', content: aiResponse.content })
          const results: any[] = []

          for (const block of aiResponse.content) {
            if (block.type !== 'tool_use') continue
            await push({ type: 'tool_start', name: block.name })
            const result = await executeTool(block.name || '', block.input ?? {}, ctx)
            toolCalls.push({ name: block.name || '', input: block.input, result })
            results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
            await push({ type: 'tool_done', name: block.name })
          }

          agentMessages.push({ role: 'user', content: results })
          continue
        }

        if (aiResponse.stop_reason === 'max_tokens') {
          await push({ type: 'text', content: 'Response too large. Try adding items section by section.' })
        } else {
          await push({ type: 'text', content: aiResponse.content.find(b => b.type === 'text')?.text ?? '' })
        }
        break
      }

      let creditsRemaining: number | null = null
      if (!isDev) {
        const charged = await chargeCredits(db, orgId, {
          siteId,
          action: 'chowbot',
          model: MODEL,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          cfGatewayLogId: cfLogId,
        })
        creditsRemaining = charged.newBalance
      }

      await push({ type: 'done', toolCalls, creditsRemaining })
    } catch (err: any) {
      console.error('[agent] stream error:', err?.message)
      await push({ type: 'error', message: err?.message ?? 'Something went wrong. Please try again.' })
    } finally {
      try { await writer.close() } catch { /* client disconnected — stream already closed */ }
    }
  })()

  return sendStream(event, readable)
})
