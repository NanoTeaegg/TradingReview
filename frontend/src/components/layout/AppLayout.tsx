import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto"
        style={{
          marginLeft: 'var(--sidebar-width)',
          background: 'var(--color-bg-app)',
          minHeight: '100vh',
        }}
      >
        <div
          className="mx-auto"
          style={{
            maxWidth: 'var(--content-max-width)',
            padding: 'var(--content-padding-y) var(--content-padding-x)',
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
