import { parse } from 'csv-parse/sync';
import type {
  ColumnQuality,
  DatasetRow,
  WeatherInput,
} from '../../src/types.ts';

export const CORE_FEATURES: Array<keyof WeatherInput> = [
  'temperature',
  'humidity',
  'pressure',
  'wind_speed',
  'cloud_cover',
  'previous_rainfall',
];

export const FEATURE_META: Record<
  keyof WeatherInput,
  { label: string; unit: string; min: number; max: number }
> = {
  temperature: { label: 'Temperature', unit: '°C', min: -50, max: 60 },
  humidity: { label: 'Humidity', unit: '%', min: 0, max: 100 },
  pressure: { label: 'Atmospheric Pressure', unit: 'hPa', min: 850, max: 1100 },
  wind_speed: { label: 'Wind Speed', unit: 'km/h', min: 0, max: 250 },
  cloud_cover: { label: 'Cloud Cover', unit: '%', min: 0, max: 100 },
  previous_rainfall: { label: 'Previous Rainfall', unit: 'mm', min: 0, max: 1000 },
};

const FEATURE_ALIASES: Record<keyof WeatherInput | 'rain', string[]> = {
  temperature: [
    'temperature',
    'temp',
    'temp_c',
    'temperature_c',
    'air_temperature',
    'avg_temp',
  ],
  humidity: [
    'humidity',
    'relative_humidity',
    'rel_humidity',
    'humidity_pct',
    'rh',
  ],
  pressure: [
    'pressure',
    'atmospheric_pressure',
    'air_pressure',
    'pressure_hpa',
    'sea_level_pressure',
    'barometric_pressure',
  ],
  wind_speed: [
    'wind_speed',
    'windspeed',
    'wind',
    'wind_kmh',
    'wind_speed_kmh',
  ],
  cloud_cover: [
    'cloud_cover',
    'cloudcover',
    'clouds',
    'cloud_pct',
    'cloudiness',
  ],
  previous_rainfall: [
    'previous_rainfall',
    'prev_rainfall',
    'prev_rain',
    'rainfall_prev',
    'previous_rain_mm',
    'yesterday_rainfall',
    'prior_rainfall',
  ],
  rain: [
    'rain',
    'rainfall',
    'will_rain',
    'rain_today',
    'rain_tomorrow',
    'target',
    'label',
    'precip_binary',
  ],
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseBinaryTarget(raw: unknown): 0 | 1 | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || s === 'na' || s === 'nan' || s === 'null' || s === 'none') {
    return null;
  }
  if (['1', 'yes', 'true', 'rain', 'y', 't', 'wet'].includes(s)) return 1;
  if (['0', 'no', 'false', 'no rain', 'no_rain', 'n', 'f', 'dry'].includes(s))
    return 0;

  const num = Number(s);
  if (!Number.isNaN(num)) {
    return num > 0 ? 1 : 0;
  }
  return null;
}

function parseNumeric(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || ['na', 'nan', 'null', 'none', '-', 'n/a'].includes(s.toLowerCase())) {
    return null;
  }
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface PreprocessedDataset {
  rawRowCount: number;
  validRowCount: number;
  droppedRows: number;
  missingImputedCount: number;
  rainCount: number;
  noRainCount: number;
  columns: string[];
  extraCategoricalColumns: string[];
  qualityReport: ColumnQuality[];
  preprocessingSteps: string[];
  rows: Array<Omit<DatasetRow, 'id'>>;
  trainRows: Array<Omit<DatasetRow, 'id'>>;
  testRows: Array<Omit<DatasetRow, 'id'>>;
}

