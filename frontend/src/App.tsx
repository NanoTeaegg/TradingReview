import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const TodayHoldings = lazy(() => import('@/pages/TodayHoldings'))
const Intents = lazy(() => import('@/pages/Intents'))
const StockReview = lazy(() => import('@/pages/StockReview'))
const Rules = lazy(() => import('@/pages/Rules'))
const Settings = lazy(() => import('@/pages/Settings'))

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <div>页面加载失败</div>
          <button
            type="button"
            className="mt-4 rounded-md px-4 py-2 text-sm font-medium"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
            }}
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function RouteFallback() {
  return (
    <div className="py-12 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
      加载中...
    </div>
  )
}

function lazyRoute(element: ReactNode) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>{element}</Suspense>
    </RouteErrorBoundary>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={lazyRoute(<Dashboard />)} />
          <Route path="holdings" element={lazyRoute(<TodayHoldings />)} />
          <Route path="intents" element={lazyRoute(<Intents />)} />
          <Route path="intents/stock/:stockCode" element={lazyRoute(<StockReview />)} />
          <Route path="rules" element={lazyRoute(<Rules />)} />
          <Route path="settings" element={lazyRoute(<Settings />)} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
