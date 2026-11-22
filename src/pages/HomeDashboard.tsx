import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  CloudRain,
  Database,
  History,
  Loader2,
  Sun,
} from 'lucide-react';
import { submitPrediction } from '../api';
import type {
  PageId,
  PredictionResult,
  SystemStatus,
  WeatherInput,
} from '../types';

interface HomeDashboardProps {
  status: SystemStatus | null;
  onNavigate: (page: PageId) => void;
  onPredictionCreated: () => void;
}

const DEFAULT_QUICK_INPUT: WeatherInput = {
  temperature: 21.5,
  humidity: 84,
  pressure: 1004.5,
  wind_speed: 22,
  cloud_cover: 82,
  previous_rainfall: 6.4,
};

export function HomeDashboard({
  status,
  onNavigate,
  onPredictionCreated,
}: HomeDashboardProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [quickInput, setQuickInput] = useState<WeatherInput>(DEFAULT_QUICK_INPUT);
  const [predicting, setPredicting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickResult, setQuickResult] = useState<PredictionResult | null>(null);

  const handleFieldChange = (field: keyof WeatherInput, value: string) => {
    const parsed = value === '' ? 0 : Number(value);
    setQuickInput((prev) => ({
      ...prev,
      [field]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  const handleQuickPredict = async (e: FormEvent) => {
    e.preventDefault();
    setQuickError(null);
    setPredicting(true);
    try {
      const result = await submitPrediction(quickInput);
      setQuickResult(result);
      onPredictionCreated();
    } catch (err) {
      setQuickError(
        err instanceof Error ? err.message : 'Unable to execute prediction.',
      );
    } finally {
      setPredicting(false);
    }
  };

  const featureCards: Array<{
    page: PageId;
    title: string;
    description: string;
    actionLabel: string;
    icon: typeof CloudRain;
  }> = [
    {
      page: 'predict',
      title: 'Rainfall Prediction',
      description:
        'Enter atmospheric temperature, humidity, pressure, wind speed, cloud cover, and prior rainfall for instant classification.',
      actionLabel: 'Open Predictor',
      icon: CloudRain,
    },
    {
      page: 'dataset',
      title: 'Historical Weather Data',
      description:
        'Upload CSV weather records, inspect missing-value imputation, validate columns, and train the Random Forest model.',
      actionLabel: 'Manage Dataset',
      icon: Database,
    },
    {
      page: 'analytics',
      title: 'Machine Learning Analytics',
      description:
        'Explore interactive Chart.js rainfall distributions, meteorological trends, confusion matrix, and model accuracy metrics.',
      actionLabel: 'View Analytics',
      icon: BarChart3,
    },
    {
      page: 'history',
      title: 'Prediction History',
      description:
        'Review timestamped forecasts, input parameter logs, and predicted probabilities persisted in SQLite.',
      actionLabel: 'Inspect History',
      icon: History,
    },
  ];

  const modelTrained = Boolean(status?.modelTrained && status.modelMetrics);
  const datasetLoaded = Boolean(status?.datasetLoaded && status.dataset);

  return (
    <div className="space-y-8">
      {/* Welcome Hero Split */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
          <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7">
            <div>
              <p className="text-xs font-medium text-blue-700">
                Meteorological Decision Support · Random Forest Classifier
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl text-balance">
                Rainfall Prediction Using Machine Learning
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
                Intelligent weather analysis and rainfall forecasting using
                historical meteorological data.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate(modelTrained ? 'predict' : 'dataset')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <span>
                  {modelTrained ? 'Predict Rainfall' : 'Upload Dataset & Train'}
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('analytics')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <span>Explore Analytics</span>
              </button>
            </div>
          </div>

          <div className="relative min-h-[240px] bg-slate-900 lg:col-span-5">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/meteorology_radar_hero_1795324531068.jpg"
                alt="Automated coastal meteorological weather station under storm clouds"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 p-8 text-center text-white">
                <CloudRain className="h-12 w-12 text-blue-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-200">
                  Atmospheric Telemetry & Precipitation Forecasting
                </p>
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent"
              aria-hidden="true"
            />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <div className="text-xs font-medium text-blue-200">
                Active Engine
              </div>
              <div className="mt-1 text-sm font-semibold">
                {modelTrained
                  ? `Trained on ${status?.dataset?.validRowCount} meteorological observations`
                  : 'Awaiting historical CSV upload for model training'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Honest 4-Column System Metrics Strip */}
      <section aria-label="System Metrics Summary">
        <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">Model State</div>
            <div className="mt-1.5 font-display text-lg font-semibold text-slate-900">
              {modelTrained ? 'Trained & Active' : 'Not Trained'}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {modelTrained
                ? `${status?.modelMetrics?.nEstimators} decision trees`
                : 'Load CSV to train classifier'}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">
              Historical Dataset
            </div>
            <div className="mt-1.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
              {datasetLoaded ? `${status?.dataset?.validRowCount} rows` : '0 rows'}
            </div>
            <div className="mt-1 text-xs text-slate-500 truncate">
              {datasetLoaded
                ? status?.dataset?.filename
                : 'No CSV file uploaded'}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">
              Test Set Accuracy
            </div>
            <div className="mt-1.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
              {modelTrained && status?.modelMetrics
                ? `${(status.modelMetrics.accuracy * 100).toFixed(1)}%`
                : '—'}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {modelTrained && status?.modelMetrics
                ? `F1 ${(status.modelMetrics.f1Score * 100).toFixed(1)}% on ${status.modelMetrics.testSize} test rows`
                : 'Evaluated after dataset split'}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs font-medium text-slate-500">
              Logged Predictions
            </div>
            <div className="mt-1.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
              {status?.predictionCount ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Stored in SQLite history
            </div>
          </div>
        </div>
      </section>

      {/* Current Weather Input Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Current Weather Input
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Run a quick forecast directly from the dashboard or open the full
              predictor for detailed feature diagnostics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('predict')}
            className="text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 text-left sm:text-right"
          >
            Full Prediction Workspace
          </button>
        </div>

        <form onSubmit={handleQuickPredict} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="quick-temp"
                className="block text-xs font-medium text-slate-700"
              >
                Temperature (°C)
              </label>
              <input
                id="quick-temp"
                type="number"
                step="0.1"
                min={-50}
                max={60}
                required
                value={quickInput.temperature}
                onChange={(e) => handleFieldChange('temperature', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="quick-humidity"
                className="block text-xs font-medium text-slate-700"
              >
                Humidity (%)
              </label>
              <input
                id="quick-humidity"
                type="number"
                step="0.1"
                min={0}
                max={100}
                required
                value={quickInput.humidity}
                onChange={(e) => handleFieldChange('humidity', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="quick-pressure"
                className="block text-xs font-medium text-slate-700"
              >
                Atmospheric Pressure (hPa)
              </label>
              <input
                id="quick-pressure"
                type="number"
                step="0.1"
                min={850}
                max={1100}
                required
                value={quickInput.pressure}
                onChange={(e) => handleFieldChange('pressure', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="quick-wind"
                className="block text-xs font-medium text-slate-700"
              >
                Wind Speed (km/h)
              </label>
              <input
                id="quick-wind"
                type="number"
                step="0.1"
                min={0}
                max={250}
                required
                value={quickInput.wind_speed}
                onChange={(e) => handleFieldChange('wind_speed', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="quick-cloud"
                className="block text-xs font-medium text-slate-700"
              >
                Cloud Cover (%)
              </label>
              <input
                id="quick-cloud"
                type="number"
                step="1"
                min={0}
                max={100}
                required
                value={quickInput.cloud_cover}
                onChange={(e) => handleFieldChange('cloud_cover', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="quick-prev-rain"
                className="block text-xs font-medium text-slate-700"
              >
                Previous Rainfall (mm)
              </label>
              <input
                id="quick-prev-rain"
                type="number"
                step="0.1"
                min={0}
                max={1000}
                required
                value={quickInput.previous_rainfall}
                onChange={(e) =>
                  handleFieldChange('previous_rainfall', e.target.value)
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="text-xs text-slate-500">
              {modelTrained
                ? 'Predictions run against the active trained Random Forest model and save to history.'
                : 'Upload or load a historical dataset first to enable predictions.'}
            </div>

            <button
              type="submit"
              disabled={predicting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {predicting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{predicting ? 'Predicting...' : 'Predict Rainfall'}</span>
            </button>
          </div>
        </form>

        {quickError && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{quickError}</span>
            {!modelTrained && (
              <button
                type="button"
                onClick={() => onNavigate('dataset')}
                className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 whitespace-nowrap shrink-0"
              >
                Go to Dataset Upload
              </button>
            )}
          </div>
        )}

        {quickResult && (
          <div className="mt-5 flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  quickResult.prediction === 'Rain'
                    ? 'bg-blue-700 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {quickResult.prediction === 'Rain' ? (
                  <CloudRain className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold text-slate-900">
                    Forecast: {quickResult.prediction}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span className="font-mono text-sm font-semibold text-blue-700 tabular-nums">
                    {(quickResult.rainProbability * 100).toFixed(1)}% Rain Probability
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {quickResult.summaryText}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              View in History
            </button>
          </div>
        )}
      </section>

      {/* Four Core Feature Cards */}
      <section aria-label="System Modules">
        <div className="mb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            System Modules
          </h2>
          <p className="text-sm text-slate-600">
            Navigate to any stage of the machine learning rainfall forecasting
            workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.page}
                type="button"
                onClick={() => onNavigate(card.page)}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-blue-300 hover:bg-slate-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white group-hover:bg-blue-700 transition-colors">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold text-slate-900">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {card.description}
                  </p>
                </div>

                <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <span>{card.actionLabel}</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
