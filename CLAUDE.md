# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the application
```bash
# Start FastAPI backend (runs on port 8000)
uvicorn main:app --reload

# Start Streamlit frontend (runs on port 8501)
streamlit run app.py

# Run with Docker Compose
docker compose up --build
```

### Testing
```bash
# Run all tests
pytest

# Run tests with verbose output
pytest -v

# Run a specific test file
pytest tests/test_api.py

# Run a specific test
pytest tests/test_api.py::test_register_user
```

### Development setup
```bash
# Install all dependencies including optional forecasting libraries
pip install -r requirements.txt

# Create .env file with required variables
# JWT_SECRET=your-secret-key
# DATABASE_URL=sqlite:///./budgeteer.db  # or postgresql://...
```

## Architecture Overview

Budgeteer is a budget tracking application with a **FastAPI backend** and **Streamlit frontend** designed for students.

### Core Components

1. **FastAPI Backend** (`main.py`)
   - JWT authentication with 1-hour token expiration
   - RESTful API with three main routers: auth, transactions, forecasting
   - SQLModel ORM for database operations
   - Support for both SQLite and PostgreSQL

2. **Database Models** (`dbmodels.py`)
   - **User**: Stores user credentials with bcrypt password hashing
   - **Tx**: Transaction records with support for recurring transactions
   - **BudgetGoal**: Monthly budget limits per user

3. **API Routers**
   - **auth.py**: User registration, login, password changes
   - **transactions.py**: CRUD operations for transactions, recurring transaction management
   - **forecast.py**: Multiple ML models (linear, random forest, Monte Carlo, CatBoost, NeuralProphet) for spending predictions

4. **Streamlit UI** (`app.py`)
   - Session-based authentication storing JWT tokens
   - Transaction entry with 12 predefined student-oriented categories
   - Visual budget tracking with progress bars
   - Color-coded forecasting alerts (green/yellow/red)
   - Charts for running balance and expense breakdown

### Key Implementation Details

- **Recurring Transactions**: When marked as recurring, creates 3 future monthly entries automatically
- **Forecasting**: Returns predictions with visual indicators based on budget goals
- **Transaction Search**: Filters by label, sorted newest first
- **Budget Progress**: Real-time monthly spending tracking against set goals
- **Environment Variables**: JWT_SECRET (required), DATABASE_URL (defaults to SQLite)

### Testing Approach

Tests use pytest with temporary SQLite databases for isolation. Key test areas:
- Authentication flow and token validation
- Transaction CRUD operations including recurring logic
- Forecasting model outputs
- Budget goal management
- Edge cases (zero amounts, future dates, etc.)