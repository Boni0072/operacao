import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { BrandingProvider } from '@/context/BrandingContext';
import { MaintenanceProvider } from '@/context/MaintenanceContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Layout, type PageKey } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { WorkOrdersPage } from '@/pages/WorkOrdersPage';
import { ActivitiesPage } from '@/pages/ActivitiesPage';
import { MyActivityPage } from '@/pages/MyActivityPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { TeamsPage } from '@/pages/TeamsPage';
import { VehiclesPage } from '@/pages/VehiclesPage';
import { UsersPage } from '@/pages/UsersPage';
import { ManagementPage } from '@/pages/ManagementPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { Spinner } from '@/components/ui';

function AppContent() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [activityDetailId, setActivityDetailId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner />
      </div>
    );
  }

  if (!session) return <LoginPage />;

  const openActivity = (id: string) => {
    setActivityDetailId(id);
  };

  const closeActivity = () => {
    setActivityDetailId(null);
  };

  const pages: Record<PageKey, React.ReactNode> = {
    dashboard: <DashboardPage onOpenActivity={openActivity} />,
    management: <ManagementPage onOpenActivity={openActivity} onNavigate={setPage} />,
    projects: <ProjectsPage />,
    'work-orders': <WorkOrdersPage />,
    activities: <ActivitiesPage onOpenActivity={openActivity} />,
    schedule: <SchedulePage onOpenActivity={openActivity} />,
    clients: <ClientsPage />,
    teams: <TeamsPage />,
    vehicles: <VehiclesPage />,
    users: <UsersPage />,
    settings: <SettingsPage />,
  };

  if (activityDetailId) {
    return (
      <Layout current="activities" onNavigate={(p) => { setActivityDetailId(null); setPage(p); }}>
        <MyActivityPage activityId={activityDetailId} onBack={closeActivity} />
      </Layout>
    );
  }

  return (
    <Layout current={page} onNavigate={setPage}>
      {pages[page]}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrandingProvider>
          <MaintenanceProvider>
            <AppContent />
          </MaintenanceProvider>
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
