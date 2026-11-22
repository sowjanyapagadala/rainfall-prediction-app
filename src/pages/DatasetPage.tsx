import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  fetchDatasetPreview,
  loadSampleDataset,
  uploadDatasetCsv,
} from '../api';
import type { DatasetRow, DatasetSummary, ModelMetrics, PageId } from '../types';

interface DatasetPageProps {
  onDatasetTrained: () => void;
  onNavigate: (page: PageId) => void;
}

export function DatasetPage({ onDatasetTrained, onNavigate }: DatasetPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterRain, setFilterRain] = useState<'all' | 'rain' | 'no_rain'>('all');
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMetrics, setSuccessMetrics] = useState<ModelMetrics | null>(null);

  const PAGE_SIZE = 25;

  const loadPreview = async (nextOffset = 0) => {
    setLoadingPreview(true);
    try {
      const data = await fetchDatasetPreview(PAGE_SIZE, nextOffset);
      setDataset(data.dataset);
      setRows(data.rows);
      setTotalRows(data.total);
      setOffset(nextOffset);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to fetch dataset preview.',
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    void loadPreview(0);
  }, []);

  const handleCsvUpload = async (file: File) => {
    setError(null);
    setSuccessMetrics(null);
    setUploading(true);
    try {
      const res = await uploadDatasetCsv(file);
      setDataset(res.dataset);
      setRows(res.previewRows.slice(0, PAGE_SIZE));
      setTotalRows(res.totalRows);
      setOffset(0);
      setSuccessMetrics(res.modelMetrics);
      onDatasetTrained();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'CSV upload and training failed.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSample = async () => {
    setError(null);
    setSuccessMetrics(null);
    setUploading(true);
    try {
      const res = await loadSampleDataset();
      setDataset(res.dataset);
      setRows(res.previewRows.slice(0, PAGE_SIZE));
      setTotalRows(res.totalRows);
      setOffset(0);
      setSuccessMetrics(res.modelMetrics);
      onDatasetTrained();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load sample dataset.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleCsvUpload(file);
    }
  };

  const filteredRows = rows.filter((r) => {
    if (filterRain === 'rain') return r.rain === 1;
    if (filterRain === 'no_rain') return r.rain === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Dataset Upload & Preprocessing
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload a historical meteorological CSV to clean missing values,
            encode targets, split 80/20, and train the Random Forest classifier.
          </p>
        </div>

        <a
          href="/api/dataset/sample-csv"
          download="sample_meteorological_data.csv"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>Download Sample CSV</span>
        </a>
      </div>

      {/* Upload Dropzone & Controls */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-600 bg-blue-50/60'
              : 'border-slate-300 bg-slate-50/70'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-6 w-6" aria-hidden="true" />
            )}
          </div>

          <h2 className="mt-4 font-display text-base font-semibold text-slate-900">
            {uploading
              ? 'Cleaning CSV & Training Random Forest Classifier...'
              : 'Upload Historical Weather CSV'}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Required columns: <span className="font-mono text-xs">temperature</span>,{' '}
            <span className="font-mono text-xs">humidity</span>,{' '}
            <span className="font-mono text-xs">pressure</span>,{' '}
            <span className="font-mono text-xs">wind_speed</span>,{' '}
            <span className="font-mono text-xs">cloud_cover</span>,{' '}
            <span className="font-mono text-xs">previous_rainfall</span>, and{' '}
            <span className="font-mono text-xs">rain</span> (0/1 or Yes/No).
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCsvUpload(file);
              e.target.value = '';
            }}
          />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              <span>Select CSV File</span>
            </button>

            <button
              type="button"
              disabled={uploading}
              onClick={handleLoadSample}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Database className="h-4 w-4" aria-hidden="true" />
              <span>Load Sample 365-Day Dataset</span>
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <div className="font-semibold">Dataset Validation Error</div>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {successMetrics && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <div>
                <div className="font-semibold">
                  Dataset processed and Random Forest model trained
                </div>
                <p className="mt-0.5 text-xs text-emerald-900 tabular-nums">
                  Evaluated on {successMetrics.testSize} held-out test records:
                  Accuracy {(successMetrics.accuracy * 100).toFixed(1)}% ·
                  Precision {(successMetrics.precision * 100).toFixed(1)}% ·
                  Recall {(successMetrics.recall * 100).toFixed(1)}% · F1{' '}
                  {(successMetrics.f1Score * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('predict')}
                className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
              >
                Predict Now
              </button>
              <button
                type="button"
                onClick={() => onNavigate('analytics')}
                className="rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 whitespace-nowrap"
              >
                View Analytics
              </button>
            </div>
          </div>
        )}
      </section>

      {loadingPreview ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading dataset metadata...
        </div>
      ) : !dataset ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Database className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            No Dataset Loaded Yet
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Upload your own CSV meteorological dataset above or load the sample
            365-day weather record to inspect rows and train the classifier.
          </p>
        </div>
      ) : (
        <>
          {/* Dataset Summary Metrics */}
          <section className="grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Active CSV File
              </div>
              <div className="mt-1 font-display text-sm font-semibold text-slate-900 truncate">
                {dataset.filename}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {dataset.columns.length} standardized features
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Valid Records
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {dataset.validRowCount} / {dataset.rowCount}
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                {dataset.droppedRows} dropped during validation
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Missing Values Imputed
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {dataset.missingImputedCount}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Training-split median imputation
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">
                Class Distribution
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {dataset.rainCount} Rain / {dataset.noRainCount} Clear
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                {((dataset.rainCount / dataset.validRowCount) * 100).toFixed(1)}%
                rain frequency
              </div>
            </div>
          </section>

          {/* Data Quality & Preprocessing Audit */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Column Data Quality Report
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Column</th>
                      <th className="py-2 px-3 text-right font-semibold">Missing</th>
                      <th className="py-2 px-3 text-right font-semibold">Imputed</th>
                      <th className="py-2 px-3 text-right font-semibold">Min</th>
                      <th className="py-2 px-3 text-right font-semibold">Median</th>
                      <th className="py-2 pl-3 text-right font-semibold">Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataset.qualityReport.map((col) => (
                      <tr key={col.column}>
                        <td className="py-2.5 pr-3 font-mono font-medium text-slate-900">
                          {col.column}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {col.missingCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {col.imputedCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {col.min !== undefined ? col.min : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {col.median !== undefined ? col.median : '—'}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-700">
                          {col.max !== undefined ? col.max : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Preprocessing Pipeline Log
              </h2>
              <ol className="mt-4 space-y-2.5 text-sm text-slate-700">
                {dataset.preprocessingSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="mt-0.5 font-mono text-xs font-semibold text-blue-700 tabular-nums">
                      0{idx + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Dataset Preview Table */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Dataset Records Preview
                </h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  Showing rows {offset + 1}–{Math.min(offset + rows.length, totalRows)}{' '}
                  of {totalRows} cleaned records
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start">
                {(
                  [
                    { id: 'all', label: 'All Rows' },
                    { id: 'rain', label: 'Rain (1)' },
                    { id: 'no_rain', label: 'No Rain (0)' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterRain(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      filterRain === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 pr-4">#</th>
                    <th className="py-2.5 px-3 text-right">Temp (°C)</th>
                    <th className="py-2.5 px-3 text-right">Humidity (%)</th>
                    <th className="py-2.5 px-3 text-right">Pressure (hPa)</th>
                    <th className="py-2.5 px-3 text-right">Wind (km/h)</th>
                    <th className="py-2.5 px-3 text-right">Clouds (%)</th>
                    <th className="py-2.5 px-3 text-right">Prev Rain (mm)</th>
                    <th className="py-2.5 pl-4">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-500 tabular-nums">
                        {offset + idx + 1}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                        {row.temperature.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                        {row.humidity.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                        {row.pressure.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                        {row.wind_speed.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                        {row.cloud_cover.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                        {row.previous_rainfall.toFixed(1)}
                      </td>
                      <td
                        className={`py-2.5 pl-4 text-xs font-semibold ${
                          row.rain === 1 ? 'text-blue-700' : 'text-emerald-700'
                        }`}
                      >
                        {row.rain === 1 ? 'Rain (1)' : 'No Rain (0)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => void loadPreview(Math.max(0, offset - PAGE_SIZE))}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Page {Math.floor(offset / PAGE_SIZE) + 1} of{' '}
                {Math.max(1, Math.ceil(totalRows / PAGE_SIZE))}
              </span>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= totalRows}
                onClick={() => void loadPreview(offset + PAGE_SIZE)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
