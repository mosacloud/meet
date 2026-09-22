import { useMutation } from '@tanstack/react-query'
import { keys } from '@/api/queryKeys'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { queryClient } from '@/api/queryClient'
import { updateUserPreferences } from './updateUserPreferences'
import { convertToBackendLanguage } from '@/utils/languages'
import {
  convertFromBackendLanguage,
  isLanguageConfirmedByIdentityProvider,
} from '@/utils/mosaLanguage'
import { useUser } from './useUser'
import { ApiError } from '@/api/ApiError.ts'
import { reportError } from '@/features/analytics/telemetry'
import type { ApiUserPreferences } from './updateUserPreferences'

/**
 * Hook that synchronizes user preferences with the backend for logged-in users:
 * - timezone: always pushed from the browser to the backend.
 * - language: once the backend reports `language_confirmed_by_idp` (see
 *   `isLanguageConfirmedByIdentityProvider`), the language is pulled from the backend into
 *   i18next and the in-app pickers are hidden — the IdP is authoritative. Until then, the
 *   browser-detected language is kept and pushed to the backend instead, so a user whose IdP
 *   never sends a "locale" claim isn't locked into English with no way to change it.
 */
export const useSyncUserPreferencesWithBackend = () => {
  const { i18n } = useTranslation()
  const { user, isLoggedIn } = useUser()

  const { mutateAsync } = useMutation({
    mutationFn: updateUserPreferences,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData([keys.user], updatedUser)
    },
  })

  // Baseline `i18n.language` seen while the IdP confirmed a language this
  // frontend can't map — lets the effect below tell an actual manual pick
  // apart from its own mount-time run, so it doesn't auto-push the browser
  // guess and silently overwrite the IdP's (unmappable but real) preference
  // before the user ever touches the picker.
  const unmappableConfirmedBaselineRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !isLoggedIn) return

    const languageConfirmed = isLanguageConfirmedByIdentityProvider(
      user.language_confirmed_by_idp,
      user.language
    )

    const isConfirmedButUnmappable =
      user.language_confirmed_by_idp === true && !languageConfirmed

    if (isConfirmedButUnmappable) {
      if (unmappableConfirmedBaselineRef.current === null) {
        unmappableConfirmedBaselineRef.current = i18n.language
      }
    } else {
      unmappableConfirmedBaselineRef.current = null
    }

    if (
      user.language_confirmed_by_idp &&
      convertFromBackendLanguage(user.language) === undefined
    ) {
      reportError('generic_failure', new Error('Unmappable backend language'), {
        context: '[useSyncUserPreferencesWithBackend]',
        backendLanguage: user.language,
      })
    }

    if (languageConfirmed) {
      const frontendLanguage = convertFromBackendLanguage(user.language)
      if (frontendLanguage && frontendLanguage !== i18n.language) {
        i18n.changeLanguage(frontendLanguage).catch((err) => {
          reportError('generic_failure', err, {
            context:
              '[useSyncUserPreferencesWithBackend] Failed to apply language:',
          })
        })
      }
    }

    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const preferences: ApiUserPreferences = {
      id: user.id,
      timezone: currentTimezone,
    }

    // Push a manual pick whenever the picker is shown (`!languageConfirmed`)
    // and either: the backend explicitly said this login had no usable
    // locale (`false` — mirrors pre-IdP behavior, nothing confirmed to
    // protect), or the IdP DID confirm a language but this frontend can't
    // map it, and `i18n.language` has since diverged from the baseline seen
    // when that state was first observed (a real pick, not the mount-time
    // browser guess — see `unmappableConfirmedBaselineRef` above). Excludes
    // `null`/`undefined` ("unknown"), which could otherwise overwrite an
    // IdP-confirmed language with a guessed one.
    const canPushManualPick =
      user.language_confirmed_by_idp === false ||
      (isConfirmedButUnmappable &&
        i18n.language !== unmappableConfirmedBaselineRef.current)

    if (!languageConfirmed && canPushManualPick) {
      const currentLanguage = convertToBackendLanguage(i18n.language)
      if (currentLanguage !== user.language) {
        preferences.language = currentLanguage
      }
    }

    const syncPreferencesToBackend = async () => {
      if (
        currentTimezone !== user.timezone ||
        preferences.language !== undefined
      ) {
        await mutateAsync({ user: preferences })
      }
    }

    syncPreferencesToBackend().catch((error) => {
      if (error instanceof ApiError && error.statusCode === 401) return
      reportError('generic_failure', error, {
        context: '[useSyncUserPreferencesWithBackend] Failed to sync:',
        attempted: preferences,
        ...(error instanceof ApiError
          ? { statusCode: error.statusCode, body: error.body }
          : {}),
      })
    })
    // `i18n.language` must be a dependency so a manual pick (while unconfirmed) is pushed
    // to the backend right away, not just on the next unrelated re-render.
  }, [i18n, i18n.language, user, isLoggedIn, mutateAsync])
}
