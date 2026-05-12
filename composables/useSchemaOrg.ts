// Composable for adding JSON-LD schema markup to pages
export function useSchemaOrg(schema: Record<string, any>) {
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(schema)
      }
    ]
  })
}

export function useOrganizationSchema() {
  useSchemaOrg({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'KrabiClaw',
    url: 'https://krabiclaw.com',
    logo: 'https://krabiclaw.com/krabi-claw-logo.png',
    description: 'The Shopify for restaurants. AI-powered restaurant website builder built in Krabi, Thailand.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Krabi',
      addressCountry: 'TH'
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@krabiclaw.com',
      contactType: 'customer service'
    }
  })
}

export function useWebSiteSchema() {
  useSchemaOrg({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'KrabiClaw',
    url: 'https://krabiclaw.com',
    description: 'AI-powered restaurant website builder',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://krabiclaw.com/search?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  })
}

export function useBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  useSchemaOrg({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  })
}

export function useArticleSchema(title: string, description: string, publishedAt: string, author: string) {
  useSchemaOrg({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: publishedAt,
    author: {
      '@type': 'Person',
      name: author
    },
    publisher: {
      '@type': 'Organization',
      name: 'KrabiClaw',
      logo: 'https://krabiclaw.com/krabi-claw-logo.png'
    }
  })
}
