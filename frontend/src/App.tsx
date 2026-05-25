import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TopNav } from './components/TopNav'
import { Home } from './pages/Home'
import { About } from './pages/About'

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <main className="min-h-dvh">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sobre" element={<About />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
