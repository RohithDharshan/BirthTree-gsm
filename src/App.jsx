import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import CalendarView from './components/Calendar';
import FamilyTreeView from './components/FamilyTree';
import AuthScreen from './components/AuthScreen';
import FamilySetup from './components/FamilySetup';

function AppRoutes() {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <span className="text-gradient" style={{ fontSize: '1.5rem' }}>Loading…</span>
      </div>
    );
  }

  if (!currentUser) return <AuthScreen />;
  if (!userProfile?.familyId) return <FamilySetup />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<CalendarView />} />
        <Route path="tree" element={<FamilyTreeView />} />
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
