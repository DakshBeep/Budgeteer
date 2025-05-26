#!/bin/sh
# Start script for Railway deployment

# Use Railway's PORT or default to 8000
export PORT=${PORT:-8000}

# Ensure DATABASE_URL uses absolute path for SQLite
if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "sqlite:///budgeteer.db" ]; then
    export DATABASE_URL="sqlite:////app/data/budgeteer.db"
fi

echo "Starting Budgeteer on port $PORT"
echo "Using database: $DATABASE_URL"

# Start uvicorn with the correct port
exec uvicorn main:app --host 0.0.0.0 --port $PORT