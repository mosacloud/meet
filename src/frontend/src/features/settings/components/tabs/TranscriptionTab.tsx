import { TabPanel, type TabPanelProps } from '@/primitives/Tabs'
import { Field, H } from '@/primitives'
import { useTranslation } from 'react-i18next'
import { RecordingLanguage, recordingStore } from '@/stores/recording'
import { useTranscriptionLanguage } from '@/features/settings'

export type TranscriptionTabProps = Pick<TabPanelProps, 'id'>

export const TranscriptionTab = ({ id }: TranscriptionTabProps) => {
  const { t } = useTranslation('settings', { keyPrefix: 'transcription' })

  const { languageOptions, selectedLanguageKey } = useTranscriptionLanguage()

  return (
    <TabPanel padding={'md'} flex id={id}>
      <H lvl={2}>{t('heading')}</H>
      <Field
        type="select"
        label={t('language.label')}
        items={languageOptions}
        selectedKey={selectedLanguageKey}
        onSelectionChange={(lang) => {
          recordingStore.language = lang as RecordingLanguage
        }}
      />
    </TabPanel>
  )
}
