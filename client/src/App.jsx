import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicReportPage from './pages/PublicReportPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import { fetchAdminProfile } from './services/api';

export default function App() {
  const [adminUser, setAdminUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    fetchAdminProfile()
      .then(data => {
        if (data && data.user) {
          setAdminUser(data.user);
        }
      })
      .catch(() => {
        setAdminUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const handleLoginSuccess = (user) => {
    setAdminUser(user);
  };

  const handleLogout = () => {
    setAdminUser(null);
  };

  return (
    <Routes>
      {/* Public Reporting Route */}
      <Route
        path="/"
        element={<PublicReportPage adminUser={adminUser} onLogout={handleLogout} />}
      />

      {/* Admin Login Route */}
      <Route
        path="/admin/login"
        element={
          adminUser ? (
            <Navigate to="/admin" replace />
          ) : (
            <AdminLoginPage onLoginSuccess={handleLoginSuccess} />
          )
        }
      />

      {/* Protected Admin Dashboard Route */}
      <Route
        path="/admin"
        element={
          authChecking ? (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: '#64748b' }}>
              Verifying session security...
            </div>
          ) : adminUser ? (
            <AdminDashboardPage adminUser={adminUser} onLogout={handleLogout} />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
