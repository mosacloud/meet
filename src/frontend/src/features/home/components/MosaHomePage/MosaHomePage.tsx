import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUser } from '@/features/auth'
import { authUrl } from '@/features/auth/utils/authUrl'
import { navigateTo } from '@/navigation/navigateTo'
import { generateRoomId, useCreateRoom, isRoomValid } from '@/features/rooms'
import { usePersistentUserChoices } from '@/features/rooms/livekit/hooks/usePersistentUserChoices'
import { LaterMeetingDialog } from '@/features/home/components/LaterMeetingDialog'
import { ApiRoom } from '@/features/rooms/api/ApiRoom'

import {
  ArrowRight,
  ChevronDown,
  EuStars,
  GlobeIcon,
  PlusIcon,
  LinkIcon,
} from './MosaHomePage.icons'

const LANGUAGES = [
  { code: 'en', value: 'en', label: 'EN' },
  { code: 'nl', value: 'nl', label: 'NL' },
  { code: 'fr', value: 'fr', label: 'FR' },
  { code: 'de', value: 'de', label: 'DE' },
]

const LanguageSelector = () => {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLang = useMemo(() => {
    const lang = i18n.language?.split('-')[0] || 'en'
    return LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]
  }, [i18n.language])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (lang: (typeof LANGUAGES)[0]) => {
    i18n.changeLanguage(lang.value).catch((err) => {
      console.error('Error changing language', err)
    })
    setIsOpen(false)
  }

  return (
    <div className="mosa-home__lang-container" ref={ref}>
      <button
        className="mosa-home__lang-button"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <GlobeIcon />
        <span>{currentLang.label}</span>
        <ChevronDown rotated={isOpen} />
      </button>
      {isOpen && (
        <div className="mosa-home__lang-dropdown">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`mosa-home__lang-option ${currentLang.code === lang.code ? 'mosa-home__lang-option--selected' : ''}`}
              onClick={() => handleSelect(lang)}
              type="button"
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const MosaHomePage = () => {
  const { t } = useTranslation('home')
  const { isLoggedIn } = useUser()
  const [meetingCode, setMeetingCode] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [laterRoom, setLaterRoom] = useState<null | ApiRoom>(null)
  const createRef = useRef<HTMLDivElement>(null)

  const { mutateAsync: createRoom } = useCreateRoom()
  const {
    userChoices: { username },
  } = usePersistentUserChoices()

  useEffect(() => {
    document.title = t('mosa.pageTitle')
  }, [t])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createRef.current && !createRef.current.contains(event.target as Node)) {
        setIsCreateOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleJoinMeeting = () => {
    const code = meetingCode.trim().replace(`${window.location.origin}/`, '')
    if (code && isRoomValid(code)) {
      navigateTo('room', code)
    }
  }

  const handleCreateInstant = async () => {
    setIsCreateOpen(false)
    const slug = generateRoomId()
    const data = await createRoom({ slug, username })
    navigateTo('room', data.slug, {
      state: { create: true, initialRoomData: data },
    })
  }

  const handleCreateLater = async () => {
    setIsCreateOpen(false)
    const slug = generateRoomId()
    const data = await createRoom({ slug, username })
    setLaterRoom(data)
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600&family=Poppins:wght@600;700&display=swap"
        rel="stylesheet"
      />

      <div className="mosa-home">
        <div className="mosa-home__brand-panel">
          <div className="mosa-home__brand-bg">
            <div className="mosa-home__gradient-base" />
            <div className="mosa-home__grid-overlay" />
            <div className="mosa-home__orb mosa-home__orb--1" />
            <div className="mosa-home__orb mosa-home__orb--2" />
            <div className="mosa-home__orb mosa-home__orb--3" />
          </div>

          <div className="mosa-home__brand-content">
            <div className="mosa-home__app-icon">
              <img src="/assets/mosa.svg" alt="mosa.cloud" />
            </div>
            <h1 className="mosa-home__brand-title">mosa.cloud</h1>
            <p className="mosa-home__brand-tagline">
              {t('mosa.tagline')}
            </p>
          </div>

          <div className="mosa-home__brand-footer">
            <div className="mosa-home__eu-flag">
              <EuStars />
            </div>
            <span>{t('mosa.builtInEu')}</span>
          </div>
        </div>

        <div className="mosa-home__form-panel">
          <div className="mosa-home__lang-wrapper">
            <LanguageSelector />
          </div>

          <div className="mosa-home__mobile-accents" />

          <div className="mosa-home__mobile-header">
            <div className="mosa-home__mobile-logo" aria-label="mosa.cloud logo" />
            <span className="mosa-home__mobile-brand">mosa.cloud</span>
          </div>

          <div className="mosa-home__form-container">
            <div className="mosa-home__form-header">
              <h2>
                {t('mosa.welcomeTo')}{' '}
                <span className="mosa-home__product-highlight">Meet</span>
              </h2>
              <p>{t('mosa.productDescription')}</p>
            </div>

            <div className="mosa-home__actions">
              {isLoggedIn ? (
                <div className="mosa-home__create-wrapper" ref={createRef}>
                  <button
                    className="mosa-home__primary-button"
                    onClick={() => setIsCreateOpen(!isCreateOpen)}
                    type="button"
                    data-attr="create-meeting"
                  >
                    <span>{t('mosa.createMeetingButton')}</span>
                    <ChevronDown rotated={isCreateOpen} />
                  </button>
                  {isCreateOpen && (
                    <div className="mosa-home__create-dropdown">
                      <button
                        className="mosa-home__create-option"
                        onClick={handleCreateInstant}
                        type="button"
                        data-attr="create-option-instant"
                      >
                        <PlusIcon />
                        <span>{t('mosa.createMenu.instantOption')}</span>
                      </button>
                      <button
                        className="mosa-home__create-option"
                        onClick={handleCreateLater}
                        type="button"
                        data-attr="create-option-later"
                      >
                        <LinkIcon />
                        <span>{t('mosa.createMenu.laterOption')}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <a
                  className="mosa-home__primary-button"
                  href={authUrl()}
                  data-attr="login"
                >
                  <span>{t('mosa.signInButton')}</span>
                  <ArrowRight />
                </a>
              )}

              <div className="mosa-home__divider">
                <span>{t('mosa.orJoinMeeting')}</span>
              </div>

              <div className="mosa-home__join-meeting">
                <input
                  type="text"
                  className="mosa-home__join-input"
                  placeholder={t('mosa.enterMeetingCode')}
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
                />
                <button
                  type="button"
                  className="mosa-home__join-button"
                  onClick={handleJoinMeeting}
                  disabled={!meetingCode.trim()}
                >
                  {t('mosa.join')}
                </button>
              </div>
            </div>

            <p className="mosa-home__signup-prompt">
              {t('mosa.noAccount')}{' '}
              <a href="mailto:hi@mosa.cloud">{t('mosa.contactUs')}</a>
            </p>
          </div>

          <div className="mosa-home__mobile-footer">
            <div className="mosa-home__mobile-eu-flag">
              <EuStars />
            </div>
            <span>{t('mosa.builtInEu')}</span>
          </div>
        </div>
      </div>

      <LaterMeetingDialog
        room={laterRoom}
        onOpenChange={() => setLaterRoom(null)}
      />
    </>
  )
}
