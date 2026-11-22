import type {
  AnalyticsResponse,
  BinnedTrend,
  DatasetRow,
  DatasetSummary,
  ModelMetrics,
  ParameterComparison,
  WeatherInput,
} from '../src/types.ts';
import { CORE_FEATURES, FEATURE_META } from './ml/preprocessing.ts';

function computeBinnedTrend(
  rows: DatasetRow[],
  feature: keyof WeatherInput,
  binCount = 5,
): BinnedTrend {
  const values = rows.map((r) => r[feature]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal;
  const step = span > 0 ? span / binCount : 1;

  const bins = Array.from({ length: binCount }, (_, idx) => {
    const start = minVal + idx * step;
    const end = idx === binCount - 1 ? maxVal : minVal + (idx + 1) * step;
    return {
      start,
      end,
      rangeLabel:
        span > 0
          ? `${start.toFixed(feature === 'pressure' ? 0 : 1)}–${end.toFixed(feature === 'pressure' ? 0 : 1)}`
          : `${start.toFixed(1)}`,
      totalCount: 0,
      rainCount: 0,
      noRainCount: 0,
      rainRate: 0,
    };
  });

  for (const row of rows) {
    const v = row[feature];
    let idx = span > 0 ? Math.floor((v - minVal) / step) : 0;
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;

    bins[idx].totalCount += 1;
    if (row.rain === 1) bins[idx].rainCount += 1;
    else bins[idx].noRainCount += 1;
  }

  for (const b of bins) {
    b.rainRate =
      b.totalCount > 0 ? Number(((b.rainCount / b.totalCount) * 100).toFixed(1)) : 0;
  }

  return {
    feature,
    label: FEATURE_META[feature].label,
    unit: FEATURE_META[feature].unit,
    bins: bins.map(({ rangeLabel, totalCount, rainCount, noRainCount, rainRate }) => ({
      rangeLabel,
      totalCount,
      rainCount,
      noRainCount,
      rainRate,
    })),
  };
}

export function buildAnalyticsPayload(params: {
  dataset: DatasetSummary | null;
  modelMetrics: ModelMetrics | null;
  rows: DatasetRow[];
}): AnalyticsResponse {
  if (!params.dataset || params.rows.length === 0) {
    const emptyBins = {} as Record<keyof WeatherInput, BinnedTrend>;
    for (const f of CORE_FEATURES) {
      emptyBins[f] = {
        feature: f,
        label: FEATURE_META[f].label,
        unit: FEATURE_META[f].unit,
        bins: [],
      };
    }

    return {
      hasData: false,
      dataset: null,
      modelMetrics: null,
      rainDistribution: {
        rain: 0,
        noRain: 0,
        rainPercentage: 0,
        noRainPercentage: 0,
      },
      parameterComparisons: [],
      binnedTrends: emptyBins,
      scatterSample: [],
    };
  }

  const rainRows = params.rows.filter((r) => r.rain === 1);
  const noRainRows = params.rows.filter((r) => r.rain === 0);
  const total = params.rows.length;

  const parameterComparisons: ParameterComparison[] = CORE_FEATURES.map((f) => {
    const rainMean = rainRows.length
      ? Number((rainRows.reduce((s, r) => s + r[f], 0) / rainRows.length).toFixed(2))
      : 0;
    const noRainMean = noRainRows.length
      ? Number((noRainRows.reduce((s, r) => s + r[f], 0) / noRainRows.length).toFixed(2))
      : 0;
    const overallMean = Number(
      (params.rows.reduce((s, r) => s + r[f], 0) / total).toFixed(2),
    );

    return {
      feature: f,
      label: FEATURE_META[f].label,
      unit: FEATURE_META[f].unit,
      rainMean,
      noRainMean,
      overallMean,
    };
  });

  const binnedTrends = {} as Record<keyof WeatherInput, BinnedTrend>;
  for (const f of CORE_FEATURES) {
    binnedTrends[f] = computeBinnedTrend(params.rows, f, 6);
  }

  // Deterministic subsample up to 220 points for clean scatter chart rendering
  const stride = Math.max(1, Math.floor(params.rows.length / 220));
  const scatterSample = params.rows
    .filter((_, idx) => idx % stride === 0)
    .slice(0, 220)
    .map((r) => ({
      humidity: r.humidity,
      pressure: r.pressure,
      temperature: r.temperature,
      cloud_cover: r.cloud_cover,
      rain: r.rain,
    }));

  return {
    hasData: true,
    dataset: params.dataset,
    modelMetrics: params.modelMetrics,
    rainDistribution: {
      rain: rainRows.length,
      noRain: noRainRows.length,
      rainPercentage: Number(((rainRows.length / total) * 100).toFixed(1)),
      noRainPercentage: Number(((noRainRows.length / total) * 100).toFixed(1)),
    },
    parameterComparisons,
    binnedTrends,
    scatterSample,
  };
}
