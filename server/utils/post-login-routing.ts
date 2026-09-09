import type { CloudflareEnv } from '~/server/utils/auth'
import { listUserOrganizations } from '~/server/utils/member-access'

export type PostLoginDestination = `/dashboard/${string}`

export interface PostLoginUser {
  id: string
}

export async function resolvePostLoginDestination(
  env: CloudflareEnv,
  user: PostLoginUser,
): Promise<PostLoginDestination> {
  const organizations = await listUserOrganizations(env, user.id)
  const organization = organizations
    .slice()
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0]

  if (organization) return `/dashboard/${encodeURIComponent(organization.slug)}`

  return '/dashboard/onboarding'
}
