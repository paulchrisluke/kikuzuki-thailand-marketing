export function markdownRequiresSourceMode(markdown: string): boolean {
  return /^\s*\|.*\|\s*$/m.test(markdown) || /<\/?[a-z][^>]*>/i.test(markdown)
}

export function editorModeFor(markdown: string): 'rich' | 'source' {
  return markdownRequiresSourceMode(markdown) ? 'source' : 'rich'
}
