#!/bin/sh
# Start script for Railway deployment

# Use Railway's PORT or default to 8000
export PORT=${PORT:-8000}

echo "Starting Budgeteer on port $PORT"

# Start uvicorn with the correct port
exec uvicorn main:app --host 0.0.0.0 --port $PORT