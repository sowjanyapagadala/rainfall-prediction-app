import type {
  ConfusionMatrix,
  DatasetRow,
  FeatureContribution,
  FeatureImportanceItem,
  ModelMetrics,
  WeatherInput,
} from '../../src/types.ts';
import { CORE_FEATURES, FEATURE_META } from './preprocessing.ts';

interface TreeNode {
  isLeaf: boolean;
  prediction?: 0 | 1;
  probabilityRain?: number;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  impurityDecrease?: number;
  samples: number;
}

export interface SerializedForestModel {
  nEstimators: number;
  maxDepth: number;
  minSamplesSplit: number;
  features: Array<keyof WeatherInput>;
  trees: TreeNode[];
  featureImportances: number[];
}

class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

function giniImpurity(posCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  const p1 = posCount / totalCount;
  const p0 = 1 - p1;
  return 1 - (p1 * p1 + p0 * p0);
}

function toFeatureVector(row: Pick<DatasetRow, keyof WeatherInput>): number[] {
  return [
    row.temperature,
    row.humidity,
    row.pressure,
    row.wind_speed,
    row.cloud_cover,
    row.previous_rainfall,
  ];
}

function buildCartTree(
  X: number[][],
  y: Array<0 | 1>,
  indices: number[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  maxFeatures: number,
  rng: SeededRng,
  importanceAccum: number[],
): TreeNode {
  const n = indices.length;
  let posCount = 0;
  for (const idx of indices) {
    if (y[idx] === 1) posCount += 1;
  }

  const probRain = n > 0 ? posCount / n : 0;
  const nodeGini = giniImpurity(posCount, n);

  if (
    depth >= maxDepth ||
    n < minSamplesSplit ||
    posCount === 0 ||
    posCount === n
  ) {
    return {
      isLeaf: true,
      prediction: probRain >= 0.5 ? 1 : 0,
      probabilityRain: probRain,
      samples: n,
    };
  }

  const numFeatures = X[0].length;
  // Fisher-Yates partial shuffle for random feature subset (sqrt(m))
  const featurePool = Array.from({ length: numFeatures }, (_, i) => i);
  for (let i = featurePool.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [featurePool[i], featurePool[j]] = [featurePool[j], featurePool[i]];
  }
  const candidateFeatures = featurePool.slice(0, maxFeatures);

  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeftIndices: number[] = [];
  let bestRightIndices: number[] = [];

  for (const fIdx of candidateFeatures) {
    // Sort indices by feature value for O(n log n) exact threshold scan
    const sorted = [...indices].sort((a, b) => X[a][fIdx] - X[b][fIdx]);

    let leftPos = 0;
    let leftCount = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
      const idx = sorted[i];
      const nextIdx = sorted[i + 1];
      leftCount += 1;
      if (y[idx] === 1) leftPos += 1;

      const val = X[idx][fIdx];
      const nextVal = X[nextIdx][fIdx];
      if (val === nextVal) continue;

      const rightCount = n - leftCount;
      if (leftCount < 1 || rightCount < 1) continue;

      const rightPos = posCount - leftPos;
      const weightedGini =
        (leftCount / n) * giniImpurity(leftPos, leftCount) +
        (rightCount / n) * giniImpurity(rightPos, rightCount);

      const gain = nodeGini - weightedGini;
      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = fIdx;
        bestThreshold = (val + nextVal) / 2;
      }
    }
  }

  if (bestFeature === -1 || bestGain <= 1e-7) {
    return {
      isLeaf: true,
      prediction: probRain >= 0.5 ? 1 : 0,
      probabilityRain: probRain,
      samples: n,
    };
  }

  bestLeftIndices = [];
  bestRightIndices = [];
  for (const idx of indices) {
    if (X[idx][bestFeature] <= bestThreshold) {
      bestLeftIndices.push(idx);
    } else {
      bestRightIndices.push(idx);
    }
  }

  if (bestLeftIndices.length === 0 || bestRightIndices.length === 0) {
    return {
      isLeaf: true,
      prediction: probRain >= 0.5 ? 1 : 0,
      probabilityRain: probRain,
      samples: n,
    };
  }

  importanceAccum[bestFeature] += n * bestGain;

  return {
    isLeaf: false,
    featureIndex: bestFeature,
    threshold: Number(bestThreshold.toFixed(4)),
    samples: n,
    impurityDecrease: Number((n * bestGain).toFixed(4)),
    left: buildCartTree(
      X,
      y,
      bestLeftIndices,
      depth + 1,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng,
      importanceAccum,
    ),
    right: buildCartTree(
      X,
      y,
      bestRightIndices,
      depth + 1,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng,
      importanceAccum,
    ),
  };
}

