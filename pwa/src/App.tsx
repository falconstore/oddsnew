import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MobileOnly } from '@/components/MobileOnly'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { AuthCallback } from '@/pages/AuthCallback'
import { Dashboard } from '@/pages/Dashboard'
import { Procedures } from '@/pages/Procedures'
import { ProcedureDetail } from '@/pages/ProcedureDetail'
import { LiveProcedures } from '@/pages/LiveProcedures'
import { Profile } from '@/pages/Profile'
import { Paywall } from '@/pages/Paywall'

export default function App() {
  return (
    <MobileOnly>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/paywall" element={<Paywall />} />

          <Route path="/" element={
            <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
          } />
          <Route path="/ao-vivo" element={
            <ProtectedRoute><Layout><LiveProcedures /></Layout></ProtectedRoute>
          } />
          <Route path="/procedimentos" element={
            <ProtectedRoute><Layout><Procedures /></Layout></ProtectedRoute>
          } />
          <Route path="/procedimentos/:id" element={
            <ProtectedRoute><Layout><ProcedureDetail /></Layout></ProtectedRoute>
          } />
          {/* Back-compat redirects */}
          <Route path="/sinais" element={<Navigate to="/procedimentos" replace />} />
          <Route path="/sinais/:id" element={<Navigate to="/procedimentos" replace />} />
          <Route path="/perfil" element={
            <ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MobileOnly>
  )
}
