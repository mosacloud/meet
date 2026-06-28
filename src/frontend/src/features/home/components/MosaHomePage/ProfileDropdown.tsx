import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/features/auth/api/useUser'
import { logout } from '@/features/auth/utils/logout'

// ─── avatar color hash — matches @gouvfr-lasuite/ui-kit logic ────────────────

const AVATAR_COLORS = [
  'gray', 'brand', 'red', 'orange', 'brown',
  'green', 'blue-1', 'blue-2', 'pink', 'yellow', 'purple',
] as const
type AvatarColor = (typeof AVATAR_COLORS)[number]

const PALETTE: Record<AvatarColor, string> = {
  gray:     '#6b7280',
  brand:    '#3b82f6',
  red:      '#ef4444',
  orange:   '#f97316',
  brown:    '#d97706',
  green:    '#0d9488',
  'blue-1': '#3b82f6',
  'blue-2': '#0ea5e9',
  pink:     '#ec4899',
  yellow:   '#eab308',
  purple:   '#a855f7',
}

function getUserColor(name: string): AvatarColor {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function getUserInitials(name: string): string {
  return name
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// ─── language data ────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', value: 'en', label: 'EN' },
  { code: 'nl', value: 'nl', label: 'NL' },
  { code: 'fr', value: 'fr', label: 'FR' },
  { code: 'de', value: 'de', label: 'DE' },
]

// ─── icons ────────────────────────────────────────────────────────────────────

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const ChevronDownSmall = ({ rotated }: { rotated: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ transform: rotated ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
  >
    <polyline points="2 4 6 8 10 4" />
  </svg>
)

// ─── component ────────────────────────────────────────────────────────────────

export const ProfileDropdown = () => {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [isLangOpen, setIsLangOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLang = useMemo(() => {
    const lang = i18n.language?.split('-')[0] || 'en'
    return LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]
  }, [i18n.language])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLanguageSelect = (lang: (typeof LANGUAGES)[0]) => {
    i18n.changeLanguage(lang.value).catch((err) => {
      console.error('Error changing language', err)
    })
    setIsLangOpen(false)
  }

  const handleLogout = () => {
    logout().catch((err) => {
      console.error('Error logging out', err)
    })
  }

  if (!user) return null

  const displayName = user.full_name || user.email
  const color = getUserColor(displayName)
  const avatarColor = PALETTE[color]
  const initials = getUserInitials(displayName)

  return (
    <div className="um-trigger" ref={ref}>
      <button
        className="um-btn"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-label={t('profile.openMenu', { name: displayName })}
        aria-expanded={isOpen}
      >
        <span className="um-avatar um-avatar--sm" style={{ backgroundColor: avatarColor }}>
          {initials}
        </span>
      </button>

      {isOpen && (
        <div className="um-popover" role="dialog">
          {/* identity */}
          <div className="um-identity">
            <span className="um-avatar um-avatar--md" style={{ backgroundColor: avatarColor }}>
              {initials}
            </span>
            <div className="um-identity__info">
              {user.full_name && (
                <p className="um-identity__name">{user.full_name}</p>
              )}
              <p className="um-identity__email">{user.email}</p>
            </div>
          </div>

          <div className="um-divider" />

          {/* logout */}
          <button className="um-action-row" onClick={handleLogout} type="button">
            <LogoutIcon />
            <span>{t('logout')}</span>
          </button>

          <div className="um-divider" />

          {/* language picker */}
          <div className="um-lang-section">
            <div className="um-lang-trigger-wrapper">
              <button
                className="um-lang-trigger"
                onClick={() => setIsLangOpen(!isLangOpen)}
                type="button"
              >
                <span>{currentLang.label}</span>
                <ChevronDownSmall rotated={isLangOpen} />
              </button>
            </div>

            {isLangOpen && (
              <div className="um-lang-dropdown">
                {LANGUAGES.filter((l) => l.code !== currentLang.code).map((lang) => (
                  <button
                    key={lang.code}
                    className="um-lang-option"
                    onClick={() => handleLanguageSelect(lang)}
                    type="button"
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
