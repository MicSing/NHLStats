import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import UsersPage from './pages/admin/UsersPage'
import SeasonsPage from './pages/admin/SeasonsPage'
import RosterPage from './pages/admin/RosterPage'
import PointReasonsPage from './pages/admin/PointReasonsPage'
import MoneyConfigPage from './pages/admin/MoneyConfigPage'
import ExpensesPage from './pages/admin/ExpensesPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="seasons" element={<SeasonsPage />} />
            <Route path="roster" element={<RosterPage />} />
            <Route path="point-reasons" element={<PointReasonsPage />} />
            <Route path="money-config" element={<MoneyConfigPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
