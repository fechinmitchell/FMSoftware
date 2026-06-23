import React from 'react';
import FMSoftware from './components/FMSoftware';
import AdminApp from './admin/AdminApp';

export default function App() {
  // hidden admin area, lives at /tools (and anything under it)
  const isAdmin = window.location.pathname.startsWith('/tools');
  return isAdmin ? <AdminApp /> : <FMSoftware />;
}