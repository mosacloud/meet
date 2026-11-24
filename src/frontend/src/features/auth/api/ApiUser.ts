import { BackendLanguage } from '@/utils/languages'
import type {
  ApiAccessLevel,
  RoomConfiguration,
} from '@/features/rooms/api/ApiRoom'

export type ApiUser = {
  id: string
  email: string
  full_name: string
  last_name: string
  picture?: string | null
  language: BackendLanguage
  // Whether this session's OIDC login presented a usable "locale" claim (see
  // backend `OIDCAuthenticationBackend.compute_language`) — tells an IdP-
  // confirmed "en-us" apart from `language` just being the unset default.
  // Tri-state: `null` means "unknown" and must NOT be treated like an
  // explicit `false` — a manual pick is only pushed once this state is
  // known (`false`, or `true` paired with a language this frontend can't
  // map), see `useSyncUserPreferencesWithBackend`.
  language_confirmed_by_idp: boolean | null
  timezone: string
  default_room_access_level?: ApiAccessLevel | null
  default_room_configuration?: RoomConfiguration | null
}
