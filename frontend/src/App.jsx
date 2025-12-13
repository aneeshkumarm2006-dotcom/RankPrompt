import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import ReportView from './pages/ReportView';
import AllReports from './pages/AllReports';
import SharedReport from './pages/SharedReport';
import Profile from './pages/Profile';
import EarnCredits from './pages/EarnCredits';
import BuyCredits from './pages/BuyCredits';
import MyBrands from './pages/MyBrands';
import BrandDashboard from './pages/BrandDashboard';
import AllPrompts from './pages/AllPrompts';
import BrandReports from './pages/BrandReports';
import BrandScheduledReports from './pages/BrandScheduledReports';
import CitationsAndSources from './pages/CitationsAndSources';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#ecfdf3',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fef2f2',
                },
              },
            }}
          />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/shared/:token" element={<SharedReport />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={<Navigate to="/reports/new" replace />}
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <AllReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/new"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/view"
              element={
                <ProtectedRoute>
                  <ReportView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/:id"
              element={
                <ProtectedRoute>
                  <ReportView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/earn-credits"
              element={
                <ProtectedRoute>
                  <EarnCredits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/buy-credits"
              element={
                <ProtectedRoute>
                  <BuyCredits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands"
              element={
                <ProtectedRoute>
                  <MyBrands />
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands/:brandId/*"
              element={
                <ProtectedRoute>
                  <BrandDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
