import { UserAware } from '@/features/auth/components/UserAware'
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

export default Home
