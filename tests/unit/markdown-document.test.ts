import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_MARKDOWN_BYTES,
  assertMarkdownSize,
  decodeMarkdownText,
  resolveMarkdownMimeType,
} from '../../server/utils/markdown-document.ts'

test('resolveMarkdownMimeType recognizes Markdown MIME types and rejects unrelated types', () => {
  assert.equal(resolveMarkdownMimeType('text/markdown'), 'text/markdown')
  assert.equal(resolveMarkdownMimeType('text/x-markdown'), 'text/markdown')
  assert.equal(resolveMarkdownMimeType('TEXT/MARKDOWN'), 'text/markdown')
  assert.equal(resolveMarkdownMimeType('application/pdf'), null)
  assert.equal(resolveMarkdownMimeType('image/png'), null)
  assert.equal(resolveMarkdownMimeType('image/png', 'notes.md'), null)
})

test('resolveMarkdownMimeType falls back to a Markdown filename for generic or missing MIME types', () => {
  assert.equal(resolveMarkdownMimeType('application/octet-stream', 'notes.md'), 'text/markdown')
  assert.equal(resolveMarkdownMimeType(undefined, 'README.MARKDOWN'), 'text/markdown')
  assert.equal(resolveMarkdownMimeType('application/octet-stream', 'notes.txt'), null)
  assert.equal(resolveMarkdownMimeType(null), null)
})

test('assertMarkdownSize rejects files over the configured limit with a clear message', () => {
  assert.doesNotThrow(() => assertMarkdownSize(MAX_MARKDOWN_BYTES))
  assert.throws(
    () => assertMarkdownSize(MAX_MARKDOWN_BYTES + 1),
    /too large/i,
  )
})

test('decodeMarkdownText accepts valid UTF-8 and rejects invalid byte sequences', () => {
  const text = '# Café ☕\n\nBonjour à tous.'
  const bytes = new TextEncoder().encode(text)
  assert.equal(decodeMarkdownText(bytes.buffer), text)
  // 0xFF 0xFE is not a valid UTF-8 sequence.
  const invalid = new Uint8Array([0x23, 0x20, 0xff, 0xfe, 0x41])
  assert.throws(
    () => decodeMarkdownText(invalid.buffer),
    /not valid UTF-8/i,
  )
})
