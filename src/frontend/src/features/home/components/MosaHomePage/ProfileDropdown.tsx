import { CSSProperties, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/features/auth/api/useUser'
import { logout } from '@/features/auth/utils/logout'

/* ── Design tokens — matches AppSwitcherButton ─────────────── */
const SURFACE = '#ffffff'
const HOVER = '#eeeeee'
const BORDER = '#e6eaf1'
const INK = '#333333'
const GRAPHITE = '#5a6577'
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const SHADOW =
  '0 2px 4px rgba(0,0,0,.02), 0 4px 8px rgba(0,0,0,.03), 0 8px 16px rgba(0,0,0,.04), 0 16px 32px rgba(0,0,0,.05), 0 32px 64px rgba(0,0,0,.08)'
const DANGER = '#dc2626'
const DANGER_TINT = '#fef2f2'

const MOBILE_BREAKPOINT_QUERY = '(max-width: 480px)'

// ─── avatar color hash — matches @gouvfr-lasuite/ui-kit logic ────────────────

const AVATAR_COLORS = [
  'gray',
  'brand',
  'red',
  'orange',
  'brown',
  'green',
  'blue-1',
  'blue-2',
  'pink',
  'yellow',
  'purple',
] as const
type AvatarColor = (typeof AVATAR_COLORS)[number]

const PALETTE: Record<AvatarColor, string> = {
  gray: '#6b7280',
  brand: '#3b82f6',
  red: '#ef4444',
  orange: '#f97316',
  brown: '#d97706',
  green: '#0d9488',
  'blue-1': '#3b82f6',
  'blue-2': '#0ea5e9',
  pink: '#ec4899',
  yellow: '#eab308',
  purple: '#a855f7',
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

// ─── avatar ───────────────────────────────────────────────────────────────────

const Avatar = ({
  picture,
  initials,
  color,
  size,
  fontSize,
}: {
  picture?: string | null
  initials: string
  color: string
  size: number
  fontSize: string
}) => {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => {
    setImageFailed(false)
  }, [picture])
  const showImage = Boolean(picture) && !imageFailed

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        color: 'white',
        fontWeight: 700,
        fontSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        backgroundColor: showImage ? undefined : color,
      }}
    >
      {showImage ? (
        <img
          src={picture ?? undefined}
          alt=""
          onError={() => setImageFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initials
      )}
    </span>
  )
}

// ─── icons ────────────────────────────────────────────────────────────────────

const LogoutIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

/* ── Popover ────────────────────────────────────────────────── */

const Popover = ({
  fullName,
  email,
  picture,
  initials,
  avatarColor,
  opensUpward,
  isMobile,
  fixedOffset,
  label,
  onLogout,
}: {
  fullName?: string | null
  email: string
  picture?: string | null
  initials: string
  avatarColor: string
  opensUpward: boolean
  isMobile: boolean
  fixedOffset: number
  label: string
  onLogout: () => void
}) => {
  const { t } = useTranslation()

  const popoverStyle: CSSProperties = isMobile
    ? {
        position: 'fixed',
        ...(opensUpward ? { bottom: fixedOffset } : { top: fixedOffset }),
        left: '1rem',
        right: '1rem',
        margin: '0 auto',
        width: 'auto',
        maxWidth: 320,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        boxShadow: SHADOW,
        padding: '14px 0 8px',
        zIndex: 2000,
      }
    : {
        position: 'absolute',
        ...(opensUpward
          ? { bottom: 'calc(100% + 8px)' }
          : { top: 'calc(100% + 8px)' }),
        right: 0,
        minWidth: 240,
        maxWidth: 320,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        boxShadow: SHADOW,
        padding: '14px 0 8px',
        zIndex: 2000,
      }

  return (
    <div style={popoverStyle} role="dialog" aria-label={label}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '2px 14px 10px',
        }}
      >
        <Avatar
          picture={picture}
          initials={initials}
          color={avatarColor}
          size={36}
          fontSize="0.875rem"
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          {fullName && (
            <span
              style={{
                fontFamily: "'Poppins', system-ui, sans-serif",
                fontSize: '0.9375rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: INK,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {fullName}
            </span>
          )}
          <span
            style={{
              fontSize: '0.8125rem',
              color: GRAPHITE,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {email}
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />

      <button
        onClick={onLogout}
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: 'calc(100% - 28px)',
          margin: '0 14px',
          padding: '10px 8px',
          borderRadius: 8,
          fontSize: '0.9375rem',
          color: DANGER,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: `background 150ms ${EASE}`,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = DANGER_TINT
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background =
            'transparent'
        }}
      >
        <LogoutIcon />
        <span>{t('logout')}</span>
      </button>
    </div>
  )
}

/* ── Public export ─────────────────────────────────────────── */

export const ProfileDropdown = () => {
  const { t } = useTranslation()
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [opensUpward, setOpensUpward] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches
  )
  const [fixedOffset, setFixedOffset] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const measure = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const upward = window.innerHeight - rect.bottom < 240
      setOpensUpward(upward)
      setFixedOffset(
        upward ? window.innerHeight - rect.top + 8 : rect.bottom + 8
      )
    }
  }

  useEffect(() => {
    if (!isOpen) return
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [isOpen])

  const handleOpen = () => {
    measure()
    setIsOpen((v) => !v)
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
    <div
      ref={ref}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      <button
        ref={triggerRef}
        onClick={handleOpen}
        type="button"
        aria-label={t('profile.openMenu', { name: displayName })}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          transition: `background 150ms ${EASE}`,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = HOVER
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background =
            'transparent'
        }}
      >
        <Avatar
          picture={user.picture}
          initials={initials}
          color={avatarColor}
          size={28}
          fontSize="0.6875rem"
        />
      </button>

      {isOpen && (
        <Popover
          fullName={user.full_name}
          email={user.email ?? ''}
          picture={user.picture}
          initials={initials}
          avatarColor={avatarColor}
          opensUpward={opensUpward}
          isMobile={isMobile}
          fixedOffset={fixedOffset}
          label={t('profile.openMenu', { name: displayName })}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}
