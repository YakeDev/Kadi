import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import MobileTabBar from './MobileTabBar.jsx'
import { useLocation } from 'react-router-dom'
import { nativeRootPaths } from '../native/platform.js'

const ShellLayout = ({ children }) => {
  const { pathname } = useLocation()
  return (
    <div className='app-shell flex min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-dark)]' data-native-root={nativeRootPaths.includes(pathname) ? 'true' : 'false'}>
      <Sidebar />
      <div className='flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip lg:ml-64'>
        <Topbar />
        <main className='app-main flex-1 px-4 pb-6 pt-24 md:px-8'>
          <div className='mx-auto w-full max-w-[1200px] lg:px-4 xl:px-8'>{children}</div>
        </main>
      </div>
      <MobileTabBar />
    </div>
  )
}

export default ShellLayout
