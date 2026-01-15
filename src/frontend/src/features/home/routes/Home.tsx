import { UserAware } from '@/features/auth'
import { Screen } from '@/layout/Screen'
import { MosaHomePage } from '../components/MosaHomePage'

export const Home = () => {
  return (
    <UserAware>
      <Screen header={false} footer={false}>
        <MosaHomePage />
      </Screen>
    </UserAware>
  )
}
