import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import { getAccessToken } from './lib/api'
import Home from './pages/Home'
import Login from './pages/Login'
import Assistant from './pages/Assistant'
import Requests from './pages/Requests'
import MemoryPage from './pages/Memory'

function LoginGate() {
  if (getAccessToken()) return <Navigate to="/app" replace />
  return <Login />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginGate />} />
      <Route
        path="/app/*"
        element={
          <RequireAuth>
            <Routes>
              <Route index element={<Home />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="requests" element={<Requests />} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
