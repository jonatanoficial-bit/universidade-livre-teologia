import { describe, expect, it } from 'vitest'
import { createInitialCatalog } from './data'

describe('initial academic catalog', () => {
  it('keeps the planned curriculum distinct from published content', () => {
    const catalog = createInitialCatalog()
    const curriculum = catalog.courses.filter((course) => !course.isPilot)
    expect(curriculum).toHaveLength(24)
    expect(catalog.modules.filter((module) => module.courseId !== 'mini-metodo')).toHaveLength(96)
    expect(catalog.lessons.filter((lesson) => lesson.visibility === 'published' && lesson.courseId === 'd01')).toHaveLength(3)
    expect(curriculum.filter((course) => course.status === 'development')).toHaveLength(23)
  })
})
