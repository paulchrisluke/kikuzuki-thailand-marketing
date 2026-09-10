export const MARKDOWN_MIME_TYPES = new Set(["text/markdown", "text/x-markdown"]);
const MARKDOWN_EXTENSIONS = [".md", ".markdown"] as const;

export const MAX_MARKDOWN_BYTES = 256 * 1024;

export class MarkdownDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkdownDocumentError";
  }
}

export function resolveMarkdownMimeType(mimeType: string | undefined | null, filename?: string | null): string | null {
  const normalizedMimeType = mimeType?.toLowerCase();
  if (normalizedMimeType && MARKDOWN_MIME_TYPES.has(normalizedMimeType)) return "text/markdown";
  if ((!normalizedMimeType || normalizedMimeType === "application/octet-stream") && filename) {
    const lowerFilename = filename.toLowerCase();
    if (MARKDOWN_EXTENSIONS.some((extension) => lowerFilename.endsWith(extension))) return "text/markdown";
  }
  return null;
}

export function assertMarkdownSize(byteLength: number): void {
  if (byteLength > MAX_MARKDOWN_BYTES) {
    throw new MarkdownDocumentError(
      `Markdown file too large (${byteLength} bytes; max ${MAX_MARKDOWN_BYTES} bytes / ${Math.floor(MAX_MARKDOWN_BYTES / 1024)} KB).`
    );
  }
}

/** Strictly decodes UTF-8, throwing a clear error instead of silently
 *  replacing invalid byte sequences with U+FFFD (which would corrupt the
 *  document without any visible signal). */
export function decodeMarkdownText(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new MarkdownDocumentError("Could not read Markdown file: content is not valid UTF-8 text.");
  }
}