function predictTree(node: TreeNode, vec: number[]): { label: 0 | 1; prob: number } {
  let curr: TreeNode = node;
  while (!curr.isLeaf && curr.featureIndex !== undefined && curr.threshold !== undefined) {
    if (vec[curr.featureIndex] <= curr.threshold) {
      curr = curr.left!;
    } else {
      curr = curr.right!;
    }
  }
  return {
    label: curr.prediction ?? 0,
    prob: curr.probabilityRain ?? 0,
  };
}

export function trainAndEvaluateRandomForest(params: {
  trainRows: Array<Omit<DatasetRow, 'id'>>;
  testRows: Array<Omit<DatasetRow, 'id'>>;
  allRows: Array<Omit<DatasetRow, 'id'>>;
  nEstimators?: number;
}): {
  model: SerializedForestModel;
  metrics: ModelMetrics;
  featureStats: {
    rainMeans: Record<string, number>;
    noRainMeans: Record<string, number>;
    overallMeans: Record<string, number>;
  };
} {
  const nEstimators = params.nEstimators ?? 35;
  const maxDepth = 7;
  const minSamplesSplit = 4;
  const maxFeatures = Math.max(2, Math.round(Math.sqrt(CORE_FEATURES.length)));

  const XTrain = params.trainRows.map(toFeatureVector);
  const yTrain = params.trainRows.map((r) => r.rain);
  const XTest = params.testRows.map(toFeatureVector);
  const yTest = params.testRows.map((r) => r.rain);

  const rng = new SeededRng(20261122);
  const trees: TreeNode[] = [];
  const importanceAccum = new Array(CORE_FEATURES.length).fill(0);

  for (let t = 0; t < nEstimators; t++) {
    const bootstrapIndices: number[] = [];
    for (let i = 0; i < XTrain.length; i++) {
      bootstrapIndices.push(rng.nextInt(XTrain.length));
    }
    const tree = buildCartTree(
      XTrain,
      yTrain,
      bootstrapIndices,
      0,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng,
      importanceAccum,
    );
    trees.push(tree);
  }

  const totalImp = importanceAccum.reduce((sum, v) => sum + v, 0);
  const normalizedImportances = importanceAccum.map((v) =>
    totalImp > 0 ? Number((v / totalImp).toFixed(4)) : Number((1 / CORE_FEATURES.length).toFixed(4)),
  );

  // Evaluate on held-out test set
  let tn = 0;
  let fp = 0;
  let fn = 0;
  let tp = 0;

  for (let i = 0; i < XTest.length; i++) {
    let probSum = 0;
    for (const tree of trees) {
      probSum += predictTree(tree, XTest[i]).prob;
    }
    const avgProb = probSum / trees.length;
    const pred: 0 | 1 = avgProb >= 0.5 ? 1 : 0;
    const actual = yTest[i];

    if (actual === 0 && pred === 0) tn += 1;
    else if (actual === 0 && pred === 1) fp += 1;
    else if (actual === 1 && pred === 0) fn += 1;
    else if (actual === 1 && pred === 1) tp += 1;
  }

  const totalTest = tn + fp + fn + tp;
  const accuracy = totalTest > 0 ? (tp + tn) / totalTest : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const confusionMatrix: ConfusionMatrix = { tn, fp, fn, tp };

  const featureImportances: FeatureImportanceItem[] = CORE_FEATURES.map(
    (feature, idx) => ({
      feature,
      label: FEATURE_META[feature].label,
      importance: normalizedImportances[idx],
    }),
  ).sort((a, b) => b.importance - a.importance);

  // Compute class-wise meteorological means from training rows for authentic explanations
  const rainTrain = params.trainRows.filter((r) => r.rain === 1);
  const noRainTrain = params.trainRows.filter((r) => r.rain === 0);

  const rainMeans: Record<string, number> = {};
  const noRainMeans: Record<string, number> = {};
  const overallMeans: Record<string, number> = {};

  for (const f of CORE_FEATURES) {
    rainMeans[f] = rainTrain.length
      ? Number(
          (rainTrain.reduce((s, r) => s + r[f], 0) / rainTrain.length).toFixed(2),
        )
      : 0;
    noRainMeans[f] = noRainTrain.length
      ? Number(
          (noRainTrain.reduce((s, r) => s + r[f], 0) / noRainTrain.length).toFixed(2),
        )
      : 0;
    overallMeans[f] = Number(
      (params.allRows.reduce((s, r) => s + r[f], 0) / params.allRows.length).toFixed(2),
    );
  }

  const trainedAt = new Date().toISOString();

  return {
    model: {
      nEstimators,
      maxDepth,
      minSamplesSplit,
      features: CORE_FEATURES,
      trees,
      featureImportances: normalizedImportances,
    },
    metrics: {
      algorithm: 'Random Forest Classifier (CART Ensemble)',
      nEstimators,
      trainSize: params.trainRows.length,
      testSize: params.testRows.length,
      accuracy: Number(accuracy.toFixed(4)),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1Score: Number(f1Score.toFixed(4)),
      confusionMatrix,
      featureImportances,
      trainedAt,
    },
    featureStats: {
      rainMeans,
      noRainMeans,
      overallMeans,
    },
  };
}

