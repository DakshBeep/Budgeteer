# Build React frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend

# Copy package files for better caching
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend/ ./
# Set the API base to use relative paths in production
# This allows the frontend to work with the same domain
ENV VITE_API_BASE=""
RUN npm run build

# Python backend + serve React
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies in stages to reduce memory usage
COPY requirements-core.txt requirements.txt ./

# Install core dependencies first
RUN pip install --no-cache-dir -r requirements-core.txt

# Install ML libraries one by one to avoid memory spikes
RUN pip install --no-cache-dir scikit-learn || true
RUN pip install --no-cache-dir catboost || true
RUN pip install --no-cache-dir neuralprophet || true
RUN pip install --no-cache-dir streamlit || true

# Install remaining test dependencies
RUN pip install --no-cache-dir pytest apscheduler || true

# Copy application code
COPY . .

# Copy built frontend from previous stage
COPY --from=frontend-build /app/frontend/dist ./static

# Create directory for SQLite database (if using SQLite)
RUN mkdir -p /app/data

# Make start script executable
RUN chmod +x start.sh

# Verify the build
RUN ls -la static/ || echo "No static directory found"
RUN ls -la start.sh || echo "No start.sh found"

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