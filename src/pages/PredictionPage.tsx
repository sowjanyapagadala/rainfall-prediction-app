import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CloudRain,
  Loader2,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { submitPrediction } from '../api';
import type {
  PageId,
  PredictionResult,
  SystemStatus,
  WeatherInput,
} from '../types';

interface PredictionPageProps {
  status: SystemStatus | null;
  onNavigate: (page: PageId) => void;
  onPredictionCreated: () => void;
}

const PRESETS: Array<{ label: string; values: WeatherInput }> = [
  {
    label: 'Storm / Monsoon Front',
    values: {
      temperature: 22.4,
      humidity: 91,
      pressure: 997.5,
      wind_speed: 31.5,
      cloud_cover: 92,
      previous_rainfall: 14.8,
    },
  },
  {
    label: 'Overcast Coastal',
    values: {
      temperature: 19.8,
      humidity: 79,
      pressure: 1007.2,
      wind_speed: 19.0,
      cloud_cover: 74,
      previous_rainfall: 2.5,
    },
  },
  {
    label: 'Clear High Pressure',
    values: {
      temperature: 29.2,
      humidity: 38,
      pressure: 1022.4,
      wind_speed: 8.5,
      cloud_cover: 14,
      previous_rainfall: 0.0,
    },
  },
];

const INITIAL_FORM: Record<keyof WeatherInput, string> = {
  temperature: '24.0',
  humidity: '78',
  pressure: '1006.5',
  wind_speed: '18.5',
  cloud_cover: '75',
  previous_rainfall: '4.2',
};

const FIELD_CONSTRAINTS: Record<
  keyof WeatherInput,
  { label: string; unit: string; min: number; max: number; step: string; hint: string }
> = {
  temperature: {
    label: 'Temperature (°C)',
    unit: '°C',
    min: -50,
    max: 60,
    step: '0.1',
    hint: 'Valid range: -50 to 60 °C',
  },
  humidity: {
    label: 'Humidity (%)',
    unit: '%',
    min: 0,
    max: 100,
    step: '0.1',
    hint: 'Relative humidity: 0 to 100%',
  },
  pressure: {
    label: 'Atmospheric Pressure (hPa)',
    unit: 'hPa',
    min: 850,
    max: 1100,
    step: '0.1',
    hint: 'Sea-level pressure: 850 to 1100 hPa',
  },
  wind_speed: {
    label: 'Wind Speed (km/h)',
    unit: 'km/h',
    min: 0,
    max: 250,
    step: '0.1',
    hint: 'Surface wind speed: 0 to 250 km/h',
  },
  cloud_cover: {
    label: 'Cloud Cover (%)',
    unit: '%',
    min: 0,
    max: 100,
    step: '1',
    hint: 'Sky coverage: 0 to 100%',
  },
  previous_rainfall: {
    label: 'Previous Rainfall (mm)',
    unit: 'mm',
    min: 0,
    max: 1000,
    step: '0.1',
    hint: 'Prior 24h accumulation: 0 to 1000 mm',
  },
};

