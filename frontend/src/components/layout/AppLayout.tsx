import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrentAccountId } from '@/lib/account'
import { prefetchNavigationViews } from '@/lib/queries'
import Topbar from './Topbar'

export default function AppLayout() {
  const queryClient = useQueryClient()
  const currentAccountId = useCurrentAccountId()

  useEffect(() => {
    if (currentAccountId == null) return
    const timer = window.setTimeout(() => {
      prefetchNavigationViews(queryClient, currentAccountId)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [queryClient, currentAccountId])

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
