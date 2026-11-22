export type PageId =
  | 'home'
  | 'predict'
  | 'dataset'
  | 'analytics'
  | 'history'
  | 'about';

export interface WeatherInput {
  temperature: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  cloud_cover: number;
  previous_rainfall: number;
}

export interface FeatureImportanceItem {
  feature: string;
  label: string;
  importance: number;
}

export interface ConfusionMatrix {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
}

export interface ModelMetrics {
  algorithm: string;
  nEstimators: number;
  trainSize: number;
  testSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: ConfusionMatrix;
  featureImportances: FeatureImportanceItem[];
  trainedAt: string;
}

export interface ColumnQuality {
  column: string;
  missingCount: number;
  imputedCount: number;
  type: 'numeric' | 'categorical' | 'target';
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
}

export interface DatasetSummary {
  id: number;
  name: string;
  filename: string;
  rowCount: number;
  validRowCount: number;
  droppedRows: number;
  missingImputedCount: number;
  rainCount: number;
  noRainCount: number;
  columns: string[];
  extraCategoricalColumns: string[];
  qualityReport: ColumnQuality[];
  preprocessingSteps: string[];
  uploadedAt: string;
}

export interface DatasetRow {
  id: number;
  temperature: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  cloud_cover: number;
  previous_rainfall: number;
  rain: 0 | 1;
}

export interface SystemStatus {
  runtime: string;
  datasetLoaded: boolean;
  modelTrained: boolean;
  dataset: DatasetSummary | null;
  modelMetrics: ModelMetrics | null;
  predictionCount: number;
}

export interface FeatureContribution {
  feature: keyof WeatherInput;
  label: string;
  unit: string;
  value: number;
  rainMean: number;
  noRainMean: number;
  importance: number;
  direction: 'supports_rain' | 'supports_clear' | 'neutral';
  summary: string;
}

export interface PredictionResult {
  id: number;
  input: WeatherInput;
  prediction: 'Rain' | 'No Rain';
  rainProbability: number;
  noRainProbability: number;
  treesVotingRain: number;
  totalTrees: number;
  summaryText: string;
  contributions: FeatureContribution[];
  createdAt: string;
}

export interface PredictionHistoryItem {
  id: number;
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
}

export interface ParameterComparison {
  feature: keyof WeatherInput;
  label: string;
  unit: string;
  rainMean: number;
  noRainMean: number;
  overallMean: number;
}

export interface BinnedTrend {
  feature: keyof WeatherInput;
  label: string;
  unit: string;
  bins: Array<{
    rangeLabel: string;
    totalCount: number;
    rainCount: number;
    noRainCount: number;
    rainRate: number;
  }>;
}

export interface AnalyticsResponse {
  hasData: boolean;
  dataset: DatasetSummary | null;
  modelMetrics: ModelMetrics | null;
  rainDistribution: {
    rain: number;
    noRain: number;
    rainPercentage: number;
    noRainPercentage: number;
  };
  parameterComparisons: ParameterComparison[];
  binnedTrends: Record<keyof WeatherInput, BinnedTrend>;
  scatterSample: Array<{
    humidity: number;
    pressure: number;
    temperature: number;
    cloud_cover: number;
    rain: 0 | 1;
  }>;
}
