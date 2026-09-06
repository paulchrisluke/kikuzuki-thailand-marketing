import { jsonResponse } from '~/server/utils/api-response'
import { loadDashboardContext } from '~/server/utils/dashboard-context-service'
import { finalizeRequestMetrics } from '~/server/utils/request-metrics'

export default defineHandler(async (event) => {
  const payload = await loadDashboardContext(event)
  return jsonResponse(finalizeRequestMetrics(event, 'dashboard-context', payload))
})
import { defineHandler } from 'nitro';
