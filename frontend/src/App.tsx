import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { TopNav } from './components/TopNav'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { Login as OsintLogin } from './pages/osint/Login'
import { Lista as OsintLista } from './pages/osint/Lista'
import { Nova as OsintNova } from './pages/osint/Nova'
import { Relatorio as OsintRelatorio } from './pages/osint/Relatorio'
import { Perfil as OsintPerfil } from './pages/osint/Perfil'
import { AdminUsuarios as OsintAdminUsuarios } from './pages/osint/AdminUsuarios'
import { RequireAuth } from './components/osint/RequireAuth'
import { RequireAdmin } from './components/osint/RequireAdmin'

function PublicNav() {
  const { pathname } = useLocation()
  // O sistema OSINT é interno e usa header próprio.
  if (pathname.startsWith('/osint')) return null
  return <TopNav />
}

export default function App() {
  return (
    <BrowserRouter>
      <PublicNav />
      <main className="min-h-dvh">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/osint/login" element={<OsintLogin />} />
          <Route
            path="/osint"
            element={
              <RequireAuth>
                <OsintLista />
              </RequireAuth>
            }
          />
          <Route
            path="/osint/nova"
            element={
              <RequireAuth>
                <OsintNova />
              </RequireAuth>
            }
          />
          <Route
            path="/osint/perfil"
            element={
              <RequireAuth>
                <OsintPerfil />
              </RequireAuth>
            }
          />
          <Route
            path="/osint/admin/usuarios"
            element={
              <RequireAdmin>
                <OsintAdminUsuarios />
              </RequireAdmin>
            }
          />
          <Route
            path="/osint/:id"
            element={
              <RequireAuth>
                <OsintRelatorio />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
