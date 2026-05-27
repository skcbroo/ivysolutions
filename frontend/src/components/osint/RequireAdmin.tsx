import { Navigate, useLocation } from 'react-router-dom'
import { getToken, getUser } from '../../lib/osint'

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (!getToken()) return <Navigate to="/osint/login" replace state={{ from: loc.pathname }} />
  const user = getUser()
  if (user?.role !== 'admin') return <Navigate to="/osint" replace />
  return <>{children}</>
}
