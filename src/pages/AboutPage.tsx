import { CloudRain, Cpu, Database, Layers, Server } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          About the Rainfall Prediction System
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Project architecture, machine learning methodology, applications, and
          local execution reference.
        </p>
      </div>

      {/* Problem Statement & Proposed System */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2.5">
            <CloudRain className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Problem Statement
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Short-term rainfall forecasting relies on non-linear interactions
            across temperature, relative humidity, barometric pressure, wind
            velocity, cloud cover, and prior precipitation. Traditional
            rule-of-thumb thresholds struggle when atmospheric variables shift
            simultaneously across seasons. Accurate, accessible classification of
            rain events supports agriculture irrigation planning, urban flood
            mitigation, and transport scheduling.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Proposed System
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            This full-stack web application pairs an interactive React and
            Chart.js dashboard with an automated preprocessing and Random Forest
            training pipeline backed by SQLite persistence. Users upload
            historical weather CSV files, inspect data quality and missing-value
            imputation, evaluate out-of-sample classification metrics, and run
            live weather predictions with probability scores and factor-level
            explanations.
          </p>
        </section>
      </div>

      {/* Machine Learning Methodology */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
          <Cpu className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Machine Learning Methodology
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="font-mono text-xs font-semibold text-blue-700">
              01. Data Cleaning
            </div>
            <h3 className="mt-1 font-display text-sm font-semibold text-slate-900">
              Schema & Missing Values
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Normalizes CSV column headers, validates physical meteorological
              ranges, encodes binary Rain targets (Yes/No, 1/0), and imputes
              missing numeric readings using training-split medians.
            </p>
          </div>

          <div>
            <div className="font-mono text-xs font-semibold text-blue-700">
              02. Stratified Split
            </div>
            <h3 className="mt-1 font-display text-sm font-semibold text-slate-900">
              80% Train / 20% Test
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Preserves the historical Rain-to-No-Rain class ratio across
              training and evaluation splits before fitting medians or trees to
              prevent data leakage.
            </p>
          </div>

          <div>
            <div className="font-mono text-xs font-semibold text-blue-700">
              03. Random Forest
            </div>
            <h3 className="mt-1 font-display text-sm font-semibold text-slate-900">
              CART Tree Ensemble
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Trains an ensemble of bootstrap-sampled CART decision trees using
              Gini impurity and random feature subsampling at each split,
              averaging tree votes to output calibrated rainfall probabilities.
            </p>
          </div>

          <div>
            <div className="font-mono text-xs font-semibold text-blue-700">
              04. Model Evaluation
            </div>
            <h3 className="mt-1 font-display text-sm font-semibold text-slate-900">
              Held-Out Metrics
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Computes true Accuracy, Precision, Recall, F1-Score, feature
              importances, and a 2×2 Confusion Matrix strictly from the unseen
              20% test partition.
            </p>
          </div>
        </div>
      </section>

      {/* Advantages, Limitations, Applications */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Advantages
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              Captures non-linear interactions (e.g. falling pressure combined
              with rising humidity and cloud cover).
            </li>
            <li>
              Resistant to overfitting compared to a single decision tree via
              bootstrap aggregation.
            </li>
            <li>
              Requires no feature scaling and provides interpretable Gini
              feature importance weights.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Limitations
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              Forecast accuracy depends directly on the quality, regional
              relevance, and size of the uploaded CSV dataset.
            </li>
            <li>
              Outputs binary Rain / No Rain classification rather than
              continuous millimeter precipitation volume.
            </li>
            <li>
              Does not ingest live satellite radar imagery or multi-day spatial
              atmospheric grids.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Real-World Applications
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              Precision agriculture irrigation scheduling and fertilizer timing.
            </li>
            <li>
              Urban stormwater drainage preparedness and localized flood alerts.
            </li>
            <li>
              Outdoor logistics, construction planning, and aviation ground
              operations.
            </li>
          </ul>
        </section>
      </div>

      {/* Runtime Transparency & Python Flask Reference */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
          <Server className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Runtime Architecture & Local Python Flask Reference
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Database className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>Active Cloud Preview Runtime</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              This container provides Node.js v22 without Python{' '}
              <span className="font-mono text-xs">pip</span>,{' '}
              <span className="font-mono text-xs">flask</span>, or{' '}
              <span className="font-mono text-xs">scikit-learn</span>. Rather
              than simulating results, the live application runs a real{' '}
              <strong>Express + TypeScript Random Forest Classifier</strong> and{' '}
              <strong>SQLite</strong> (<span className="font-mono text-xs">node:sqlite</span>)
              backend on port 3000 with genuine CSV cleaning, 80/20 splitting,
              and out-of-sample evaluation.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">
              Included Python Flask + Scikit-learn Source
            </div>
            <p className="mt-2 text-sm text-slate-600">
              For local academic submission using Python Flask, Pandas, NumPy,
              Scikit-learn, and SQLite, use the included{' '}
              <span className="font-mono text-xs">python_backend/</span>{' '}
              directory:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3.5 font-mono text-xs text-slate-100">
              {`cd python_backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
