import { definePlugin } from 'nitro'

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:queue', () => {
    throw new Error('Retired guest delivery queue must remain paused during the Epoch 4 rollback window')
  })
})
