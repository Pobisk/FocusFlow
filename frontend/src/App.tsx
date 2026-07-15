import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from '@/pages/LoginPage'
import { TodayPage } from '@/pages/TodayPage'
import { WorkPage } from '@/pages/WorkPage'
import { WorkDebugPage } from '@/pages/WorkDebugPage'
import { WorkspacePage } from '@/pages/WorkspacePage'
import { SpheresPage } from '@/pages/SpheresPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { ProjectEditPage } from '@/pages/ProjectEditPage'
import { TasksPage } from '@/pages/TasksPage'
import { TaskEditPage } from '@/pages/TaskEditPage'
import { SomedayPage } from '@/pages/SomedayPage'
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
            <Route path="/today" element={<TodayPage />} />
            <Route path="/work" element={<WorkPage />} />
            <Route path="/work-debug" element={<WorkDebugPage />} />
            <Route path="/spheres" element={<SpheresPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectEditPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:id" element={<TaskEditPage />} />
            <Route path="/someday" element={<SomedayPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

