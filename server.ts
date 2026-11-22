import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import type { WeatherInput } from './src/types.ts';
import {
  clearPredictionHistory,
  deletePredictionById,
  getActiveDataset,
  getActiveModelRun,
  getAllDatasetRows,
  getDatasetRows,
  getPredictionCount,
  getPredictionHistory,
  saveDatasetAndModel,
  savePrediction,
} from './server/db.ts';
import { buildAnalyticsPayload } from './server/analytics.ts';
import {
  CORE_FEATURES,
  FEATURE_META,
  preprocessMeteorologicalCsv,
} from './server/ml/preprocessing.ts';
import {
  predictWithRandomForest,
  trainAndEvaluateRandomForest,
  type SerializedForestModel,
} from './server/ml/randomForest.ts';

const PORT = 3000;
const SAMPLE_CSV_PATH = path.resolve(
  process.cwd(),
  'data',
  'sample_meteorological_data.csv',
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only .csv files are supported for dataset upload.'));
    }
  },
});

function validateWeatherInput(body: unknown): { ok: true; input: WeatherInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object with weather parameters.' };
  }

  const record = body as Record<string, unknown>;
  const parsed: Partial<WeatherInput> = {};

  for (const field of CORE_FEATURES) {
    const raw = record[field];
    if (raw === undefined || raw === null || raw === '') {
      return {
        ok: false,
        error: `${FEATURE_META[field].label} (${FEATURE_META[field].unit}) is required.`,
      };
    }

    const num = Number(raw);
    if (!Number.isFinite(num)) {
      return {
        ok: false,
        error: `${FEATURE_META[field].label} must be a valid numeric value.`,
      };
    }

    const { min, max, label, unit } = FEATURE_META[field];
    if (num < min || num > max) {
      return {
        ok: false,
        error: `${label} must be between ${min} and ${max} ${unit}.`,
      };
    }

    parsed[field] = Number(num.toFixed(2));
  }

  return { ok: true, input: parsed as WeatherInput };
}

