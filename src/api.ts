import type {
  AnalyticsResponse,
  DatasetRow,
  DatasetSummary,
  ModelMetrics,
  PredictionHistoryItem,
  PredictionResult,
  SystemStatus,
  WeatherInput,
} from './types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export function fetchSystemStatus(): Promise<SystemStatus> {
  return requestJson<SystemStatus>('/api/status');
}

export function fetchDatasetPreview(
  limit = 50,
  offset = 0,
): Promise<{ dataset: DatasetSummary | null; rows: DatasetRow[]; total: number }> {
  return requestJson(`/api/dataset?limit=${limit}&offset=${offset}`);
}

export function uploadDatasetCsv(file: File): Promise<{
  dataset: DatasetSummary;
  modelMetrics: ModelMetrics;
  previewRows: DatasetRow[];
  totalRows: number;
}> {
  const formData = new FormData();
  formData.append('file', file);
  return requestJson('/api/dataset/upload', {
    method: 'POST',
    body: formData,
  });
}

export function loadSampleDataset(): Promise<{
  dataset: DatasetSummary;
  modelMetrics: ModelMetrics;
  previewRows: DatasetRow[];
  totalRows: number;
}> {
  return requestJson('/api/dataset/load-sample', {
    method: 'POST',
  });
}

export function submitPrediction(input: WeatherInput): Promise<PredictionResult> {
  return requestJson<PredictionResult>('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchAnalytics(): Promise<AnalyticsResponse> {
  return requestJson<AnalyticsResponse>('/api/analytics');
}

export function fetchPredictionHistory(): Promise<{ items: PredictionHistoryItem[] }> {
  return requestJson<{ items: PredictionHistoryItem[] }>('/api/history');
}

export function clearAllPredictionHistory(): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>('/api/history', {
    method: 'DELETE',
  });
}

export function deletePredictionRecord(id: number): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(`/api/history/${id}`, {
    method: 'DELETE',
  });
}
