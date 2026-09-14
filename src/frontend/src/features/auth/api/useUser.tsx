import { useQuery } from '@tanstack/react-query'
import { keys } from '@/api/queryKeys'
import { fetchUser } from './fetchUser'
import { type ApiUser } from './ApiUser'
import { useEffect, useMemo } from 'react'
import { useConfig } from '@/api/useConfig'
import { hasLoggedInBefore, markLoggedIn } from '../utils/hasLoggedInBefore'

const SILENT_LOGIN_PARAM = 'silentLogin'

const isSilentLoginDisabledByUrl = () => {
  if (typeof window === 'undefined') return false
  const value = new URLSearchParams(window.location.search).get(
    SILENT_LOGIN_PARAM
  )
  return value === 'false'
}

/**
 * The homepage's join-by-code input lets anyone join a meeting without an
 * account. A browser that has never logged in there is treated as a guest,
 * and silent login is skipped so it isn't bounced through the IdP's login
 * prompt before it ever sees that input (see the "open meet-links ask for
 * login" ticket).
 */
const isGuestEntryPointGated = () => {
  if (typeof window === 'undefined') return false
  return window.location.pathname === '/' && !hasLoggedInBefore()
}

/**
 * returns info about currently logged-in user
 *
 * `isLoggedIn` is undefined while query is loading and true/false when it's done
 */
export const useUser = (
  opts: {
    fetchUserOptions?: Parameters<typeof fetchUser>[0]
  } = {}
) => {
  const { data, isLoading: isConfigLoading } = useConfig()

  const disabledByUrl = useMemo(() => isSilentLoginDisabledByUrl(), [])
  const guestEntryPointGated = useMemo(() => isGuestEntryPointGated(), [])

  const options = useMemo(() => {
    if (isConfigLoading) return

    const silentDisabled =
      data?.is_silent_login_enabled !== true ||
      disabledByUrl ||
      guestEntryPointGated

    if (silentDisabled) {
      return {
        ...opts.fetchUserOptions,
        attemptSilent: false,
      }
    }
    return opts.fetchUserOptions
  }, [data, opts, isConfigLoading, disabledByUrl, guestEntryPointGated])

  const query = useQuery({
    queryKey: [keys.user],
    queryFn: () => fetchUser(options),
    staleTime: Infinity,
    enabled: !isConfigLoading,
  })

  const isLoggedIn =
    query.status === 'success' ? query.data !== false : undefined
  const isLoggedOut = isLoggedIn === false

  useEffect(() => {
    if (isLoggedIn) markLoggedIn()
  }, [isLoggedIn])

  return {
    refetch: query.refetch,
    user: isLoggedOut ? undefined : (query.data as ApiUser | undefined),
    isLoggedIn,
    isLoading: query.isLoading,
  }
}
