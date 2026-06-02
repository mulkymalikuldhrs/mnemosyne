/**
 * Wiki Links Utility
 * Extract, render, and resolve [[wiki-links]] from markdown content.
 */

/**
 * Extract [[wiki-links]] from markdown content.
 * Returns array of link texts found between [[ and ]].
 */
export function extractWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g
  const links: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim())
  }
  return [...new Set(links)]
}

/**
 * Replace wiki-links in content with rendered links.
 * Converts [[Note Title]] to [Note Title](/notes?search=Note+Title)
 */
export function renderWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, text) => {
    return `[${text}](/notes?search=${encodeURIComponent(text)})`
  })
}

/**
 * Check if content contains wiki-links
 */
export function hasWikiLinks(content: string): boolean {
  return /\[\[[^\]]+\]\]/.test(content)
}

/**
 * Resolve wiki link texts to note IDs
 * Given a list of link texts and available notes, find matching notes
 */
export function resolveWikiLinks(
  linkTexts: string[],
  notes: Array<{ id: string; title: string }>
): Map<string, string | null> {
  const resolved = new Map<string, string | null>()
  for (const text of linkTexts) {
    const normalizedText = text.toLowerCase().trim()
    const match = notes.find(n => n.title.toLowerCase() === normalizedText)
    resolved.set(text, match?.id ?? null)
  }
  return resolved
}
