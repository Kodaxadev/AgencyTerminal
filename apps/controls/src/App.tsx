import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getAuthStatus, logout } from "./api";
import type { AuthStatus } from "./contracts";
import { AppLayout, DataState } from "./layout";
import {
  AuditPage,
  DeploymentPage,
  DisabledPage,
  EvidencePage,
  HealthPage,
  LoginPage,
  NotFoundPage,
  OverviewPage,
  TicketsPage,
} from "./pages";
import { ConfigPage, MetricsPage, RolesPage } from "./settings-pages";

export function ControlsApp() {
  const [auth, setAuth] = useState<AuthStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function refreshAuth() {
    setLoading(true);
    setError(undefined);
    try {
      setAuth(await getAuthStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication check failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAuth();
  }, []);

  async function handleLogout() {
    await logout();
    await refreshAuth();
  }

  if (loading) return <main className="login"><DataState loading error={error} /></main>;
  if (error) return <main className="login"><DataState loading={false} error={error} /></main>;
  if (!auth?.controlsEnabled) return <DisabledPage />;
  if (!auth.authenticated) return <LoginPage controlsEnabled={auth.controlsEnabled} />;

  return (
    <AppLayout auth={auth} onLogout={() => void handleLogout()}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/overview" element={<Navigate to="/" replace />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/deployment" element={<DeploymentPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppLayout>
  );
}
