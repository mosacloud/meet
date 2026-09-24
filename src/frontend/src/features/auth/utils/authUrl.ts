import i18n from 'i18next'

import { apiUrl } from '@/api/apiUrl'

import { convertToBackendLanguage } from '@/utils/languages'

export const authUrl = ({
  silent = false,
  returnTo = window.location.href,
} = {}) => {
  const params = new URLSearchParams({
    silent: String(silent),
    returnTo,
    // Hints the IdP's own login-page language (e.g. Zitadel's hosted
    // login) via the standard OIDC "ui_locales" param — forwarded as-is
    // to the IdP by OIDC_AUTH_REQUEST_FORWARDED_PARAMS. This is separate
    // from the `locale` claim read back after login (see
    // `compute_language` in the backend): that one sets the user's Meet
    // preference, this one only affects what the IdP itself renders.
    ui_locales: convertToBackendLanguage(i18n.language),
  })
  return apiUrl(`/authenticate/?${params.toString()}`)
}
