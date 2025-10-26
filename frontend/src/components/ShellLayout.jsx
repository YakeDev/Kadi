import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

const ShellLayout = ({ children }) => {
  return (
    <div className='flex min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-dark)]'>
      <Sidebar />
      <div className='flex min-h-screen flex-1 flex-col overflow-x-hidden lg:ml-64'>
        <Topbar />
        <main className='flex-1 px-4 pb-6 pt-24 md:px-8'>
          <div className='mx-auto w-full max-w-[1200px] lg:px-4 xl:px-8'>{children}</div>
        </main>
      </div>
    </div>
  )
}

export default ShellLayout
