// POST /api/contact - Platform contact form submission via Resend
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  let body: { name?: string; email?: string; message?: string }
  try { body = await readBody(event) } catch {
    return jsonResponse({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, email, message } = body

  if (!name || !email || !message) {
    return jsonResponse({ error: 'name, email, and message are required' }, { status: 400 })
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email)) {
    return jsonResponse({ error: 'Invalid email address' }, { status: 400 })
  }

  try {
    const env = cloudflareEnv(event)
    const resendApiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY

    if (!resendApiKey) {
      return jsonResponse({ error: 'Email service not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'KrabiClaw <hello@krabiclaw.com>',
        to: ['hello@krabiclaw.com'],
        subject: `Contact Form: ${name}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        `
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Resend API error:', errorText)
      return jsonResponse({ error: 'Failed to send email' }, { status: 500 })
    }

    // Store submission in database
    const db = env.REVIEWS_DB
    if (db) {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      await db.prepare(
        `INSERT INTO platform_contact_submissions (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)`
      ).bind(id, name, email, message, now).run()
    }

    return jsonResponse({ success: true, message: 'Message sent successfully' })
  } catch (error) {
    console.error('Contact form error:', error)
    return jsonResponse({ error: 'Failed to send message' }, { status: 500 })
  }
})
