import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from '@/pages/LoginPage'
import { WorkspacePage } from '@/pages/WorkspacePage'
import { SpheresPage } from '@/pages/SpheresPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

const queryClient = new QueryClient()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/spheres" element={<SpheresPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
