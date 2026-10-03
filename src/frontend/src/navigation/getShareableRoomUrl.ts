import { getRouteUrl } from './getRouteUrl'

/**
 * URL for a room meant to be shared with others (invite dialogs, clipboard
 * copy, SDK callbacks). Disables silent OIDC login on load: guests without an
 * account should never be bounced through the IdP just to reach the join
 * screen.
 */
export const getShareableRoomUrl = (slug: string) => {
  const url = new URL(getRouteUrl('room', slug))
  url.searchParams.set('silentLogin', 'false')
  return url.toString()
}
