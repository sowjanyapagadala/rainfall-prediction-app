import { useEffect, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { BarChart3, Database } from 'lucide-react';
import { fetchAnalytics } from '../api';
import type { AnalyticsResponse, PageId, WeatherInput } from '../types';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
);

interface AnalyticsPageProps {
  onNavigate: (page: PageId) => void;
}

const TREND_OPTIONS: Array<{ key: keyof WeatherInput; label: string }> = [
  { key: 'humidity', label: 'Humidity (%)' },
  { key: 'cloud_cover', label: 'Cloud Cover (%)' },
  { key: 'pressure', label: 'Pressure (hPa)' },
  { key: 'temperature', label: 'Temperature (°C)' },
  { key: 'wind_speed', label: 'Wind Speed (km/h)' },
  { key: 'previous_rainfall', label: 'Prev Rainfall (mm)' },
];

export function AnalyticsPage({ onNavigate }: AnalyticsPageProps) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] =
    useState<keyof WeatherInput>('humidity');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAnalytics();
        if (active) setData(res);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load analytics metrics.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Loading meteorological analytics and model evaluation metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
      >
        {error}
      </div>
    );
  }

  if (!data || !data.hasData || !data.modelMetrics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Data Analytics & Model Evaluation
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Interactive Chart.js visualizations and Random Forest test-split
            diagnostics.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
            No Dataset Loaded for Analytics
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Metrics, confusion matrix values, and meteorological distributions
            are computed strictly from real loaded datasets—never fabricated.
            Upload a CSV or load the sample dataset to populate charts.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('dataset')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            <Database className="h-4 w-4" aria-hidden="true" />
            <span>Go to Dataset Upload</span>
          </button>
        </div>
      </div>
    );
  }

  const { modelMetrics, rainDistribution, parameterComparisons, binnedTrends } =
    data;
  const activeTrend = binnedTrends[selectedFeature];
  const cm = modelMetrics.confusionMatrix;

  const doughnutData = {
    labels: ['Rain (1)', 'No Rain (0)'],
    datasets: [
      {
        data: [rainDistribution.rain, rainDistribution.noRain],
        backgroundColor: ['#1D4ED8', '#0F172A'],
        borderColor: ['#FFFFFF', '#FFFFFF'],
        borderWidth: 2,
      },
    ],
  };

  const comparisonFeatures = parameterComparisons.filter(
    (p) => p.feature !== 'pressure',
  );
  const comparisonBarData = {
    labels: comparisonFeatures.map((p) => `${p.label} (${p.unit})`),
    datasets: [
      {
        label: 'Rain Days Mean',
        data: comparisonFeatures.map((p) => p.rainMean),
        backgroundColor: '#1D4ED8',
        borderRadius: 4,
      },
      {
        label: 'No Rain Days Mean',
        data: comparisonFeatures.map((p) => p.noRainMean),
        backgroundColor: '#94A3B8',
        borderRadius: 4,
      },
    ],
  };

  const trendBarData = {
    labels: activeTrend.bins.map((b) => `${b.rangeLabel} ${activeTrend.unit}`),
    datasets: [
      {
        label: 'Rain Frequency (%)',
        data: activeTrend.bins.map((b) => b.rainRate),
        backgroundColor: '#2563EB',
        borderRadius: 4,
      },
    ],
  };

  const importanceBarData = {
    labels: modelMetrics.featureImportances.map((f) => f.label),
    datasets: [
      {
        label: 'Relative Importance (%)',
        data: modelMetrics.featureImportances.map((f) =>
          Number((f.importance * 100).toFixed(1)),
        ),
        backgroundColor: '#0F172A',
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Data Analytics & Model Evaluation
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Interactive rainfall distributions, weather parameter trends, and
            held-out test performance for {data.dataset?.filename}.
          </p>
        </div>
        <div className="text-xs text-slate-500 tabular-nums">
          Train {modelMetrics.trainSize} · Test {modelMetrics.testSize} ·{' '}
          {modelMetrics.nEstimators} trees
        </div>
      </div>

      {/* Model Performance Metrics Strip */}
      <section aria-label="Model Evaluation Metrics">
        <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">Accuracy</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {(modelMetrics.accuracy * 100).toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Correct test predictions
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">Precision</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {(modelMetrics.precision * 100).toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-slate-500">
              TP / (TP + FP)
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">Recall</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {(modelMetrics.recall * 100).toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-slate-500">
              TP / (TP + FN)
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">F1-Score</div>
            <div className="mt-1 font-mono text-2xl font-bold text-blue-700 tabular-nums">
              {(modelMetrics.f1Score * 100).toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Harmonic mean
            </div>
          </div>
        </div>
      </section>

      {/* Row 1: Rainfall Distribution & Confusion Matrix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Rainfall Distribution
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
            {rainDistribution.rain} Rain ({rainDistribution.rainPercentage}%) vs{' '}
            {rainDistribution.noRain} No Rain ({rainDistribution.noRainPercentage}%)
          </p>

          <div className="mx-auto mt-5 h-60 max-w-xs">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '64%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      usePointStyle: true,
                      padding: 16,
                      font: { family: 'DM Sans', size: 12 },
                    },
                  },
                },
              }}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Confusion Matrix (Test Split)
              </h2>
              <p className="text-xs text-slate-500 tabular-nums">
                Evaluated on {modelMetrics.testSize} unseen observations (20% split)
              </p>
            </div>
            <div className="text-xs font-medium text-slate-600">
              Rows: Actual · Columns: Predicted
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
            <div />
            <div className="py-2 font-semibold text-slate-600">
              Predicted: No Rain (0)
            </div>
            <div className="py-2 font-semibold text-slate-600">
              Predicted: Rain (1)
            </div>

            <div className="flex items-center justify-end pr-3 font-semibold text-slate-600">
              Actual: No Rain (0)
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="font-mono text-2xl font-bold text-emerald-900 tabular-nums">
                {cm.tn}
              </div>
              <div className="mt-1 text-xs font-medium text-emerald-700">
                True Negative
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="font-mono text-2xl font-bold text-amber-900 tabular-nums">
                {cm.fp}
              </div>
              <div className="mt-1 text-xs font-medium text-amber-700">
                False Positive
              </div>
            </div>

            <div className="flex items-center justify-end pr-3 font-semibold text-slate-600">
              Actual: Rain (1)
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="font-mono text-2xl font-bold text-amber-900 tabular-nums">
                {cm.fn}
              </div>
              <div className="mt-1 text-xs font-medium text-amber-700">
                False Negative
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="font-mono text-2xl font-bold text-blue-900 tabular-nums">
                {cm.tp}
              </div>
              <div className="mt-1 text-xs font-medium text-blue-700">
                True Positive
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: Weather Trends by Parameter */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Rainfall Frequency by Parameter Range
            </h2>
            <p className="text-xs text-slate-500">
              Select a meteorological parameter to inspect how rainfall likelihood
              varies across observed measurement bins.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {TREND_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedFeature(opt.key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedFeature === opt.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 h-72">
          <Bar
            data={trendBarData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    callback: (value) => `${value}%`,
                  },
                },
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const bin = activeTrend.bins[ctx.dataIndex];
                      return `Rain rate: ${bin.rainRate}% (${bin.rainCount}/${bin.totalCount} records)`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </section>

      {/* Row 3: Weather Parameter Comparison & Feature Importances */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Rain vs No Rain Parameter Averages
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Mean atmospheric readings grouped by rainfall outcome (pressure shown
            in quality summary due to hPa scale).
          </p>

          <div className="mt-5 h-72">
            <Bar
              data={comparisonBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      usePointStyle: true,
                      font: { family: 'DM Sans', size: 12 },
                    },
                  },
                },
              }}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Random Forest Feature Importance
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Normalized Gini impurity reduction across {modelMetrics.nEstimators}{' '}
            decision trees.
          </p>

          <div className="mt-5 h-72">
            <Bar
              data={importanceBarData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: {
                    beginAtZero: true,
                    ticks: {
                      callback: (v) => `${v}%`,
                    },
                  },
                },
                plugins: {
                  legend: { display: false },
                },
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
