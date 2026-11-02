const HAS_LOGGED_IN_BEFORE_KEY = 'has-logged-in-before'

/**
 * Whether this browser has ever had an authenticated session with Meet.
 * Used to gate silent OIDC login attempts on the homepage: a browser that
 * has never logged in is treated as a guest (mosa's homepage lets anyone
 * join a meeting by code, no account required) and skipped straight past
 * the join-by-code UI, instead of round-tripping through the IdP first
 * (see the "open meet-links ask for login" ticket - some IdP configs
 * don't fail `prompt=none` silently, so guests would otherwise land on a
 * login page before ever seeing the homepage).
 */
export const hasLoggedInBefore = () => {
  try {
    return localStorage.getItem(HAS_LOGGED_IN_BEFORE_KEY) === 'true'
  } catch {
    return false
  }
}

export const markLoggedIn = () => {
  try {
    localStorage.setItem(HAS_LOGGED_IN_BEFORE_KEY, 'true')
  } catch {
    // ignore - e.g. private browsing with storage disabled
  }
}
