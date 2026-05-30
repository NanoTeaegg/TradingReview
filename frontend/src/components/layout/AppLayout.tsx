import { Outlet } from 'react-router-dom'
import Topbar from './Topbar'

export default function AppLayout() {
  return (
    <>
      <Topbar />
      <main
        style={{
          paddingTop: 'var(--topbar-height)',
          minHeight: '100vh',
          background: 'var(--color-bg-app)',
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
    </>
  )
}
