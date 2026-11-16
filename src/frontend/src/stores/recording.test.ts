import { describe, expect, it } from 'vitest'
import { RecordingLanguage, recordingLanguageForUiLanguage } from './recording'

describe('recordingLanguageForUiLanguage', () => {
  it('uses the interface language when transcription supports it', () => {
    expect(recordingLanguageForUiLanguage('nl')).toBe(RecordingLanguage.DUTCH)
    expect(recordingLanguageForUiLanguage('en-US')).toBe(
      RecordingLanguage.ENGLISH
    )
    expect(recordingLanguageForUiLanguage('DE')).toBe(RecordingLanguage.GERMAN)
    expect(recordingLanguageForUiLanguage('fr')).toBe(RecordingLanguage.FRENCH)
  })

  it('falls back to automatic detection for other languages', () => {
    expect(recordingLanguageForUiLanguage('es')).toBe(
      RecordingLanguage.AUTOMATIC
    )
    expect(recordingLanguageForUiLanguage('auto')).toBe(
      RecordingLanguage.AUTOMATIC
    )
    expect(recordingLanguageForUiLanguage('')).toBe(RecordingLanguage.AUTOMATIC)
    expect(recordingLanguageForUiLanguage(undefined)).toBe(
      RecordingLanguage.AUTOMATIC
    )
  })
})
