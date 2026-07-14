#!/usr/bin/env bash
# Exit immediately if any command fails
set -e

# Install Python dependencies
pip install -r requirements.txt

# Pre-download the embedding model so it's cached for runtime
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"