export type YouTubeVideo = {
  id: string
  canonicalUrl: string
}

/** Accept only a canonical YouTube video identifier - never HTML or arbitrary URLs. */
export function parseYouTubeVideo(input: string): YouTubeVideo | null {
  const value = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) {
    return { id: value, canonicalUrl: `https://www.youtube.com/watch?v=${value}` }
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] ?? null
  if (host === 'youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2] ?? null
    if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] ?? null
  }

  return id && /^[A-Za-z0-9_-]{11}$/.test(id)
    ? { id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` }
    : null
}

export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}
