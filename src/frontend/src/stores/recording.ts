import { proxy } from 'valtio'

export enum RecordingLanguage {
  ENGLISH = 'en',
  FRENCH = 'fr',
  DUTCH = 'nl',
  GERMAN = 'de',
  AUTOMATIC = 'auto',
}

export const recordingLanguageForUiLanguage = (
  uiLanguage?: string
): RecordingLanguage => {
  const code = (uiLanguage ?? '').split('-')[0].toLowerCase()
  const match = Object.values(RecordingLanguage).find(
    (language) => language === code && language !== RecordingLanguage.AUTOMATIC
  )
  return match ?? RecordingLanguage.AUTOMATIC
}

type State = {
  language: RecordingLanguage | null
  isErrorDialogOpen: string
}

export const recordingStore = proxy<State>({
  language: null,
  isErrorDialogOpen: '',
})
