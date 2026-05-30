import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import TodayHoldings from '@/pages/TodayHoldings'
import Intents from '@/pages/Intents'
import Reviews from '@/pages/Reviews'
import ReviewDetail from '@/pages/ReviewDetail'
import Rules from '@/pages/Rules'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="holdings" element={<TodayHoldings />} />
          <Route path="intents" element={<Intents />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="reviews/trade/:tradeId" element={<ReviewDetail />} />
          <Route path="reviews/stock/:stockCode" element={<ReviewDetail />} />
          <Route path="reviews/period" element={<ReviewDetail />} />
          <Route path="rules" element={<Rules />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
