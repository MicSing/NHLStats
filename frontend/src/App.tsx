import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PublicLayout from './components/PublicLayout'
import LoginPage from './pages/LoginPage'
import UsersPage from './pages/admin/UsersPage'
import SeasonsPage from './pages/admin/SeasonsPage'
import RosterPage from './pages/admin/RosterPage'
import PointReasonsPage from './pages/admin/PointReasonsPage'
import MoneyConfigPage from './pages/admin/MoneyConfigPage'
import ExpensesPage from './pages/admin/ExpensesPage'
import SeasonPage from './pages/SeasonPage'
import MatchPage from './pages/MatchPage'
import DashboardPage from './pages/DashboardPage'
import EarningsExpensesPage from './pages/EarningsExpensesPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* All routes share the top navigation bar */}
          <Route element={<PublicLayout />}>
            {/* Public routes — visible to everyone */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/earnings" element={<EarningsExpensesPage />} />
            <Route path="/seasons" element={<SeasonPage />} />
            <Route path="/seasons/:seasonId" element={<SeasonPage />} />
            <Route path="/seasons/:seasonId/matches/:matchId" element={<MatchPage />} />

            {/* Admin routes — auth-gated, still inside the top nav */}
            <Route
              path="/admin"
              element={<ProtectedRoute><Navigate to="/admin/users" replace /></ProtectedRoute>}
            />
            <Route path="/admin/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="/admin/seasons" element={<ProtectedRoute><SeasonsPage /></ProtectedRoute>} />
            <Route path="/admin/roster" element={<ProtectedRoute><RosterPage /></ProtectedRoute>} />
            <Route path="/admin/point-reasons" element={<ProtectedRoute><PointReasonsPage /></ProtectedRoute>} />
            <Route path="/admin/money-config" element={<ProtectedRoute><MoneyConfigPage /></ProtectedRoute>} />
            <Route path="/admin/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/seasons" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
