# Build React frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend

# Copy package files for better caching
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend/ ./
# Set the API base to use relative paths in production
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

# Copy and install Python dependencies first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy built frontend from previous stage
COPY --from=frontend-build /app/frontend/dist ./static

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

# Health check for Railway - use the PORT env var
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

# Start the application using the start script
CMD ["./start.sh"]