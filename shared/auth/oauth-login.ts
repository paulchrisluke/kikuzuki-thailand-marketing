export function googleSignInOptions(callbackURL?: string, loginHint?: string) {
  return {
    provider: 'google' as const,
    ...(loginHint ? { loginHint } : {}),
    ...(callbackURL ? { callbackURL } : {}),
  }
}

export function oauthContinuationDestination(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  if ('url' in data && typeof data.url === 'string') return data.url
  if ('redirect_uri' in data && typeof data.redirect_uri === 'string') return data.redirect_uri
  return ''
}
