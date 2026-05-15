import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute, { AdminProtectedRoute } from './components/ProtectedRoute'
import PublicLayout from './components/PublicLayout'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import UsersPage from './pages/admin/UsersPage'
import SeasonsPage from './pages/admin/SeasonsPage'
import RosterPage from './pages/admin/RosterPage'
import PointReasonsPage from './pages/admin/PointReasonsPage'
import MoneyConfigPage from './pages/admin/MoneyConfigPage'
import ExpensesPage from './pages/admin/ExpensesPage'
import AdminMatchesPage from './pages/admin/AdminMatchesPage'
import PayoutsPage from './pages/admin/PayoutsPage'
import AdminAggregatedPointsPage from './pages/admin/AdminAggregatedPointsPage'
import TeamsPage from './pages/admin/TeamsPage'
import PointsManagementPage from './pages/admin/PointsManagementPage'
import SeasonPage from './pages/SeasonPage'
import MatchPage from './pages/MatchPage'
import DashboardPage from './pages/DashboardPage'
import EarningsExpensesPage from './pages/EarningsExpensesPage'
import UserStatsPage from './pages/UserStatsPage'
import RulesPage from './pages/RulesPage'
import BettingPage from './pages/BettingPage'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <Routes>
                {/* Public routes — top navigation bar */}
                <Route element={<PublicLayout />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/change-password" element={<ChangePasswordPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/earnings" element={<EarningsExpensesPage />} />
                  <Route path="/betting" element={<ProtectedRoute><BettingPage /></ProtectedRoute>} />
                  <Route path="/seasons" element={<SeasonPage />} />
                  <Route path="/seasons/:seasonId" element={<SeasonPage />} />
                  <Route path="/seasons/:seasonId/matches/:matchId" element={<AdminProtectedRoute redirectTo="/seasons"><MatchPage /></AdminProtectedRoute>} />
                  <Route path="/user-stats" element={<UserStatsPage />} />
                  <Route path="/rules" element={<RulesPage />} />
                </Route>

                {/* Admin routes — sidebar layout, auth-gated at the parent */}
                <Route
                  path="/admin"
                  element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}
                >
                  <Route index element={<Navigate to="users" replace />} />
                  <Route path="logins" element={<Navigate to="/admin/users" replace />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="seasons" element={<SeasonsPage />} />
                  <Route path="roster" element={<RosterPage />} />
                  <Route path="point-reasons" element={<PointReasonsPage />} />
                  <Route path="money-config" element={<MoneyConfigPage />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="matches" element={<AdminMatchesPage />} />
                  <Route path="payouts" element={<PayoutsPage />} />
                  <Route path="aggregated-points" element={<AdminAggregatedPointsPage />} />
                  <Route path="teams" element={<TeamsPage />} />
                  <Route path="points" element={<PointsManagementPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/seasons" replace />} />
              </Routes>
            </BrowserRouter>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
