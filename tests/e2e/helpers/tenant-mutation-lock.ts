import { mkdir, rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { TestInfo } from '@playwright/test'

export async function acquireTenantMutationLock(testInfo: TestInfo, tenantId: string) {
  const lockRoot = join(testInfo.config.outputDir, 'tenant-mutation-locks')
  const lockPath = join(lockRoot, tenantId)
  await mkdir(lockRoot, { recursive: true })

  while (true) {
    try {
      await mkdir(lockPath)
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await delay(100)
    }
  }

  return () => rmdir(lockPath)
}
