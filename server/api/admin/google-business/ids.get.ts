import { toWebRequest } from 'h3'
import { isAdminRequest } from '../../../utils/admin-auth'
import { cloudflareEnv, jsonResponse } from '../../../utils/api-response'
import { getGoogleAccessToken } from '../../../utils/google-business'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  if (!(await isAdminRequest(toWebRequest(event), env))) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  // To list these, we need a valid access token.
  // In our system, we store the refresh token in D1 or env.
  // For discovery, we can try to get a fresh token if we have the refresh token.
  
  try {
    const accessToken = await getGoogleAccessToken(env)

    // List Accounts
    const accountsResponse = await $fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` }
    }) as any

    const discovery = []

    if (accountsResponse.accounts) {
      for (const account of accountsResponse.accounts) {
        const accountId = account.name.split('/')[1]
        
        const locationsResponse = await $fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        }) as any

        const locations = (locationsResponse.locations || []).map((loc: any) => ({
          title: loc.title,
          locationId: loc.name.split('/')[3]
        }))

        discovery.push({
          accountName: account.displayedName || account.name,
          accountId,
          locations
        })
      }
    }

    return jsonResponse({ discovery })
  } catch (e: any) {
    return jsonResponse({ error: 'Discovery failed', message: e.message }, { status: 500 })
  }
})
