import type { Participant } from 'livekit-client'

export const getParticipantPicture = (
  participant: Participant
): string | undefined => {
  return participant.attributes?.picture || undefined
}
