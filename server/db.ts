import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  DatasetRow,
  DatasetSummary,
  ModelMetrics,
  PredictionHistoryItem,
} from '../src/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'rainfall.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    valid_row_count INTEGER NOT NULL,
    dropped_rows INTEGER NOT NULL,
    missing_imputed_count INTEGER NOT NULL,
    rain_count INTEGER NOT NULL,
    no_rain_count INTEGER NOT NULL,
    columns_json TEXT NOT NULL,
    extra_categorical_json TEXT NOT NULL,
    quality_report_json TEXT NOT NULL,
    preprocessing_steps_json TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dataset_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    temperature REAL NOT NULL,
    humidity REAL NOT NULL,
    pressure REAL NOT NULL,
    wind_speed REAL NOT NULL,
    cloud_cover REAL NOT NULL,
    previous_rainfall REAL NOT NULL,
    rain INTEGER NOT NULL,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS model_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    algorithm TEXT NOT NULL,
    n_estimators INTEGER NOT NULL,
    train_size INTEGER NOT NULL,
    test_size INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    precision_score REAL NOT NULL,
    recall_score REAL NOT NULL,
    f1_score REAL NOT NULL,
    confusion_matrix_json TEXT NOT NULL,
    feature_importances_json TEXT NOT NULL,
    feature_stats_json TEXT NOT NULL,
    model_artifact_json TEXT NOT NULL,
    trained_at TEXT NOT NULL,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_run_id INTEGER NOT NULL,
    temperature REAL NOT NULL,
    humidity REAL NOT NULL,
    pressure REAL NOT NULL,
    wind_speed REAL NOT NULL,
    cloud_cover REAL NOT NULL,
    previous_rainfall REAL NOT NULL,
    predicted_label TEXT NOT NULL,
    rain_probability REAL NOT NULL,
    summary_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (model_run_id) REFERENCES model_runs(id) ON DELETE CASCADE
  );
`);

export function getActiveDataset(): DatasetSummary | null {
  const row = db
    .prepare(
      `SELECT * FROM datasets ORDER BY id DESC LIMIT 1`,
    )
    .get() as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: Number(row.id),
    name: String(row.name),
    filename: String(row.filename),
    rowCount: Number(row.row_count),
    validRowCount: Number(row.valid_row_count),
    droppedRows: Number(row.dropped_rows),
    missingImputedCount: Number(row.missing_imputed_count),
    rainCount: Number(row.rain_count),
    noRainCount: Number(row.no_rain_count),
    columns: JSON.parse(String(row.columns_json)),
    extraCategoricalColumns: JSON.parse(String(row.extra_categorical_json)),
    qualityReport: JSON.parse(String(row.quality_report_json)),
    preprocessingSteps: JSON.parse(String(row.preprocessing_steps_json)),
    uploadedAt: String(row.uploaded_at),
  };
}

export interface StoredModelRun {
  id: number;
  datasetId: number;
  metrics: ModelMetrics;
  featureStats: {
    rainMeans: Record<string, number>;
    noRainMeans: Record<string, number>;
    overallMeans: Record<string, number>;
  };
  modelArtifactJson: string;
}

export function getActiveModelRun(): StoredModelRun | null {
  const activeDataset = getActiveDataset();
  if (!activeDataset) return null;

  const row = db
    .prepare(
      `SELECT * FROM model_runs WHERE dataset_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(activeDataset.id) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: Number(row.id),
    datasetId: Number(row.dataset_id),
    metrics: {
      algorithm: String(row.algorithm),
      nEstimators: Number(row.n_estimators),
      trainSize: Number(row.train_size),
      testSize: Number(row.test_size),
      accuracy: Number(row.accuracy),
      precision: Number(row.precision_score),
      recall: Number(row.recall_score),
      f1Score: Number(row.f1_score),
      confusionMatrix: JSON.parse(String(row.confusion_matrix_json)),
      featureImportances: JSON.parse(String(row.feature_importances_json)),
      trainedAt: String(row.trained_at),
    },
    featureStats: JSON.parse(String(row.feature_stats_json)),
    modelArtifactJson: String(row.model_artifact_json),
  };
}

