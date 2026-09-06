<template>
  <div class="container mx-auto px-4 py-16">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-4xl font-bold text-default mb-6">Privacy Policy</h1>
      <p class="text-lg text-muted mb-12">How we protect your data</p>

      <article class="prose prose-lg max-w-none text-default">
        <p><strong>Effective Date:</strong> September 6, 2026</p>

        <p>This Privacy Policy describes how KrabiClaw ("we," "our," or "us") collects, uses, and shares your information when you use our website builder platform.</p>

        <h2>1. Information We Collect</h2>
        <ul>
            <li><strong>Account Data:</strong> Name, email address, and authentication credentials.</li>
            <li><strong>Service Data:</strong> Content and data you upload to build your websites.</li>
            <li><strong>Customer Data:</strong> Names, email addresses, phone numbers, messages, reservation requests, and experience-booking details submitted to your business.</li>
            <li><strong>Connected ChatGPT App:</strong> Tool arguments, selected file references, workspace identifiers, and results needed to carry out your requests. Diagnostic records include tool names, outcomes, timing, and shortened input and output summaries. Selected sensitive fields are redacted, but free-text content may still appear in these summaries.</li>
            <li><strong>Payment Data:</strong> Processed securely by our payment provider (Stripe). We do not store full credit card details.</li>
            <li><strong>Usage Data:</strong> IP addresses, browser types, and interaction metrics to improve our service.</li>
            <li><strong>Cookies:</strong> Essential cookies for authentication and platform functionality.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use your data solely to provide, maintain, and improve our services, process payments, and communicate with you regarding your account.</p>

        <h2>3. Information Sharing</h2>
        <p>We do not sell your personal data. We share information only with essential third-party service providers (e.g., hosting, analytics, and payment processors) or when required by law.</p>

        <ul>
            <li><strong>ChatGPT:</strong> When you connect the app, results from the workspace your account can access are returned to OpenAI. Depending on your request, these can include customer contact information and booking details. OpenAI processes your conversation and tool results under its applicable terms and privacy policies.</li>
            <li><strong>Hosting and Public Media:</strong> Cloudflare provides our application, database, and media infrastructure. Uploaded files and saved images receive public URLs, including before they are assigned to a webpage. Only upload files that you intend to make accessible at a public URL. Publishing or editing website content can make it visible to website visitors.</li>
            <li><strong>AI Document Processing:</strong> Document analysis and product extraction send the selected document, image, or PDF and the analysis instructions to Anthropic through Cloudflare AI Gateway. These operations also record credit usage. See <a href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data" target="_blank" rel="noopener noreferrer">Anthropic's commercial data-retention policy</a> for its processing and retention terms.</li>
            <li><strong>Business Lookups:</strong> Google Places receives the business lookup query when you request a Maps lookup. The lookup does not itself create a website or location.</li>
        </ul>

        <h2>4. Data Retention</h2>
        <ul>
            <li><strong>Account and Business Content:</strong> Account records, website content, customer inquiries, and bookings have no automatic age-based expiry. They remain stored until removed through the applicable account or content controls or a data-deletion request. Disconnecting ChatGPT does not delete these records.</li>
            <li><strong>Media:</strong> Uploaded media remains stored until deleted. Deleting a media asset removes its placements and requests deletion of its backing Cloudflare objects when no other asset references those objects. A deleted-asset metadata record remains in the database without an automatic expiry. Removing a placement alone does not delete the asset.</li>
            <li><strong>Tool Diagnostics and Usage Records:</strong> Application tool-call and usage records currently have no automatic age-based expiry. They remain stored unless removed as part of a data request or an operational cleanup. We do not promise a fixed deletion interval for these records.</li>
            <li><strong>AI Gateway Logs:</strong> Our gateway collects request and response logs with a limit of 100,000 entries and removes the oldest entries as new entries exceed that limit. This is a volume limit, not a fixed number of days; at low usage, entries may remain for an extended period.</li>
            <li><strong>Website Analytics:</strong> The scheduled cleanup targets raw pageview events older than 90 days and analytics sessions and aggregate reports older than approximately 740 days.</li>
            <li><strong>Backups:</strong> Deleted database records may remain in Cloudflare's point-in-time recovery history for up to 30 days. Separately retained release and rollback copies do not have an automatic deletion schedule; their removal must be addressed as part of a data-deletion request. We do not promise that deleting a live record immediately removes every backup copy.</li>
        </ul>

        <h2>5. Your Controls and Rights</h2>
        <p>You can edit supported business content and delete media through the CMS or the connected app. Account settings provide account-deletion controls. You can disconnect the app in ChatGPT to stop using that connection. To request access, correction, or deletion of personal information, including retained diagnostic records or backups, contact us using the address below. We may need to verify your identity and authority over the affected business before handling a request.</p>

        <h2>6. Contact Us</h2>
        <p>For privacy inquiries, please contact us at <strong>privacy@krabiclaw.com</strong>.</p>
      </article>
    </div>
  </div>
</template>

<script setup>

definePageMeta({
  layout: 'platform'
})

useSocialMetadata({
  template: 'platform',
  path: '/privacy',
  title: 'Privacy Policy',
  description: 'Privacy Policy for KrabiClaw website builder platform. Learn how we collect, use, and protect your personal information.',
  breadcrumbs: [
    { name: 'Home', url: '/' },
    { name: 'Privacy Policy', url: '/privacy' },
  ],
})
</script>
