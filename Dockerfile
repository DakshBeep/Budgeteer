# Simplified single-stage build for Railway
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install only essential dependencies
COPY requirements-minimal.txt .
RUN pip install --no-cache-dir -r requirements-minimal.txt

# Copy application code
COPY *.py ./
COPY start.sh ./

# Copy models directory
COPY models/ ./models/

# Copy frontend static files for serving
COPY frontend/dist/ ./static/

# Create directory for SQLite database (if using SQLite)
RUN mkdir -p /app/data

# Make start script executable
RUN chmod +x start.sh

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Don't set PORT here - let Railway provide it
# ENV PORT=8000

# Expose port (Railway ignores this but good for documentation)
EXPOSE $PORT

# Health check for Railway - use the PORT env var with fallback
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start the application using the start script
CMD ["./start.sh"]