export function predictWithRandomForest(params: {
  model: SerializedForestModel;
  input: WeatherInput;
  featureStats: {
    rainMeans: Record<string, number>;
    noRainMeans: Record<string, number>;
  };
}): {
  prediction: 'Rain' | 'No Rain';
  rainProbability: number;
  noRainProbability: number;
  treesVotingRain: number;
  totalTrees: number;
  summaryText: string;
  contributions: FeatureContribution[];
} {
  const vec = toFeatureVector(params.input);
  let probSum = 0;
  let treesVotingRain = 0;

  for (const tree of params.model.trees) {
    const res = predictTree(tree, vec);
    probSum += res.prob;
    if (res.label === 1) {
      treesVotingRain += 1;
    }
  }

  const totalTrees = params.model.trees.length;
  const rainProbability = Number((probSum / totalTrees).toFixed(4));
  const noRainProbability = Number((1 - rainProbability).toFixed(4));
  const prediction: 'Rain' | 'No Rain' = rainProbability >= 0.5 ? 'Rain' : 'No Rain';

  // Generate factor-by-factor analytical comparison grounded in actual trained model stats
  const contributions: FeatureContribution[] = CORE_FEATURES.map((f, idx) => {
    const val = params.input[f];
    const rainMean = params.featureStats.rainMeans[f] ?? val;
    const noRainMean = params.featureStats.noRainMeans[f] ?? val;
    const importance = params.model.featureImportances[idx] ?? 0;

    const distToRain = Math.abs(val - rainMean);
    const distToClear = Math.abs(val - noRainMean);
    const gap = Math.abs(rainMean - noRainMean);

    let direction: FeatureContribution['direction'] = 'neutral';
    if (gap > 0.01) {
      if (distToRain < distToClear * 0.9) direction = 'supports_rain';
      else if (distToClear < distToRain * 0.9) direction = 'supports_clear';
    }

    const meta = FEATURE_META[f];
    let summary = `${meta.label} (${val} ${meta.unit}) sits between historical Rain (${rainMean} ${meta.unit}) and Clear (${noRainMean} ${meta.unit}) averages.`;
    if (direction === 'supports_rain') {
      summary = `${meta.label} (${val} ${meta.unit}) aligns closer to historical Rain days (avg ${rainMean} ${meta.unit}) than Clear days (avg ${noRainMean} ${meta.unit}).`;
    } else if (direction === 'supports_clear') {
      summary = `${meta.label} (${val} ${meta.unit}) aligns closer to historical No Rain days (avg ${noRainMean} ${meta.unit}) than Rain days (avg ${rainMean} ${meta.unit}).`;
    }

    return {
      feature: f,
      label: meta.label,
      unit: meta.unit,
      value: val,
      rainMean,
      noRainMean,
      importance,
      direction,
      summary,
    };
  }).sort((a, b) => b.importance - a.importance);

  const topRainDrivers = contributions
    .filter((c) => c.direction === 'supports_rain')
    .slice(0, 2)
    .map((c) => `${c.label.toLowerCase()} (${c.value}${c.unit})`);

  const topClearDrivers = contributions
    .filter((c) => c.direction === 'supports_clear')
    .slice(0, 2)
    .map((c) => `${c.label.toLowerCase()} (${c.value}${c.unit})`);

  const pct = (rainProbability * 100).toFixed(1);
  let summaryText = '';
  if (prediction === 'Rain') {
    const drivers =
      topRainDrivers.length > 0
        ? `Primary rainfall indicators include ${topRainDrivers.join(' and ')}.`
        : 'Combined ensemble thresholds across atmospheric predictors favor precipitation.';
    summaryText = `The Random Forest ensemble (${treesVotingRain} of ${totalTrees} decision trees voting Rain) estimates a ${pct}% probability of rainfall. ${drivers}`;
  } else {
    const drivers =
      topClearDrivers.length > 0
        ? `Key stabilizing parameters include ${topClearDrivers.join(' and ')}.`
        : 'Combined atmospheric readings remain within historical dry-weather bounds.';
    summaryText = `The Random Forest ensemble (${totalTrees - treesVotingRain} of ${totalTrees} decision trees voting No Rain) indicates dry conditions with a ${pct}% rainfall probability. ${drivers}`;
  }

  return {
    prediction,
    rainProbability,
    noRainProbability,
    treesVotingRain,
    totalTrees,
    summaryText,
    contributions,
  };
}
