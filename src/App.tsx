import { useCallback, useEffect, useState } from 'react';
import { fetchSystemStatus } from './api';
import { HeaderBar } from './components/HeaderBar';
import { Sidebar } from './components/Sidebar';
import { AboutPage } from './pages/AboutPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DatasetPage } from './pages/DatasetPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomeDashboard } from './pages/HomeDashboard';
import { PredictionPage } from './pages/PredictionPage';
import type { PageId, SystemStatus } from './types';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await fetchSystemStatus();
      setStatus(next);
    } catch {
      // Keep previous status if transient network failure occurs
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleNavigate = (page: PageId) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        modelTrained={Boolean(status?.modelTrained)}
        predictionCount={status?.predictionCount ?? 0}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          activePage={activePage}
          status={status}
          onOpenMobileNav={() => setMobileOpen(true)}
          onNavigate={handleNavigate}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {activePage === 'home' && (
            <HomeDashboard
              status={status}
              onNavigate={handleNavigate}
              onPredictionCreated={refreshStatus}
            />
          )}
          {activePage === 'predict' && (
            <PredictionPage
              status={status}
              onNavigate={handleNavigate}
              onPredictionCreated={refreshStatus}
            />
          )}
          {activePage === 'dataset' && (
            <DatasetPage
              onDatasetTrained={refreshStatus}
              onNavigate={handleNavigate}
            />
          )}
          {activePage === 'analytics' && (
            <AnalyticsPage onNavigate={handleNavigate} />
          )}
          {activePage === 'history' && (
            <HistoryPage
              onNavigate={handleNavigate}
              onHistoryUpdated={refreshStatus}
            />
          )}
          {activePage === 'about' && <AboutPage />}
        </main>
      </div>
    </div>
  );
}
