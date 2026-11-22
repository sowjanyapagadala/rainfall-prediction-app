import { Menu } from 'lucide-react';
import type { PageId, SystemStatus } from '../types';

interface HeaderBarProps {
  activePage: PageId;
  status: SystemStatus | null;
  onOpenMobileNav: () => void;
  onNavigate: (page: PageId) => void;
}

const PAGE_TITLES: Record<PageId, string> = {
  home: 'Home Dashboard',
  predict: 'Rainfall Prediction',
  dataset: 'Dataset Upload',
  analytics: 'Data Analytics',
  history: 'Prediction History',
  about: 'About Project',
};

export function HeaderBar({
  activePage,
  status,
  onOpenMobileNav,
  onNavigate,
}: HeaderBarProps) {
  const modelText = status?.modelTrained && status.modelMetrics
    ? `Random Forest · ${(status.modelMetrics.accuracy * 100).toFixed(1)}% test accuracy`
    : 'Model not trained';

  const datasetText = status?.datasetLoaded && status.dataset
    ? `${status.dataset.validRowCount} records`
    : 'No dataset';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="truncate">Rainfall Prediction System</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-slate-700 truncate">
                {PAGE_TITLES[activePage]}
              </span>
            </div>
            <div className="mt-0.5 hidden sm:flex items-center gap-2 text-xs text-slate-500 tabular-nums">
              <span>{modelText}</span>
              <span aria-hidden="true">·</span>
              <span>{datasetText}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {activePage === 'predict' ? (
            <button
              type="button"
              onClick={() => onNavigate('dataset')}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Manage Dataset
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('predict')}
              className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Predict Rainfall
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
