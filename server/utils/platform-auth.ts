// Platform owner authentication utilities
// Platform owners: configured via PLATFORM_OWNER_EMAILS environment variable

export function isPlatformOwner(email: string | null | undefined): boolean {
  if (!email) return false
  
  const platformOwnerEmails = process.env.PLATFORM_OWNER_EMAILS || ''
  const emails = platformOwnerEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  
  return emails.includes(email.toLowerCase())
}

export function requirePlatformOwner(email: string | null | undefined): void {
  if (!isPlatformOwner(email)) {
    throw new Error('Platform owner access required')
  }
}
