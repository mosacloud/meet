// Mosa-specific: IdP-driven language confirmation. Kept out of `languages.ts`
// (an upstream file) so that file stays untouched and rebase-conflict-free —
// everything here is net-new, added for the Zitadel `locale`-claim flow.

import { type BackendLanguage, type FrontendLanguage } from './languages'

const backendToFrontendMap: Record<BackendLanguage, FrontendLanguage> = {
  'en-us': 'en',
  'fr-fr': 'fr',
  'nl-nl': 'nl',
  'de-de': 'de',
  'es-es': 'es',
}

export const convertFromBackendLanguage = (
  backendLang: string
): FrontendLanguage | undefined => {
  return backendToFrontendMap[backendLang as BackendLanguage]
}

// Backed by the session-derived `language_confirmed_by_idp` API field, not a
// heuristic on `language` itself — `language` alone can't tell an IdP-
// confirmed "en-us" apart from a User row that never had a locale claim.
//
// Still guards against a `language` this frontend's `backendToFrontendMap`
// doesn't know (e.g. a new language added after a rebase): otherwise the
// picker would hide while `convertFromBackendLanguage` silently fails to
// apply it, leaving the user stuck with no way to change it.
export const isLanguageConfirmedByIdentityProvider = (
  languageConfirmedByIdp: boolean | null | undefined,
  language?: string | null
): boolean =>
  Boolean(languageConfirmedByIdp) &&
  Boolean(language) &&
  convertFromBackendLanguage(language as string) !== undefined

// Shared by every language-picker call site (header, settings dialogs): a
// picker is shown when logged out (no IdP-driven language exists yet) or when
// logged in but the IdP hasn't confirmed a language yet — kept in one place so
// this rule can't drift between the different pages that render a picker.
export const shouldShowLanguagePicker = (
  isLoggedIn: boolean | undefined,
  languageConfirmedByIdp: boolean | null | undefined,
  language?: string | null
): boolean =>
  !isLoggedIn ||
  !isLanguageConfirmedByIdentityProvider(languageConfirmedByIdp, language)
