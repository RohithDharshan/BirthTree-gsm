import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import CalendarView from './components/Calendar';
import FamilyTreeView from './components/FamilyTree';
import AuthScreen from './components/AuthScreen';
import FamilySetup from './components/FamilySetup';
import AdminPanel from './components/AdminPanel';

function AppRoutes() {
  const { currentUser, userProfile, isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <span className="text-gradient" style={{ fontSize: '1.5rem' }}>Loading…</span>
      </div>
    );
  }

  if (!currentUser) return <AuthScreen />;
  if (!userProfile?.familyId && !isSuperAdmin) return <FamilySetup />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={
          isSuperAdmin && !userProfile?.familyId ? <Navigate to="/admin" replace /> : <CalendarView />
        } />
        <Route path="tree" element={<FamilyTreeView />} />
        <Route path="admin" element={<AdminPanel />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
