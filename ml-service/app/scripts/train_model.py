"""
Script to train a synthetic Logistic Regression model for scheme eligibility.
"""

import os
import joblib
import numpy as np
import logging
from sklearn.linear_model import LogisticRegression

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def train_synthetic_model():
    """
    Train a simple Logistic Regression model on synthetic data.
    Features: [land_size, income, crop_match, irrigation, state_match, farmer_type, docs_count]
    """
    logger.info("Generating synthetic data for training...")
    
    # Generate 1000 samples
    n_samples = 1000
    
    # Features:
    # 0: land_size (0-2)
    # 1: income (0-1)
    # 2: crop_match (0 or 1)
    # 3: irrigation (0 or 1)
    # 4: state_match (0 or 1)
    # 5: farmer_type (0-1)
    # 6: docs_count (0-1)
    
    X = np.empty((n_samples, 7))
    X[:, 0] = np.random.uniform(0, 2, n_samples) # land_size
    X[:, 1] = np.random.uniform(0, 1, n_samples) # income
    X[:, 2] = np.random.binomial(1, 0.7, n_samples) # crop_match
    X[:, 3] = np.random.binomial(1, 0.6, n_samples) # irrigation
    X[:, 4] = np.random.binomial(1, 0.8, n_samples) # state_match
    X[:, 5] = np.random.uniform(0, 1, n_samples) # farmer_type
    X[:, 6] = np.random.uniform(0, 1, n_samples) # docs_count
    
    # Target eligibility based on heuristic rules
    y = []
    for i in range(n_samples):
        # Higher score means more likely to be eligible
        score = (X[i, 2] * 2 + X[i, 4] * 2 + X[i, 3] * 1) - (X[i, 0] * 1.5 + X[i, 1] * 1.5)
        y.append(1 if score > 0 else 0)
    
    y = np.array(y)
    
    logger.info(f"Training on {n_samples} samples (Positive: {sum(y)})...")
    model = LogisticRegression()
    model.fit(X, y)
    
    model_dir = os.path.join(os.path.dirname(__file__), "..", "..", "models")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "eligibility_model.pkl")
    
    joblib.dump(model, model_path)
    logger.info(f"Model saved successfully to {model_path}")

if __name__ == "__main__":
    train_synthetic_model()
