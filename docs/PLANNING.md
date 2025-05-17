# Project Planning

This document outlines the overall workflow for **Budgeteer**, including project structure, contributor roles, milestones, and setup instructions. Use it to coordinate development and track progress.

## Directory Structure

```
Budgeteer/
├── app.py          # Streamlit user interface
├── main.py         # FastAPI backend with forecasting
├── requirements.txt
├── README.md
└── docs/
    └── PLANNING.md # <-- this file
```

## Roles

- **Project Manager** – tracks milestones and ensures communication.
- **Backend Developer** – maintains `main.py`, database models, and API endpoints.
- **Frontend Developer** – maintains `app.py` and improves user experience.
- **Data/ML Engineer** – improves forecasting logic and analytics.

Contributors can hold multiple roles as needed.

## Milestones

1. **Environment setup** – create virtual environment and install dependencies.
2. **Transaction API** – implement CRUD endpoints and database schema.
3. **Streamlit UI** – build data entry form and transaction table.
4. **Visualization** – running balance and category charts.
5. **Forecasting** – prediction endpoint and chart.
6. **Packaging & deployment** – containerization or hosting steps.

Update this list as tasks are completed or new features are planned.

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd Budgeteer
   ```
2. **Create a virtual environment (optional)**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```
   CatBoost and NeuralProphet are included for advanced forecasting.
4. **Run the backend**
   ```bash
   uvicorn main:app --reload
   ```
5. **Run the Streamlit app** (in a separate terminal)
   ```bash
   streamlit run app.py
   ```
   The forecast chart will show red/yellow/green warnings based on predicted balance.

## Contributing Workflow

- Create a new Git branch for each feature or fix.
- Keep pull requests focused and include relevant documentation updates.
- Run `python -m py_compile main.py app.py` to catch syntax errors before opening a PR.
- Mention which milestone your change addresses in the PR description.

