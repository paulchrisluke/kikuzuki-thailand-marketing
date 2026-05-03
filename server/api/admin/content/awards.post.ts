import { toWebRequest } from 'h3'
import { upsertAwardRecognition, deleteAwardRecognition } from '~/server/utils/content-management'
import { isAdminRequest } from '~/server/utils/admin-auth'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  if (!(await isAdminRequest(toWebRequest(event), env))) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const db = env.D1_DATABASE

  try {
    if (body.action === 'delete' && body.id) {
      await deleteAwardRecognition(db, body.id)
      return { success: true }
    } else {
      await upsertAwardRecognition(db, body)
      return { success: true }
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save award'
    })
  }
})
