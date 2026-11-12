#!/usr/bin/env bash
# Exit immediately if any command fails
set -e

# Upgrade pip to the latest version
pip install --upgrade pip

# Install Python dependencies without cache to prevent corrupted download hashes
pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model so it's cached for runtime
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
