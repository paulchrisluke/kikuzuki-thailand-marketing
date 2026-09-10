// The one way a tenant leaves KrabiClaw.
//
// Deletion is scheduled, not immediate: an owner asks for it, the organization
// (or account) carries a deletionScheduledAt instant, and the deletion-sweep
// task performs the deletion once the grace period has passed. Until then the
// sites keep serving and the request can be cancelled, so a misclick is not a
// dead business.
//
// Better Auth owns the delete itself. deleteOrganization goes through its
// organization adapter (members, invitations, then the organization row) and
// the database's ON DELETE CASCADE takes the sites, domains, locations,
// content and media rows with it — verified against D1, which enforces
// foreign keys on every statement. deleteAccount goes through Better Auth's
// internal adapter, the same call its own /delete-user route makes.
//
// Only the resources that live outside D1 need explicit release, and they have
// to be released *before* the rows that name them are gone: Cloudflare custom
// hostnames and Cloudflare Images. Everything else is the cascade's job.
//
// The organization plugin's own /organization/delete route is disabled
// (disableOrganizationDeletion in server/utils/auth.ts) so this module is the
// only path — a raw call to that route would skip the grace period and leak
// every external resource above.

import { queryAll, queryFirst, type DbClient } from '~/server/db'
import { d1JsonStringSet } from '~/server/db/d1-limits'
import { createAuth, type CloudflareEnv } from '~/server/utils/auth'
import { deleteImage } from '~/server/utils/cloudflare-images'
import { deleteOrganizationCustomDomains } from '~/server/utils/domains'
import { listOrganizationMembers, listUserOrganizations, organizationAdapter, resolveOrganizationMembership, type OrganizationAdapter } from '~/server/utils/member-access'

/** How long an owner has to change their mind. */
export const DELETION_GRACE_DAYS = 30

export function deletionDueAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
}

export interface ScheduledDeletion {
  scheduledAt: Date
  organizationIds: string[]
}

/**
 * Organizations the user owns alone. Deleting the account deletes these with
 * it; organizations with another owner simply lose a member.
 */
export async function listSoleOwnedOrganizationIds(env: CloudflareEnv, userId: string): Promise<string[]> {
  const organizations = await listUserOrganizations(env, userId)
  const soleOwned: string[] = []
  for (const organization of organizations) {
    const membership = await resolveOrganizationMembership(env, { organizationId: organization.id, userId })
    if (membership?.role !== 'owner') continue
    const members = await listOrganizationMembers(env, organization.id)
    if (members.filter(member => member.role === 'owner').length === 1) soleOwned.push(organization.id)
  }
  return soleOwned
}

/**
 * A paid plan has to be cancelled first: deleting the organization would take
 * the billing projection with it and leave the Stripe subscription charging a
 * customer with nothing to show for it.
 */
export async function findPaidOrganization(
  db: DbClient,
  organizationIds: string[],
  now: Date,
): Promise<string | null> {
  if (organizationIds.length === 0) return null
  const paid = await queryFirst<{ organization_id: string }>(db, `
    SELECT organization_id FROM organization_billing
    WHERE organization_id IN (SELECT value FROM json_each(?))
      AND access_plan <> 'free'
      AND (access_expires_at IS NULL OR access_expires_at > ?)
    LIMIT 1
  `, [d1JsonStringSet(organizationIds), now.toISOString()])
  return paid?.organization_id ?? null
}

async function setOrganizationDeletionScheduledAt(
  env: CloudflareEnv,
  organizationId: string,
  scheduledAt: Date | null,
): Promise<void> {
  const adapter = await organizationAdapter(env)
  // deletionScheduledAt is declared input: false so no Better Auth request body
  // can set it — which also keeps it out of the adapter's *write* type, while
  // the adapter still persists whatever it is given. This is the one place
  // allowed to write it.
  await adapter.updateOrganization(
    organizationId,
    { deletionScheduledAt: scheduledAt } as unknown as Parameters<OrganizationAdapter['updateOrganization']>[1],
  )
}

async function setUserDeletionScheduledAt(
  env: CloudflareEnv,
  userId: string,
  scheduledAt: Date | null,
): Promise<void> {
  const context = await createAuth(env).$context
  await context.internalAdapter.updateUser(userId, { deletionScheduledAt: scheduledAt })
}

/** Schedule one organization (and its sites) for deletion. */
export async function scheduleOrganizationDeletion(
  env: CloudflareEnv,
  organizationId: string,
  requestedAt = new Date(),
): Promise<ScheduledDeletion> {
  const scheduledAt = deletionDueAt(requestedAt)
  await setOrganizationDeletionScheduledAt(env, organizationId, scheduledAt)
  return { scheduledAt, organizationIds: [organizationId] }
}

export async function cancelOrganizationDeletion(env: CloudflareEnv, organizationId: string): Promise<void> {
  await setOrganizationDeletionScheduledAt(env, organizationId, null)
}

/**
 * Schedule the account. The organizations the user owns alone are scheduled
 * with it, so every dashboard those sites appear in shows the same pending
 * deletion instead of a site that silently disappears on sweep day.
 */
