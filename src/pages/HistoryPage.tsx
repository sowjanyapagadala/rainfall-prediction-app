import { useEffect, useState } from 'react';
import { Download, History, Search, Trash2 } from 'lucide-react';
import {
  clearAllPredictionHistory,
  deletePredictionRecord,
  fetchPredictionHistory,
} from '../api';
import type { PageId, PredictionHistoryItem } from '../types';

interface HistoryPageProps {
  onNavigate: (page: PageId) => void;
  onHistoryUpdated: () => void;
}

export function HistoryPage({ onNavigate, onHistoryUpdated }: HistoryPageProps) {
  const [items, setItems] = useState<PredictionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Rain' | 'No Rain'>('all');
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPredictionHistory();
      setItems(res.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to fetch prediction history.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearAllPredictionHistory();
      setItems([]);
      setConfirmClear(false);
      onHistoryUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history.');
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteRow = async (id: number) => {
    try {
      await deletePredictionRecord(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      onHistoryUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record.');
    }
  };

  const handleExportCsv = () => {
    if (items.length === 0) return;
    const headers = [
      'id',
      'created_at',
      'temperature',
      'humidity',
      'pressure',
      'wind_speed',
      'cloud_cover',
      'previous_rainfall',
      'predicted_label',
      'rain_probability',
    ];
    const lines = [
      headers.join(','),
      ...items.map((r) =>
        [
          r.id,
          r.created_at,
          r.temperature,
          r.humidity,
          r.pressure,
          r.wind_speed,
          r.cloud_cover,
          r.previous_rainfall,
          `"${r.predicted_label}"`,
          r.rain_probability,
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rainfall_prediction_history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredItems = items.filter((item) => {
    if (filter !== 'all' && item.predicted_label !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        item.predicted_label.toLowerCase().includes(q) ||
        item.summary_text.toLowerCase().includes(q) ||
        new Date(item.created_at).toLocaleString().toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Prediction History
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Timestamped log of rainfall forecasts and atmospheric parameters
            persisted in SQLite.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          )}

          {items.length > 0 && !confirmClear && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear History</span>
            </button>
          )}

          {confirmClear && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
              <span className="text-xs font-medium text-red-900">
                Delete all records?
              </span>
              <button
                type="button"
                disabled={clearing}
                onClick={handleClearAll}
                className="rounded bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800"
              >
                {clearing ? 'Clearing...' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading prediction history...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <History className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
            No Predictions Recorded Yet
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Run a weather forecast on the Rainfall Prediction page to store
            input parameters, predicted class, and rainfall probabilities here.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('predict')}
            className="mt-5 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Make First Prediction
          </button>
        </div>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start">
              {(
                [
                  { id: 'all', label: `All (${items.length})` },
                  {
                    id: 'Rain',
                    label: `Rain (${items.filter((i) => i.predicted_label === 'Rain').length})`,
                  },
                  {
                    id: 'No Rain',
                    label: `No Rain (${items.filter((i) => i.predicted_label === 'No Rain').length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search history..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Date & Time</th>
                  <th className="py-2.5 px-3 text-right">Temp (°C)</th>
                  <th className="py-2.5 px-3 text-right">Humidity (%)</th>
                  <th className="py-2.5 px-3 text-right">Pressure (hPa)</th>
                  <th className="py-2.5 px-3 text-right">Wind (km/h)</th>
                  <th className="py-2.5 px-3 text-right">Clouds (%)</th>
                  <th className="py-2.5 px-3 text-right">Prev Rain (mm)</th>
                  <th className="py-2.5 px-4">Prediction</th>
                  <th className="py-2.5 px-3 text-right">Probability</th>
                  <th className="py-2.5 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                      {row.temperature.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                      {row.humidity.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                      {row.pressure.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                      {row.wind_speed.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                      {row.cloud_cover.toFixed(0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                      {row.previous_rainfall.toFixed(1)}
                    </td>
                    <td
                      className={`py-3 px-4 text-xs font-semibold whitespace-nowrap ${
                        row.predicted_label === 'Rain'
                          ? 'text-blue-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {row.predicted_label}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {(row.rain_probability * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDeleteRow(row.id)}
                        aria-label={`Delete prediction ${row.id}`}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
