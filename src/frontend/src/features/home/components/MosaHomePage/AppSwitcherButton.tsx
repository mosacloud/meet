import { CSSProperties, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfig } from '@/api/useConfig'

/* ── Design tokens ──────────────────────────────────────── */
const SURFACE = '#ffffff'
const BG = '#f7f8fa'
const BORDER = '#e6eaf1'
const INK = '#333333'
const GRAPHITE = '#5a6577'
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const SHADOW =
  '0 2px 4px rgba(0,0,0,.02), 0 4px 8px rgba(0,0,0,.03), 0 8px 16px rgba(0,0,0,.04), 0 16px 32px rgba(0,0,0,.05), 0 32px 64px rgba(0,0,0,.08)'

/* ── App metadata ───────────────────────────────────────── */
type AppId =
  | 'epicentre'
  | 'docs'
  | 'drive'
  | 'mail'
  | 'calendar'
  | 'chat'
  | 'commander'

const APP_META: Record<AppId, { icon: string; color: string; gradientEnd: string }> = {
  epicentre: { icon: '/images/icons/epicentre-icon.svg', color: '#0284C7', gradientEnd: '#0443F2' },
  docs:      { icon: '/images/icons/file-icon.svg',      color: '#06B6D4', gradientEnd: '#0891B2' },
  drive:     { icon: '/images/icons/folder-icon.svg',    color: '#F2AF05', gradientEnd: '#D97706' },
  mail:      { icon: '/images/icons/mail-icon.svg',      color: '#F8497B', gradientEnd: '#A0033A' },
  calendar:  { icon: '/images/icons/calendar-icon.svg',  color: '#A78BFA', gradientEnd: '#6D3FDE' },
  chat:      { icon: '/images/icons/chat-icon.svg',      color: '#FA7108', gradientEnd: '#C2410C' },
  commander: { icon: '/images/icons/commander-icon.svg', color: '#0284C7', gradientEnd: '#0064C8' },
}

const MEET_ICON = '/images/icons/camera-icon.svg'
const MEET_COLOR = '#00B574'
const MEET_GRADIENT_END = '#059669'

const APP_ORDER: AppId[] = ['epicentre', 'docs', 'drive', 'mail', 'calendar', 'chat', 'commander']

/* ── Sub-components ─────────────────────────────────────── */
const AppIcon = ({
  icon,
  label,
  color,
  gradientEnd,
  size = 40,
}: {
  icon: string
  label: string
  color: string
  gradientEnd: string
  size?: number
}) => (
  <span
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: size,
      height: size,
      borderRadius: size <= 36 ? 9 : 12,
      background: `linear-gradient(135deg, ${color} 0%, ${gradientEnd} 100%)`,
    }}
  >
    <img
      src={icon}
      alt={label}
      style={{ width: size * 0.45, height: size * 0.45, filter: 'brightness(0) invert(1)', display: 'block' }}
    />
  </span>
)

const AppTile = ({
  id,
  href,
  onClick,
  icon,
  color,
  gradientEnd,
}: {
  id: string
  href: string
  onClick: () => void
  icon: string
  color: string
  gradientEnd: string
}) => {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 8,
        borderRadius: 8,
        textDecoration: 'none',
        transition: `background 150ms ${EASE}`,
        minWidth: 0,
        background: hovered ? BG : 'transparent',
      }}
    >
      <AppIcon icon={icon} label={t(`app_switcher.apps.${id}.label`)} color={color} gradientEnd={gradientEnd} size={36} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "'Poppins', system-ui, sans-serif", fontSize: '0.8125rem', fontWeight: 600, color: INK }}>
          {t(`app_switcher.apps.${id}.label`)}
        </span>
        <span style={{ fontSize: '0.6875rem', color: GRAPHITE, whiteSpace: 'nowrap' }}>
          {t(`app_switcher.apps.${id}.subtitle`)}
        </span>
      </div>
    </a>
  )
}

const Panel = ({
  appUrls,
  onClose,
  opensUpward,
}: {
  appUrls: Record<string, string>
  onClose: () => void
  opensUpward: boolean
}) => {
  const { t } = useTranslation()
  const jumpTo = APP_ORDER.filter((id) => id in appUrls)

  const dropdownStyle: CSSProperties = {
    position: 'absolute',
    ...(opensUpward ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
    right: 0,
    width: 312,
    background: `linear-gradient(180deg, color-mix(in srgb, ${MEET_COLOR} 8%, transparent) 0%, transparent 100%) top center / 100% 80px no-repeat, ${SURFACE}`,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    boxShadow: SHADOW,
    padding: 14,
    zIndex: 2000,
    animation: `mosaAppSwitcherPanelIn 150ms ${EASE} both`,
  }

  return (
    <div style={dropdownStyle}>
      <style>{`
        @keyframes mosaAppSwitcherPanelIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 4px 10px' }}>
        <AppIcon icon={MEET_ICON} label={t('app_switcher.apps.meet.label')} color={MEET_COLOR} gradientEnd={MEET_GRADIENT_END} size={44} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: "'Poppins', system-ui, sans-serif", fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: GRAPHITE }}>
            {t('app_switcher.you_are_in')}
          </span>
          <span style={{ fontFamily: "'Poppins', system-ui, sans-serif", fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>
            {t('app_switcher.apps.meet.label')}
          </span>
        </div>
      </div>

      {jumpTo.length > 0 && (
        <>
          <div style={{ height: 1, background: BORDER, margin: '4px -14px 14px' }} />
          <span style={{ display: 'block', fontFamily: "'Poppins', system-ui, sans-serif", fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: GRAPHITE, padding: '0 4px', marginBottom: 8 }}>
            {t('app_switcher.jump_to')}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {jumpTo.map((id) => {
              const { icon, color, gradientEnd } = APP_META[id]
              return (
                <AppTile key={id} id={id} href={appUrls[id]} onClick={onClose} icon={icon} color={color} gradientEnd={gradientEnd} />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Public export ──────────────────────────────────────── */
export const AppSwitcherButton = () => {
  const { data: config } = useConfig()
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [opensUpward, setOpensUpward] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const appUrls = config?.APP_URLS ?? {}
  const hasOtherApps = APP_ORDER.some((id) => id in appUrls)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  if (!hasOtherApps) return null

  const handleOpen = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setOpensUpward(window.innerHeight - rect.bottom < 320)
    }
    setIsOpen((v) => !v)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: -8 }}>
      <button
        type="button"
        className="um-btn"
        aria-label={t('app_switcher.switch_app')}
        aria-expanded={isOpen}
        onClick={handleOpen}
      >
        <span
          aria-hidden
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${BORDER}`,
            borderRadius: '6px',
            padding: '6px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            {[...APP_ORDER, APP_ORDER[0], APP_ORDER[1]].map((id, i) => (
              <circle key={i} cx={3 + (i % 3) * 6} cy={3 + Math.floor(i / 3) * 6} r={2} fill={APP_META[id].color} />
            ))}
          </svg>
        </span>
      </button>
      {isOpen && <Panel appUrls={appUrls} onClose={() => setIsOpen(false)} opensUpward={opensUpward} />}
    </div>
  )
}
