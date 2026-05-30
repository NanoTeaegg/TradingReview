import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import TodayHoldings from '@/pages/TodayHoldings'
import Intents from '@/pages/Intents'
import StockReview from '@/pages/StockReview'
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
          <Route path="intents/stock/:stockCode" element={<StockReview />} />
          <Route path="rules" element={<Rules />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
