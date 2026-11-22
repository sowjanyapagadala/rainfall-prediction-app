import json
import os
import sqlite3
from datetime import datetime, timezone
from io import StringIO

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), "rainfall_python.db")
CORE_FEATURES = [
    "temperature",
    "humidity",
    "pressure",
    "wind_speed",
    "cloud_cover",
    "previous_rainfall",
]

# In-memory active trained model state (loaded/retrained on dataset upload)
MODEL_STATE = {
    "model": None,
    "metrics": None,
    "dataset": None,
    "feature_stats": None,
}


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                temperature REAL NOT NULL,
                humidity REAL NOT NULL,
                pressure REAL NOT NULL,
                wind_speed REAL NOT NULL,
                cloud_cover REAL NOT NULL,
                previous_rainfall REAL NOT NULL,
                predicted_label TEXT NOT NULL,
                rain_probability REAL NOT NULL,
                summary_text TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def encode_target(series: pd.Series) -> pd.Series:
    mapping = {"yes": 1, "true": 1, "1": 1, "rain": 1, "no": 0, "false": 0, "0": 0, "no rain": 0}
    def parse_val(v):
        if pd.isna(v):
            return np.nan
        s = str(v).strip().lower()
        if s in mapping:
            return mapping[s]
        try:
            return 1 if float(s) > 0 else 0
        except ValueError:
            return np.nan
    return series.apply(parse_val)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "runtime": "Python Flask + Scikit-learn + Pandas + SQLite"})


@app.route("/api/dataset/upload", methods=["POST"])
def upload_dataset():
    if "file" not in request.files:
        return jsonify({"error": "No CSV file uploaded."}), 400

    file = request.files["file"]
    content = file.read().decode("utf-8-sig")
    df = pd.read_csv(StringIO(content))
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing_cols = [c for c in CORE_FEATURES + ["rain"] if c not in df.columns]
    if missing_cols:
        return jsonify({"error": f"Missing required columns: {', '.join(missing_cols)}"}), 400

    df["rain"] = encode_target(df["rain"])
    df = df.dropna(subset=["rain"]).copy()
    df["rain"] = df["rain"].astype(int)

    for col in CORE_FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    X = df[CORE_FEATURES]
    y = df["rain"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Fit medians strictly on training split to prevent data leakage
    train_medians = X_train.median()
    X_train = X_train.fillna(train_medians)
    X_test = X_test.fillna(train_medians)

    clf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred, labels=[0, 1]).ravel()

    metrics = {
        "algorithm": "Scikit-learn RandomForestClassifier",
        "nEstimators": 100,
        "trainSize": int(len(X_train)),
        "testSize": int(len(X_test)),
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1Score": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "confusionMatrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "trainedAt": datetime.now(timezone.utc).isoformat(),
    }

    MODEL_STATE["model"] = clf
    MODEL_STATE["metrics"] = metrics
    MODEL_STATE["dataset"] = {"filename": file.filename, "rowCount": int(len(df))}

    return jsonify({"dataset": MODEL_STATE["dataset"], "modelMetrics": metrics})


@app.route("/api/predict", methods=["POST"])
def predict():
    if MODEL_STATE["model"] is None:
        return jsonify({"error": "Model is not trained yet. Upload a CSV dataset first."}), 400

    payload = request.get_json(force=True)
    features = np.array([[float(payload[f]) for f in CORE_FEATURES]])
    clf: RandomForestClassifier = MODEL_STATE["model"]

    probs = clf.predict_proba(features)[0]
    rain_prob = float(probs[1])
    label = "Rain" if rain_prob >= 0.5 else "No Rain"
    summary = f"Scikit-learn RandomForestClassifier predicts {label} with {rain_prob * 100:.1f}% rainfall probability."
    created_at = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO predictions (
                temperature, humidity, pressure, wind_speed, cloud_cover,
                previous_rainfall, predicted_label, rain_probability, summary_text, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (*[float(payload[f]) for f in CORE_FEATURES], label, rain_prob, summary, created_at),
        )
        conn.commit()

    return jsonify(
        {
            "prediction": label,
            "rainProbability": round(rain_prob, 4),
            "noRainProbability": round(1 - rain_prob, 4),
            "summaryText": summary,
            "createdAt": created_at,
        }
    )


@app.route("/api/history", methods=["GET", "DELETE"])
def history():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        if request.method == "DELETE":
            conn.execute("DELETE FROM predictions")
            conn.commit()
            return jsonify({"ok": True})
        rows = conn.execute("SELECT * FROM predictions ORDER BY id DESC LIMIT 250").fetchall()
        return jsonify({"items": [dict(r) for r in rows]})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
