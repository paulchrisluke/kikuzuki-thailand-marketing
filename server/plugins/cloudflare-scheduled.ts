import { definePlugin } from 'nitro';
import { runScheduledTasks } from '~/server/scheduled-tasks'

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    const workerEnv = env as ApiRecord
    await runScheduledTasks(controller.cron, workerEnv, {
      scheduledTime: controller.scheduledTime,
    })
  })
})