export function saveDatasetAndModel(params: {
  dataset: Omit<DatasetSummary, 'id'>;
  rows: Array<Omit<DatasetRow, 'id'>>;
  model: {
    algorithm: string;
    nEstimators: number;
    trainSize: number;
    testSize: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    confusionMatrix: ModelMetrics['confusionMatrix'];
    featureImportances: ModelMetrics['featureImportances'];
    featureStats: StoredModelRun['featureStats'];
    modelArtifactJson: string;
    trainedAt: string;
  };
}): { datasetId: number; modelRunId: number } {
  const insertDataset = db.prepare(`
    INSERT INTO datasets (
      name, filename, row_count, valid_row_count, dropped_rows,
      missing_imputed_count, rain_count, no_rain_count,
      columns_json, extra_categorical_json, quality_report_json,
      preprocessing_steps_json, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRow = db.prepare(`
    INSERT INTO dataset_rows (
      dataset_id, temperature, humidity, pressure,
      wind_speed, cloud_cover, previous_rainfall, rain
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertModel = db.prepare(`
    INSERT INTO model_runs (
      dataset_id, algorithm, n_estimators, train_size, test_size,
      accuracy, precision_score, recall_score, f1_score,
      confusion_matrix_json, feature_importances_json,
      feature_stats_json, model_artifact_json, trained_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    const dsResult = insertDataset.run(
      params.dataset.name,
      params.dataset.filename,
      params.dataset.rowCount,
      params.dataset.validRowCount,
      params.dataset.droppedRows,
      params.dataset.missingImputedCount,
      params.dataset.rainCount,
      params.dataset.noRainCount,
      JSON.stringify(params.dataset.columns),
      JSON.stringify(params.dataset.extraCategoricalColumns),
      JSON.stringify(params.dataset.qualityReport),
      JSON.stringify(params.dataset.preprocessingSteps),
      params.dataset.uploadedAt,
    );

    const datasetId = Number(dsResult.lastInsertRowid);

    for (const r of params.rows) {
      insertRow.run(
        datasetId,
        r.temperature,
        r.humidity,
        r.pressure,
        r.wind_speed,
        r.cloud_cover,
        r.previous_rainfall,
        r.rain,
      );
    }

    const modelResult = insertModel.run(
      datasetId,
      params.model.algorithm,
      params.model.nEstimators,
      params.model.trainSize,
      params.model.testSize,
      params.model.accuracy,
      params.model.precision,
      params.model.recall,
      params.model.f1Score,
      JSON.stringify(params.model.confusionMatrix),
      JSON.stringify(params.model.featureImportances),
      JSON.stringify(params.model.featureStats),
      params.model.modelArtifactJson,
      params.model.trainedAt,
    );

    db.exec('COMMIT');
    return {
      datasetId,
      modelRunId: Number(modelResult.lastInsertRowid),
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getDatasetRows(
  datasetId: number,
  limit = 50,
  offset = 0,
): { rows: DatasetRow[]; total: number } {
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS count FROM dataset_rows WHERE dataset_id = ?`)
    .get(datasetId) as { count: number };

  const rows = db
    .prepare(
      `SELECT id, temperature, humidity, pressure, wind_speed, cloud_cover, previous_rainfall, rain
       FROM dataset_rows
       WHERE dataset_id = ?
       ORDER BY id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(datasetId, limit, offset) as Array<Record<string, unknown>>;

  return {
    total: Number(totalRow.count),
    rows: rows.map((r) => ({
      id: Number(r.id),
      temperature: Number(r.temperature),
      humidity: Number(r.humidity),
      pressure: Number(r.pressure),
      wind_speed: Number(r.wind_speed),
      cloud_cover: Number(r.cloud_cover),
      previous_rainfall: Number(r.previous_rainfall),
      rain: Number(r.rain) === 1 ? 1 : 0,
    })),
  };
}

export function getAllDatasetRows(datasetId: number): DatasetRow[] {
  const rows = db
    .prepare(
      `SELECT id, temperature, humidity, pressure, wind_speed, cloud_cover, previous_rainfall, rain
       FROM dataset_rows
       WHERE dataset_id = ?
       ORDER BY id ASC`,
    )
    .all(datasetId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: Number(r.id),
    temperature: Number(r.temperature),
    humidity: Number(r.humidity),
    pressure: Number(r.pressure),
    wind_speed: Number(r.wind_speed),
    cloud_cover: Number(r.cloud_cover),
    previous_rainfall: Number(r.previous_rainfall),
    rain: Number(r.rain) === 1 ? 1 : 0,
  }));
}

export function savePrediction(params: {
  modelRunId: number;
  temperature: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  cloud_cover: number;
  previous_rainfall: number;
  predicted_label: 'Rain' | 'No Rain';
  rain_probability: number;
  summary_text: string;
  created_at: string;
}): number {
  const res = db
    .prepare(
      `INSERT INTO predictions (
        model_run_id, temperature, humidity, pressure,
        wind_speed, cloud_cover, previous_rainfall,
        predicted_label, rain_probability, summary_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.modelRunId,
      params.temperature,
      params.humidity,
      params.pressure,
      params.wind_speed,
      params.cloud_cover,
      params.previous_rainfall,
      params.predicted_label,
      params.rain_probability,
      params.summary_text,
      params.created_at,
    );

  return Number(res.lastInsertRowid);
}

export function getPredictionHistory(): PredictionHistoryItem[] {
  const rows = db
    .prepare(`SELECT * FROM predictions ORDER BY id DESC LIMIT 250`)
    .all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: Number(r.id),
    temperature: Number(r.temperature),
    humidity: Number(r.humidity),
    pressure: Number(r.pressure),
    wind_speed: Number(r.wind_speed),
    cloud_cover: Number(r.cloud_cover),
    previous_rainfall: Number(r.previous_rainfall),
    predicted_label: String(r.predicted_label) === 'Rain' ? 'Rain' : 'No Rain',
    rain_probability: Number(r.rain_probability),
    summary_text: String(r.summary_text),
    created_at: String(r.created_at),
  }));
}

export function getPredictionCount(): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM predictions`)
    .get() as { count: number };
  return Number(row.count);
}

export function clearPredictionHistory(): void {
  db.prepare(`DELETE FROM predictions`).run();
}

export function deletePredictionById(id: number): boolean {
  const res = db.prepare(`DELETE FROM predictions WHERE id = ?`).run(id);
  return res.changes > 0;
}