export async function scheduleAccountDeletion(
  env: CloudflareEnv,
  userId: string,
  requestedAt = new Date(),
): Promise<ScheduledDeletion> {
  const scheduledAt = deletionDueAt(requestedAt)
  const organizationIds = await listSoleOwnedOrganizationIds(env, userId)
  for (const organizationId of organizationIds) {
    await setOrganizationDeletionScheduledAt(env, organizationId, scheduledAt)
  }
  await setUserDeletionScheduledAt(env, userId, scheduledAt)
  return { scheduledAt, organizationIds }
}

export async function cancelAccountDeletion(env: CloudflareEnv, userId: string): Promise<void> {
  for (const organizationId of await listSoleOwnedOrganizationIds(env, userId)) {
    await setOrganizationDeletionScheduledAt(env, organizationId, null)
  }
  await setUserDeletionScheduledAt(env, userId, null)
}

/**
 * Cloudflare Images the organization is the last holder of. An image id shared
 * with another organization (an import can reuse one) stays.
 */
async function organizationOwnedImageIds(db: DbClient, organizationId: string): Promise<string[]> {
  const owned = await queryAll<{ cloudflare_image_id: string }>(db, `
    SELECT DISTINCT cloudflare_image_id FROM media_assets
    WHERE organization_id = ? AND cloudflare_image_id IS NOT NULL
  `, [organizationId])
  const imageIds = (owned || []).map(row => row.cloudflare_image_id)
  if (imageIds.length === 0) return []

  const shared = await queryAll<{ cloudflare_image_id: string }>(db, `
    SELECT DISTINCT cloudflare_image_id FROM media_assets
    WHERE organization_id <> ?
      AND cloudflare_image_id IN (SELECT value FROM json_each(?))
  `, [organizationId, d1JsonStringSet(imageIds)])
  const sharedIds = new Set((shared || []).map(row => row.cloudflare_image_id))
  return imageIds.filter(imageId => !sharedIds.has(imageId))
}

/**
 * Delete an organization now: release what lives outside D1 first, then let
 * Better Auth delete the organization and the cascade do the rest.
 *
 * Cloudflare failures are logged and skipped rather than aborting: the domain
 * path already queues its own reconciliation retry, and an image that outlives
 * its rows must not keep a customer's data alive in D1.
 */
export async function deleteOrganizationNow(env: CloudflareEnv, organizationId: string): Promise<void> {
  const db = env.DB
  await deleteOrganizationCustomDomains(env, db, organizationId)

  for (const imageId of await organizationOwnedImageIds(db, organizationId)) {
    await deleteImage(env, imageId).catch((error: unknown) => {
      console.error('tenant_deletion_image_release_failed', {
        organizationId,
        imageId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  const adapter = await organizationAdapter(env)
  await adapter.deleteOrganization(organizationId)
}

/**
 * Delete an account now: its sole-owned organizations first (so no site is
 * left with nobody who can administer it), then the user through Better Auth's
 * internal adapter — the same pair of calls its own /delete-user route makes.
 */
export async function deleteAccountNow(env: CloudflareEnv, userId: string): Promise<void> {
  for (const organizationId of await listSoleOwnedOrganizationIds(env, userId)) {
    await deleteOrganizationNow(env, organizationId)
  }
  const context = await createAuth(env).$context
  await context.internalAdapter.deleteUser(userId)
  await context.internalAdapter.deleteUserSessions(userId)
}

export interface DeletionSweepResult {
  organizations: number
  users: number
  skipped: string[]
}

interface DueRow { id: string }

/**
 * Rows whose grace period has passed. `user` and `organization` are Better
 * Auth-owned tables, so this reads them through Better Auth's own database
 * adapter rather than SQL of our own.
 */
async function findDueRows(env: CloudflareEnv, model: 'user' | 'organization', now: Date): Promise<DueRow[]> {
  const context = await createAuth(env).$context
  return await context.adapter.findMany<DueRow>({
    model,
    where: [{ field: 'deletionScheduledAt', operator: 'lte', value: now }],
    sortBy: { field: 'deletionScheduledAt', direction: 'asc' },
  })
}

/**
 * Perform every deletion whose grace period has passed. Accounts run first so
 * their organizations are removed by the account path rather than twice.
 */
export async function sweepScheduledDeletions(env: CloudflareEnv, now = new Date()): Promise<DeletionSweepResult> {
  const db = env.DB
  const result: DeletionSweepResult = { organizations: 0, users: 0, skipped: [] }

  for (const user of await findDueRows(env, 'user', now)) {
    const paid = await findPaidOrganization(db, await listSoleOwnedOrganizationIds(env, user.id), now)
    if (paid) {
      result.skipped.push(`user:${user.id}:paid_plan`)
      continue
    }
    await deleteAccountNow(env, user.id)
    result.users += 1
  }

  for (const organization of await findDueRows(env, 'organization', now)) {
    const paid = await findPaidOrganization(db, [organization.id], now)
    if (paid) {
      result.skipped.push(`organization:${organization.id}:paid_plan`)
      continue
    }
    await deleteOrganizationNow(env, organization.id)
    result.organizations += 1
  }

  return result
}
