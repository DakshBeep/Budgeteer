# Budgeteer

Budgeteer is a demo budget tracking application combining a FastAPI backend with a Streamlit UI. It lets you record basic transactions, visualize your finances and experiment with simple forecasting.

## Project Structure

- `main.py` – FastAPI application with database models and endpoints.
- `app.py` – Streamlit front end for entering and viewing transactions.
- `requirements.txt` – Python dependencies.
- `docs/PLANNING.md` – development workflow, roles and milestones.

## Setup

1. Create and activate a virtual environment (optional but recommended).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. In one terminal, start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```
4. In another terminal, launch the Streamlit app:
   ```bash
   streamlit run app.py
   ```

See [docs/PLANNING.md](docs/PLANNING.md) for contributor roles, milestones and additional instructions.

## Planned Features

- Record income and expenses with categories
- View running balance over time
- Pie chart summary by category
- Simple CRUD API for transactions

