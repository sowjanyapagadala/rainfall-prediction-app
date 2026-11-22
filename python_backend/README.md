# Python Flask + Scikit-learn Backend (Local Setup)

This directory contains the reference Python Flask backend using `scikit-learn`, `pandas`, `numpy`, and `sqlite3`.

## Local Execution Steps

```bash
cd python_backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The Flask API will start on `http://localhost:5000`.

> **Environment Note**: Because the cloud preview sandbox runs Node.js v22 without `pip` / `flask` / `scikit-learn`, the live full-stack application executes a compatible TypeScript Random Forest Classifier (`server/ml/randomForest.ts`), CSV preprocessing pipeline (`server/ml/preprocessing.ts`), Express server (`server.ts`), and native SQLite database (`server/db.ts`) on port 3000 with identical mathematical workflow and real test-split evaluation.
