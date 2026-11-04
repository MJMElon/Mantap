import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { WorkerHomePage } from './pages/WorkerHomePage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { WorkersPage } from './pages/admin/WorkersPage';
import { MobileDemoPage } from './pages/admin/MobileDemoPage';

// Hash routes (#/app, #/admin) work on GitHub Pages without server rewrites.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/app" element={<WorkerHomePage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<WorkersPage />} />
          <Route path="demo" element={<MobileDemoPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
