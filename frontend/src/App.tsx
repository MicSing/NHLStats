import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PublicLayout from './components/PublicLayout'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import UsersPage from './pages/admin/UsersPage'
import SeasonsPage from './pages/admin/SeasonsPage'
import RosterPage from './pages/admin/RosterPage'
import PointReasonsPage from './pages/admin/PointReasonsPage'
import MoneyConfigPage from './pages/admin/MoneyConfigPage'
import ExpensesPage from './pages/admin/ExpensesPage'
import AdminMatchesPage from './pages/admin/AdminMatchesPage'
import PayoutsPage from './pages/admin/PayoutsPage'
import SeasonPage from './pages/SeasonPage'
import MatchPage from './pages/MatchPage'
import DashboardPage from './pages/DashboardPage'
import EarningsExpensesPage from './pages/EarningsExpensesPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes — top navigation bar */}
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/earnings" element={<EarningsExpensesPage />} />
            <Route path="/seasons" element={<SeasonPage />} />
            <Route path="/seasons/:seasonId" element={<SeasonPage />} />
            <Route path="/seasons/:seasonId/matches/:matchId" element={<MatchPage />} />
          </Route>

          {/* Admin routes — sidebar layout, auth-gated at the parent */}
          <Route
            path="/admin"
            element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="seasons" element={<SeasonsPage />} />
            <Route path="roster" element={<RosterPage />} />
            <Route path="point-reasons" element={<PointReasonsPage />} />
            <Route path="money-config" element={<MoneyConfigPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="matches" element={<AdminMatchesPage />} />
            <Route path="payouts" element={<PayoutsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/seasons" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
