import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GatePage } from './pages/GatePage';
import { WebLoginPage } from './pages/WebLoginPage';
import { MobileLoginPage } from './pages/mobile/MobileLoginPage';
import { MobileHomePage } from './pages/mobile/MobileHomePage';
import { PortalLayout } from './pages/portal/PortalLayout';
import { PortalHomePage } from './pages/portal/PortalHomePage';
import { WorkersPage } from './pages/portal/WorkersPage';
import { AccessPage } from './pages/portal/AccessPage';
import { MobileViewPage } from './pages/portal/MobileViewPage';

// Web portal:  #/portal (Worker Manage, User Access, Mobile View) — opened from MJM Intranet
// Mobile app:  #/m (sign-in) → #/m/home (module buttons) → stock/
// Hash routes work on GitHub Pages without server rewrites.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GatePage />} />
        <Route path="/login" element={<WebLoginPage />} />
        <Route path="/m" element={<MobileLoginPage />} />
        <Route path="/m/home" element={<MobileHomePage />} />
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<PortalHomePage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="access" element={<AccessPage />} />
          <Route path="mobile" element={<MobileViewPage />} />
        </Route>
        {/* old addresses */}
        <Route path="/app" element={<Navigate to="/m/home" replace />} />
        <Route path="/admin" element={<Navigate to="/portal" replace />} />
        <Route path="/admin/demo" element={<Navigate to="/portal/mobile" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