export function PredictionPage({
  status,
  onNavigate,
  onPredictionCreated,
}: PredictionPageProps) {
  const [formValues, setFormValues] =
    useState<Record<keyof WeatherInput, string>>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof WeatherInput, string>>
  >({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);

  const modelTrained = Boolean(status?.modelTrained && status.modelMetrics);

  const handleChange = (field: keyof WeatherInput, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const applyPreset = (values: WeatherInput) => {
    setFormValues({
      temperature: String(values.temperature),
      humidity: String(values.humidity),
      pressure: String(values.pressure),
      wind_speed: String(values.wind_speed),
      cloud_cover: String(values.cloud_cover),
      previous_rainfall: String(values.previous_rainfall),
    });
    setFieldErrors({});
    setServerError(null);
  };

  const handleReset = () => {
    setFormValues(INITIAL_FORM);
    setFieldErrors({});
    setServerError(null);
    setResult(null);
  };

  const validateForm = (): WeatherInput | null => {
    const errors: Partial<Record<keyof WeatherInput, string>> = {};
    const parsed: Partial<WeatherInput> = {};

    (Object.keys(FIELD_CONSTRAINTS) as Array<keyof WeatherInput>).forEach(
      (field) => {
        const raw = formValues[field].trim();
        const cfg = FIELD_CONSTRAINTS[field];
        if (!raw) {
          errors[field] = 'Required value';
          return;
        }
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          errors[field] = 'Enter a valid number';
          return;
        }
        if (num < cfg.min || num > cfg.max) {
          errors[field] = `Must be ${cfg.min} to ${cfg.max} ${cfg.unit}`;
          return;
        }
        parsed[field] = num;
      },
    );

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return null;
    return parsed as WeatherInput;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const validInput = validateForm();
    if (!validInput) return;

    setLoading(true);
    try {
      const res = await submitPrediction(validInput);
      setResult(res);
      onPredictionCreated();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Prediction request failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Rainfall Prediction
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter meteorological observations to classify Rain vs No Rain using
            the trained Random Forest model.
          </p>
        </div>

        {status?.modelMetrics && (
          <div className="text-xs text-slate-500 tabular-nums">
            Active Model: {status.modelMetrics.algorithm} ·{' '}
            {(status.modelMetrics.accuracy * 100).toFixed(1)}% test accuracy
          </div>
        )}
      </div>

      {!modelTrained && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div>
              <div className="text-sm font-semibold text-amber-950">
                No trained Random Forest model found
              </div>
              <p className="mt-0.5 text-sm text-amber-800">
                Upload a historical weather CSV dataset (or load the sample
                365-day dataset) before running rainfall predictions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('dataset')}
            className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 whitespace-nowrap shrink-0"
          >
            Go to Dataset Upload
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Weather Input Form */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Weather Parameters
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.values)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(Object.keys(FIELD_CONSTRAINTS) as Array<keyof WeatherInput>).map(
                (field) => {
                  const cfg = FIELD_CONSTRAINTS[field];
                  const err = fieldErrors[field];
                  return (
                    <div key={field}>
                      <label
                        htmlFor={`predict-${field}`}
                        className="block text-xs font-semibold text-slate-700"
                      >
                        {cfg.label}
                      </label>
                      <input
                        id={`predict-${field}`}
                        type="number"
                        step={cfg.step}
                        min={cfg.min}
                        max={cfg.max}
                        value={formValues[field]}
                        onChange={(e) => handleChange(field, e.target.value)}
                        aria-invalid={Boolean(err)}
                        className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 font-mono text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 ${
                          err
                            ? 'border-red-400 bg-red-50/40 focus:border-red-600 focus:ring-red-600/20'
                            : 'border-slate-300 bg-white focus:border-blue-600 focus:ring-blue-600/20'
                        }`}
                      />
                      {err ? (
                        <p className="mt-1 text-xs font-medium text-red-700">
                          {err}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">{cfg.hint}</p>
                      )}
                    </div>
                  );
                },
              )}
            </div>

            {serverError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                {serverError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Reset Defaults</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CloudRain className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{loading ? 'Analyzing Weather...' : 'Predict Rainfall'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Prediction Output Panel */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="border-b border-slate-200 pb-4 font-display text-base font-semibold text-slate-900">
            Forecast Output
          </h2>

          {!result ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <CloudRain className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-slate-900">
                Awaiting Weather Submission
              </h3>
              <p className="mt-1.5 max-w-xs text-sm text-slate-500">
                Adjust the six meteorological parameters and click Predict
                Rainfall to view classification status, probability, and feature
                drivers.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {/* Primary Status & Probability */}
              <div
                className={`rounded-xl border p-5 ${
                  result.prediction === 'Rain'
                    ? 'border-blue-200 bg-blue-50/70'
                    : 'border-emerald-200 bg-emerald-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-slate-600">
                      Predicted Rainfall Status
                    </div>
                    <div className="mt-1 font-display text-3xl font-bold text-slate-900">
                      {result.prediction}
                    </div>
                  </div>
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${
                      result.prediction === 'Rain'
                        ? 'bg-blue-700'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {result.prediction === 'Rain' ? (
                      <CloudRain className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Sun className="h-6 w-6" aria-hidden="true" />
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 tabular-nums">
                    <span>Rainfall Probability</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {(result.rainProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white border border-slate-200">
                    <div
                      className={`h-full transition-all duration-200 ${
                        result.prediction === 'Rain'
                          ? 'bg-blue-700'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.round(result.rainProbability * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                    <span>
                      No Rain: {(result.noRainProbability * 100).toFixed(1)}%
                    </span>
                    <span>
                      Forest Vote: {result.treesVotingRain}/{result.totalTrees}{' '}
                      trees
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div>
                <h3 className="text-xs font-semibold text-slate-700">
                  Prediction Explanation
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  {result.summaryText}
                </p>
              </div>

              {/* Input Summary */}
              <div>
                <h3 className="text-xs font-semibold text-slate-700">
                  Input Weather Summary
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-slate-500">Temp</div>
                    <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {result.input.temperature} °C
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-slate-500">Humidity</div>
                    <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {result.input.humidity} %
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-slate-500">Pressure</div>
                    <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {result.input.pressure} hPa
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-slate-500">Wind</div>
                    <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {result.input.wind_speed} km/h
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-slate-500">Cloud Cover</div>
                    <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {result.input.cloud_cover} %
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-slate-500">Prev Rain</div>
                    <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {result.input.previous_rainfall} mm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Factor Breakdown Table after Prediction */}
      {result && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Meteorological Factor Comparison
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Compares your entered values against the training dataset&apos;s
              Rain and No Rain class averages, ordered by Random Forest feature
              importance.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Parameter</th>
                  <th className="py-2.5 px-4 text-right">Your Input</th>
                  <th className="py-2.5 px-4 text-right">Rain Avg</th>
                  <th className="py-2.5 px-4 text-right">No Rain Avg</th>
                  <th className="py-2.5 px-4 text-right">Model Weight</th>
                  <th className="py-2.5 pl-4">Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.contributions.map((item) => (
                  <tr key={item.feature} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-4 font-medium text-slate-900 whitespace-nowrap">
                      {item.label}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {item.value} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {item.rainMean} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {item.noRainMean} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 tabular-nums whitespace-nowrap">
                      {(item.importance * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 pl-4 text-xs text-slate-600">
                      {item.summary}
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
