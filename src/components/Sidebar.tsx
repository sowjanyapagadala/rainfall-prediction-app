import {
  BarChart3,
  BookOpen,
  CloudRain,
  Database,
  History,
  LayoutDashboard,
  X,
} from 'lucide-react';
import type { PageId } from '../types';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  modelTrained: boolean;
  predictionCount: number;
}

const NAV_ITEMS: Array<{
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'home', label: 'Home Dashboard', icon: LayoutDashboard },
  { id: 'predict', label: 'Rainfall Prediction', icon: CloudRain },
  { id: 'dataset', label: 'Dataset Upload', icon: Database },
  { id: 'analytics', label: 'Data Analytics', icon: BarChart3 },
  { id: 'history', label: 'Prediction History', icon: History },
  { id: 'about', label: 'About Project', icon: BookOpen },
];

export function Sidebar({
  activePage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  modelTrained,
  predictionCount,
}: SidebarProps) {
  const handleSelect = (page: PageId) => {
    onNavigate(page);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-5">
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <CloudRain className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold tracking-tight text-white truncate">
              Rainfall ML
            </div>
            <div className="text-xs text-slate-400 truncate">
              Forecasting Console
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 whitespace-nowrap">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </span>
              {item.id === 'history' && predictionCount > 0 && (
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isActive ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {predictionCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/80 px-5 py-4 text-xs text-slate-400 space-y-1.5">
        <div className="font-medium text-slate-300">Model Readiness</div>
        <div>
          {modelTrained
            ? 'Random Forest trained on active CSV'
            : 'No dataset loaded yet'}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:border-r lg:border-slate-200">
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full">{navContent}</div>
        </div>
      )}
    </>
  );
}
