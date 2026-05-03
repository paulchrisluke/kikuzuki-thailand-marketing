export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  // Only run if we are inside the admin iframe
  if (window.top === window.self) return

  let highlightEl: HTMLDivElement | null = null

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'admin:focus') {
      const field = event.data.field
      const group = event.data.group

      // Try to find the element by ID first (section-group), or fallback to looking for the text content
      let target = document.getElementById(`section-${group}`) || document.getElementById(group)
      
      // If no explicit ID, we can try to guess based on group
      if (!target && group === 'hero') target = document.querySelector('header, .hero-section')
      if (!target && group === 'cta') target = document.querySelector('.cta-section, [bg="black"]')
      
      if (!target) return

      // Scroll to it
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Highlight it
      if (!highlightEl) {
        highlightEl = document.createElement('div')
        highlightEl.style.position = 'absolute'
        highlightEl.style.border = '3px solid #3b82f6' // blue-500
        highlightEl.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
        highlightEl.style.pointerEvents = 'none'
        highlightEl.style.zIndex = '999999'
        highlightEl.style.transition = 'all 0.3s ease'
        highlightEl.style.borderRadius = '16px'
        document.body.appendChild(highlightEl)
      }

      const rect = target.getBoundingClientRect()
      highlightEl.style.top = `${window.scrollY + rect.top - 8}px`
      highlightEl.style.left = `${window.scrollX + rect.left - 8}px`
      highlightEl.style.width = `${rect.width + 16}px`
      highlightEl.style.height = `${rect.height + 16}px`
      highlightEl.style.opacity = '1'

      // clear after 2 seconds
      setTimeout(() => {
        if (highlightEl) highlightEl.style.opacity = '0'
      }, 2000)
    }
  })
})
