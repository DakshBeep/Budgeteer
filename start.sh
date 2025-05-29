#!/bin/sh
# Start script for Railway deployment

# Use Railway's PORT or default to 8000
export PORT=${PORT:-8000}

# Ensure DATABASE_URL uses absolute path for SQLite
if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "sqlite:///budgeteer.db" ]; then
    export DATABASE_URL="sqlite:////app/data/budgeteer.db"
fi

# Set JWT_SECRET if not provided
if [ -z "$JWT_SECRET" ]; then
    export JWT_SECRET="railway-default-secret-change-in-production"
    echo "WARNING: Using default JWT_SECRET. Set JWT_SECRET env var in production!"
fi

echo "Starting CashBFF on port $PORT"
echo "Using database: $DATABASE_URL"
echo "Environment: ${RAILWAY_ENVIRONMENT:-development}"

# Check if main_minimal.py exists (for simplified deployment)
if [ -f "main_minimal.py" ]; then
    echo "Using minimal configuration"
    exec uvicorn main_minimal:app --host 0.0.0.0 --port $PORT
else
    # Start uvicorn with the regular main app
    exec uvicorn main:app --host 0.0.0.0 --port $PORT
fi