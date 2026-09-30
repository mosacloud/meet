import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ProfileDropdown } from '../ProfileDropdown'
import { type ApiUser } from '@/features/auth/api/ApiUser'

// This suite only covers static (closed-state) rendering: it runs under
// Vitest's "node" environment, with no DOM and no testing-library, so the
// open/close, click-outside, Escape and upward-flip interaction logic (all
// effect-driven, via useDismissablePopup/usePopupPlacement/
// useMobileBreakpoint) can't run here and is left to manual/browser
// verification — matching the same gap documented in the sibling apps
// (drive, mail) ProfileDropdown tests.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && 'name' in options ? `${key} ${options.name as string}` : key,
  }),
}))

vi.mock('@/features/auth/utils/logout', () => ({
  logout: vi.fn(),
}))

let mockUser: ApiUser | undefined

vi.mock('@/features/auth/api/useUser', () => ({
  useUser: () => ({ user: mockUser }),
}))

const baseUser: ApiUser = {
  id: 'user-1',
  email: 'jane.doe@example.com',
  full_name: 'Jane Doe',
  last_name: 'Doe',
  language: 'en-us',
  language_confirmed_by_idp: false,
  picture: null,
  timezone: 'Europe/Paris',
}

describe('ProfileDropdown', () => {
  it('renders initials when the user has no picture', () => {
    mockUser = baseUser
    const markup = renderToStaticMarkup(<ProfileDropdown />)
    expect(markup).toContain('JD')
    expect(markup).not.toContain('<img')
  })

  it('renders an image when the user has a picture', () => {
    mockUser = { ...baseUser, picture: 'https://example.com/avatar.png' }
    const markup = renderToStaticMarkup(<ProfileDropdown />)
    expect(markup).toContain('https://example.com/avatar.png')
  })

  it('falls back to email-derived initials when full_name is missing', () => {
    mockUser = { ...baseUser, full_name: '' }
    const markup = renderToStaticMarkup(<ProfileDropdown />)
    expect(markup).toContain('J')
  })

  it('renders nothing when there is no logged-in user', () => {
    mockUser = undefined
    const markup = renderToStaticMarkup(<ProfileDropdown />)
    expect(markup).toBe('')
  })
})
