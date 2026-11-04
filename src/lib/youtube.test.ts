import { describe, expect, it } from 'vitest'
import { parseYouTubeVideo, safeExternalUrl } from './youtube'

describe('parseYouTubeVideo', () => {
  it('normalizes permitted YouTube URLs', () => {
    expect(parseYouTubeVideo('https://youtu.be/yvpv7w8mDco')).toEqual({ id: 'yvpv7w8mDco', canonicalUrl: 'https://www.youtube.com/watch?v=yvpv7w8mDco' })
    expect(parseYouTubeVideo('https://www.youtube.com/shorts/7Q6wr6S8ZnU')).toMatchObject({ id: '7Q6wr6S8ZnU' })
  })

  it('rejects scripts, HTML, and other hosts', () => {
    expect(parseYouTubeVideo('javascript:alert(1)')).toBeNull()
    expect(parseYouTubeVideo('<iframe src="https://youtube.com"></iframe>')).toBeNull()
    expect(parseYouTubeVideo('https://example.com/watch?v=yvpv7w8mDco')).toBeNull()
  })
})

it('permits only http(s) external links', () => {
  expect(safeExternalUrl('https://example.org/reference')).toBe('https://example.org/reference')
  expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
})
