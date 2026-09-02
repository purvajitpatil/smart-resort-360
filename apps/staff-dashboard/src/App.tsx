import { Navigate, Route, Routes } from 'react-router-dom'
import { getAccessToken } from './lib/api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Requests from './pages/Requests'
import Rooms from './pages/Rooms'
import Escalations from './pages/Escalations'
import MemoryPage from './pages/Memory'
import Sentiment from './pages/Sentiment'
import Inventory from './pages/Inventory'
import Revenue from './pages/Revenue'
import Pricing from './pages/Pricing'
import Segments from './pages/Segments'
import Schedule from './pages/Schedule'
import Sidebar from './components/Sidebar'

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) return <Navigate to="/login" replace />
  return (
    <div className="app-layout" style={{ background: 'var(--color-bg)' }}>
      <Sidebar />
      <main style={{ overflowY: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={
        getAccessToken() ? <Navigate to="/app" replace /> : <Login />
      } />
      <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/app/requests" element={<RequireAuth><Requests /></RequireAuth>} />
      <Route path="/app/rooms" element={<RequireAuth><Rooms /></RequireAuth>} />
      <Route path="/app/escalations" element={<RequireAuth><Escalations /></RequireAuth>} />
      <Route path="/app/memory" element={<RequireAuth><MemoryPage /></RequireAuth>} />
      <Route path="/app/sentiment" element={<RequireAuth><Sentiment /></RequireAuth>} />
      <Route path="/app/inventory" element={<RequireAuth><Inventory /></RequireAuth>} />
      <Route path="/app/revenue" element={<RequireAuth><Revenue /></RequireAuth>} />
      <Route path="/app/pricing" element={<RequireAuth><Pricing /></RequireAuth>} />
      <Route path="/app/segments" element={<RequireAuth><Segments /></RequireAuth>} />
      <Route path="/app/schedule" element={<RequireAuth><Schedule /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