export function preprocessMeteorologicalCsv(csvText: string): PreprocessedDataset {
  if (!csvText || !csvText.trim()) {
    throw new Error('The uploaded CSV file is empty.');
  }

  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    throw new Error(
      `Failed to parse CSV syntax: ${err instanceof Error ? err.message : 'Invalid format'}`,
    );
  }

  if (!records || records.length === 0) {
    throw new Error('CSV contains a header row but no data records.');
  }

  const rawHeaders = Object.keys(records[0]);
  const normalizedMap = new Map<string, string>();
  for (const h of rawHeaders) {
    normalizedMap.set(normalizeHeader(h), h);
  }

  const resolvedColumns: Partial<Record<keyof WeatherInput | 'rain', string>> = {};
  const missingColumns: string[] = [];

  (Object.keys(FEATURE_ALIASES) as Array<keyof WeatherInput | 'rain'>).forEach(
    (canonical) => {
      const aliases = FEATURE_ALIASES[canonical];
      let matchedOriginalHeader: string | undefined;
      for (const alias of aliases) {
        if (normalizedMap.has(alias)) {
          matchedOriginalHeader = normalizedMap.get(alias);
          break;
        }
      }
      if (!matchedOriginalHeader) {
        missingColumns.push(canonical);
      } else {
        resolvedColumns[canonical] = matchedOriginalHeader;
      }
    },
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required meteorological columns: ${missingColumns.join(', ')}. Expected columns: temperature, humidity, pressure, wind_speed, cloud_cover, previous_rainfall, and target column rain (0/1 or Yes/No).`,
    );
  }

  // Detect any extra categorical columns present in the CSV for reporting/encoding audit
  const matchedHeadersSet = new Set(Object.values(resolvedColumns));
  const extraCategoricalColumns: string[] = [];
  for (const h of rawHeaders) {
    if (!matchedHeadersSet.has(h)) {
      const sampleVals = records.slice(0, 20).map((r) => r[h]);
      const hasNonNumeric = sampleVals.some(
        (v) => v !== undefined && v !== '' && Number.isNaN(Number(v)),
      );
      if (hasNonNumeric) {
        extraCategoricalColumns.push(h);
      }
    }
  }

  // First pass: parse target & raw numeric features (tracking missing counts)
  const missingCounts: Record<keyof WeatherInput | 'rain', number> = {
    temperature: 0,
    humidity: 0,
    pressure: 0,
    wind_speed: 0,
    cloud_cover: 0,
    previous_rainfall: 0,
    rain: 0,
  };

  interface PartialRow {
    temperature: number | null;
    humidity: number | null;
    pressure: number | null;
    wind_speed: number | null;
    cloud_cover: number | null;
    previous_rainfall: number | null;
    rain: 0 | 1;
  }

  const validPartialRows: PartialRow[] = [];
  let droppedRows = 0;

  for (const rec of records) {
    const target = parseBinaryTarget(rec[resolvedColumns.rain!]);
    if (target === null) {
      missingCounts.rain += 1;
      droppedRows += 1;
      continue;
    }

    const row: PartialRow = {
      temperature: parseNumeric(rec[resolvedColumns.temperature!]),
      humidity: parseNumeric(rec[resolvedColumns.humidity!]),
      pressure: parseNumeric(rec[resolvedColumns.pressure!]),
      wind_speed: parseNumeric(rec[resolvedColumns.wind_speed!]),
      cloud_cover: parseNumeric(rec[resolvedColumns.cloud_cover!]),
      previous_rainfall: parseNumeric(rec[resolvedColumns.previous_rainfall!]),
      rain: target,
    };

    let nullFeatureCount = 0;
    for (const f of CORE_FEATURES) {
      if (row[f] === null) {
        missingCounts[f] += 1;
        nullFeatureCount += 1;
      }
    }

    // Drop rows if more than half of the features are missing
    if (nullFeatureCount > 3) {
      droppedRows += 1;
      continue;
    }

    validPartialRows.push(row);
  }

  if (validPartialRows.length < 25) {
    throw new Error(
      `Dataset requires at least 25 valid labeled weather records for reliable train/test splitting and Random Forest training (found ${validPartialRows.length} valid records).`,
    );
  }

  const rainInitialCount = validPartialRows.filter((r) => r.rain === 1).length;
  const noRainInitialCount = validPartialRows.length - rainInitialCount;
  if (rainInitialCount < 3 || noRainInitialCount < 3) {
    throw new Error(
      `Dataset target column 'rain' must contain both Rain (at least 3 rows, found ${rainInitialCount}) and No Rain (at least 3 rows, found ${noRainInitialCount}) observations.`,
    );
  }

  // Deterministic seeded stratified 80/20 split BEFORE imputation so medians are fit strictly on training data
  const rainIndices: number[] = [];
  const noRainIndices: number[] = [];
  validPartialRows.forEach((r, idx) => {
    if (r.rain === 1) rainIndices.push(idx);
    else noRainIndices.push(idx);
  });

  const seededShuffle = (arr: number[], seedInit: number): number[] => {
    const copy = [...arr];
    let s = seedInit >>> 0;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (1664525 * s + 1013904223) >>> 0;
      const j = s % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffledRain = seededShuffle(rainIndices, 42);
  const shuffledNoRain = seededShuffle(noRainIndices, 1337);

  const rainTrainCount = Math.max(1, Math.floor(shuffledRain.length * 0.8));
  const noRainTrainCount = Math.max(1, Math.floor(shuffledNoRain.length * 0.8));

  const trainIdxSet = new Set<number>([
    ...shuffledRain.slice(0, rainTrainCount),
    ...shuffledNoRain.slice(0, noRainTrainCount),
  ]);

  // Compute training-set medians per feature for missing value imputation
  const trainMedians: Record<keyof WeatherInput, number> = {
    temperature: 20,
    humidity: 60,
    pressure: 1013,
    wind_speed: 12,
    cloud_cover: 40,
    previous_rainfall: 0,
  };

  for (const f of CORE_FEATURES) {
    const trainVals = validPartialRows
      .filter((_, idx) => trainIdxSet.has(idx))
      .map((r) => r[f])
      .filter((v): v is number => v !== null);
    if (trainVals.length > 0) {
      trainMedians[f] = Number(median(trainVals).toFixed(2));
    } else {
      const allVals = validPartialRows
        .map((r) => r[f])
        .filter((v): v is number => v !== null);
      trainMedians[f] = allVals.length > 0 ? Number(median(allVals).toFixed(2)) : 0;
    }
  }

  let missingImputedCount = 0;
  const imputedPerColumn: Record<keyof WeatherInput, number> = {
    temperature: 0,
    humidity: 0,
    pressure: 0,
    wind_speed: 0,
    cloud_cover: 0,
    previous_rainfall: 0,
  };

  const clampFeature = (f: keyof WeatherInput, v: number): number => {
    const { min, max } = FEATURE_META[f];
    return Math.min(max, Math.max(min, Number(v.toFixed(2))));
  };

  const cleanedRows: Array<Omit<DatasetRow, 'id'>> = [];
  const trainRows: Array<Omit<DatasetRow, 'id'>> = [];
  const testRows: Array<Omit<DatasetRow, 'id'>> = [];

  validPartialRows.forEach((raw, idx) => {
    const cleaned: Omit<DatasetRow, 'id'> = {
      temperature: 0,
      humidity: 0,
      pressure: 0,
      wind_speed: 0,
      cloud_cover: 0,
      previous_rainfall: 0,
      rain: raw.rain,
    };

    for (const f of CORE_FEATURES) {
      if (raw[f] === null) {
        cleaned[f] = clampFeature(f, trainMedians[f]);
        imputedPerColumn[f] += 1;
        missingImputedCount += 1;
      } else {
        cleaned[f] = clampFeature(f, raw[f]!);
      }
    }

    cleanedRows.push(cleaned);
    if (trainIdxSet.has(idx)) {
      trainRows.push(cleaned);
    } else {
      testRows.push(cleaned);
    }
  });

  // Quality report per column
  const qualityReport: ColumnQuality[] = CORE_FEATURES.map((f) => {
    const vals = cleanedRows.map((r) => r[f]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((acc, v) => acc + v, 0) / vals.length;
    return {
      column: f,
      missingCount: missingCounts[f],
      imputedCount: imputedPerColumn[f],
      type: 'numeric',
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      mean: Number(mean.toFixed(2)),
      median: trainMedians[f],
    };
  });

  qualityReport.push({
    column: 'rain',
    missingCount: missingCounts.rain,
    imputedCount: 0,
    type: 'target',
  });

  const preprocessingSteps: string[] = [
    `Normalized ${rawHeaders.length} source CSV headers and mapped meteorological parameters.`,
    `Encoded binary target variable ('rain') into 0 (No Rain: ${noRainInitialCount}) and 1 (Rain: ${rainInitialCount}).`,
    `Performed stratified 80/20 split (${trainRows.length} training / ${testRows.length} testing rows) prior to imputation.`,
    missingImputedCount > 0
      ? `Imputed ${missingImputedCount} missing feature values using training-split column medians.`
      : 'Verified zero missing values across retained numeric weather features.',
    droppedRows > 0
      ? `Dropped ${droppedRows} incomplete row(s) missing target labels or majority feature readings.`
      : 'Retained 100% of uploaded rows after schema and range validation.',
  ];

  if (extraCategoricalColumns.length > 0) {
    preprocessingSteps.push(
      `Detected auxiliary categorical column(s) (${extraCategoricalColumns.join(', ')}); core 6 continuous predictors standardized for prediction schema alignment.`,
    );
  }

  return {
    rawRowCount: records.length,
    validRowCount: cleanedRows.length,
    droppedRows,
    missingImputedCount,
    rainCount: rainInitialCount,
    noRainCount: noRainInitialCount,
    columns: [
      'temperature',
      'humidity',
      'pressure',
      'wind_speed',
      'cloud_cover',
      'previous_rainfall',
      'rain',
    ],
    extraCategoricalColumns,
    qualityReport,
    preprocessingSteps,
    rows: cleanedRows,
    trainRows,
    testRows,
  };
}
