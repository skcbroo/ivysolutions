import { Navigate, useLocation } from 'react-router-dom'
import { getToken, getUser } from '../../lib/osint'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (!getToken()) {
    return <Navigate to="/osint/login" replace state={{ from: loc.pathname }} />
  }
  const user = getUser()
  // Força troca de senha antes de acessar outras telas.
  if (user?.must_change_password && loc.pathname !== '/osint/perfil') {
    return <Navigate to="/osint/perfil" replace />
  }
  return <>{children}</>
}