function trainFromCsvText(csvText: string, filename: string, displayName: string) {
  const prep = preprocessMeteorologicalCsv(csvText);
  const { model, metrics, featureStats } = trainAndEvaluateRandomForest({
    trainRows: prep.trainRows,
    testRows: prep.testRows,
    allRows: prep.rows,
    nEstimators: 35,
  });

  const uploadedAt = new Date().toISOString();
  const { datasetId } = saveDatasetAndModel({
    dataset: {
      name: displayName,
      filename,
      rowCount: prep.rawRowCount,
      validRowCount: prep.validRowCount,
      droppedRows: prep.droppedRows,
      missingImputedCount: prep.missingImputedCount,
      rainCount: prep.rainCount,
      noRainCount: prep.noRainCount,
      columns: prep.columns,
      extraCategoricalColumns: prep.extraCategoricalColumns,
      qualityReport: prep.qualityReport,
      preprocessingSteps: prep.preprocessingSteps,
      uploadedAt,
    },
    rows: prep.rows,
    model: {
      algorithm: metrics.algorithm,
      nEstimators: metrics.nEstimators,
      trainSize: metrics.trainSize,
      testSize: metrics.testSize,
      accuracy: metrics.accuracy,
      precision: metrics.precision,
      recall: metrics.recall,
      f1Score: metrics.f1Score,
      confusionMatrix: metrics.confusionMatrix,
      featureImportances: metrics.featureImportances,
      featureStats,
      modelArtifactJson: JSON.stringify(model),
      trainedAt: metrics.trainedAt,
    },
  });

  const dataset = getActiveDataset();
  const preview = getDatasetRows(datasetId, 50, 0);

  return {
    dataset,
    modelMetrics: metrics,
    previewRows: preview.rows,
    totalRows: preview.total,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      runtime: 'Node.js Express + SQLite + TypeScript Random Forest',
    });
  });

  app.get('/api/status', (_req, res) => {
    const dataset = getActiveDataset();
    const activeModel = getActiveModelRun();
    const predictionCount = getPredictionCount();

    res.json({
      runtime: 'Node.js Express + SQLite + TypeScript Random Forest',
      datasetLoaded: Boolean(dataset),
      modelTrained: Boolean(activeModel),
      dataset,
      modelMetrics: activeModel ? activeModel.metrics : null,
      predictionCount,
    });
  });

  app.get('/api/dataset/sample-csv', (_req, res) => {
    if (!fs.existsSync(SAMPLE_CSV_PATH)) {
      res.status(404).json({ error: 'Sample meteorological CSV file not found.' });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="sample_meteorological_data.csv"',
    );
    res.sendFile(SAMPLE_CSV_PATH);
  });

  app.post('/api/dataset/load-sample', (_req, res) => {
    try {
      if (!fs.existsSync(SAMPLE_CSV_PATH)) {
        res.status(404).json({ error: 'Sample meteorological CSV file not found.' });
        return;
      }
      const csvText = fs.readFileSync(SAMPLE_CSV_PATH, 'utf-8');
      const result = trainFromCsvText(
        csvText,
        'sample_meteorological_data.csv',
        'Historical Coastal Meteorology (365-Day Record)',
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to load sample dataset.',
      });
    }
  });

  app.post('/api/dataset/upload', (req, res) => {
    upload.single('file')(req, res, (uploadErr) => {
      if (uploadErr) {
        res.status(400).json({
          error: uploadErr instanceof Error ? uploadErr.message : 'File upload failed.',
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: 'No CSV file was attached. Please choose a valid .csv file.',
        });
        return;
      }

      try {
        const csvText = req.file.buffer.toString('utf-8');
        const safeBaseName = path.basename(req.file.originalname, '.csv').slice(0, 80) || 'Uploaded Dataset';
        const result = trainFromCsvText(csvText, req.file.originalname, safeBaseName);
        res.json(result);
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Dataset validation or training failed.',
        });
      }
    });
  });

  app.get('/api/dataset', (req, res) => {
    const dataset = getActiveDataset();
    if (!dataset) {
      res.json({
        dataset: null,
        rows: [],
        total: 0,
      });
      return;
    }

    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const { rows, total } = getDatasetRows(dataset.id, limit, offset);

    res.json({
      dataset,
      rows,
      total,
    });
  });

  app.post('/api/predict', (req, res) => {
    const activeModel = getActiveModelRun();
    if (!activeModel) {
      res.status(400).json({
        error:
          'No trained model is available yet. Please upload a meteorological CSV dataset (or load the sample dataset) on the Dataset Upload page first.',
      });
      return;
    }

    const validation = validateWeatherInput(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const forest = JSON.parse(activeModel.modelArtifactJson) as SerializedForestModel;
      const prediction = predictWithRandomForest({
        model: forest,
        input: validation.input,
        featureStats: activeModel.featureStats,
      });

      const createdAt = new Date().toISOString();
      const id = savePrediction({
        modelRunId: activeModel.id,
        temperature: validation.input.temperature,
        humidity: validation.input.humidity,
        pressure: validation.input.pressure,
        wind_speed: validation.input.wind_speed,
        cloud_cover: validation.input.cloud_cover,
        previous_rainfall: validation.input.previous_rainfall,
        predicted_label: prediction.prediction,
        rain_probability: prediction.rainProbability,
        summary_text: prediction.summaryText,
        created_at: createdAt,
      });

      res.json({
        id,
        input: validation.input,
        ...prediction,
        createdAt,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Prediction execution failed.',
      });
    }
  });

  app.get('/api/analytics', (_req, res) => {
    const dataset = getActiveDataset();
    const activeModel = getActiveModelRun();
    const rows = dataset ? getAllDatasetRows(dataset.id) : [];

    const payload = buildAnalyticsPayload({
      dataset,
      modelMetrics: activeModel ? activeModel.metrics : null,
      rows,
    });

    res.json(payload);
  });

  app.get('/api/history', (_req, res) => {
    const items = getPredictionHistory();
    res.json({ items });
  });

  app.delete('/api/history', (_req, res) => {
    clearPredictionHistory();
    res.json({ ok: true });
  });

  app.delete('/api/history/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid prediction record ID.' });
      return;
    }
    const deleted = deletePredictionById(id);
    if (!deleted) {
      res.status(404).json({ error: 'Prediction record not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // Mount Vite middleware in development, or serve static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rainfall Prediction System server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
