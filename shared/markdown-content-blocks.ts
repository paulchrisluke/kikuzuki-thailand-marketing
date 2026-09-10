import { editorModeFor } from './markdown-editor-mode.ts'

type MarkdownContentBlock = {
  parent_block_id: null
  position: number
} & (
  | { type: 'heading'; level: number; data: { text: string; markdown: string } }
  | { type: 'markdown'; level: null; data: { markdown: string; editor_mode: 'rich' | 'source' } }
)

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/

export function markdownToContentBlocks(bodyMarkdown: string): MarkdownContentBlock[] {
  const lines = bodyMarkdown.replace(/\r/g, '').split('\n')
  const blocks: MarkdownContentBlock[] = []
  let markdownLines: string[] = []

  function flushMarkdown() {
    const markdown = markdownLines.join('\n').trim()
    if (markdown) {
      blocks.push({
        parent_block_id: null,
        type: 'markdown',
        position: blocks.length,
        level: null,
        data: { markdown, editor_mode: editorModeFor(markdown) },
      })
    }
    markdownLines = []
  }

  for (const line of lines) {
    const heading = HEADING_RE.exec(line)
    if (heading) {
      flushMarkdown()
      blocks.push({
        parent_block_id: null,
        type: 'heading',
        position: blocks.length,
        level: heading[1]?.length ?? 1,
        data: { text: heading[2]?.trim() ?? '', markdown: line.trim() },
      })
      continue
    }
    markdownLines.push(line)
  }
  flushMarkdown()

  if (!blocks.length) {
    blocks.push({
      parent_block_id: null,
      type: 'markdown',
      position: 0,
      level: null,
      data: { markdown: '', editor_mode: editorModeFor('') },
    })
  }

  return blocks.map((block, index) => ({ ...block, position: index }))
}
