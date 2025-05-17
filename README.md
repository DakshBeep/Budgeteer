# Budgeteer

Budgeteer is a demo budget tracking application combining a FastAPI backend with a Streamlit UI. It lets you record basic transactions, visualize your finances and experiment with simple forecasting.

## Project Structure

- `main.py` – FastAPI application with database models and endpoints.
- `app.py` – Streamlit front end for entering and viewing transactions.
- `requirements.txt` – Python dependencies.
- `docs/PLANNING.md` – development workflow, roles and milestones.

## Setup

1. Create and activate a virtual environment (optional but recommended).
2. Install dependencies (including optional forecasting libraries):
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

## Authentication

Register a user and obtain a JWT via the API:

```bash
curl -X POST "http://127.0.0.1:8000/register" -d "username=alice&password=secret"
curl -X POST "http://127.0.0.1:8000/login" -d "username=alice&password=secret"
```

The `/login` response returns a JSON object with a `token` field containing the
JWT (valid for one hour). Include this value in the `Authorization` header when
calling other endpoints:

```bash
curl -H "Authorization: Bearer <TOKEN>" http://127.0.0.1:8000/tx
```

The Streamlit frontend (`app.py`) stores this token and automatically includes it
in API requests after login.

See [docs/PLANNING.md](docs/PLANNING.md) for contributor roles, milestones and additional instructions.

## Forecasting

The `/forecast` API now supports `catboost` and `neuralprophet` models in addition to the existing options.
Use the Streamlit selector to choose a model. Predictions are color coded:

- **Green** – you are likely within budget
- **Yellow** – approaching your limit
- **Red** – projected overspend

These visual cues help interpret upcoming spending at a glance.

## Planned Features

- Record income and expenses with categories
- View running balance over time
- Pie chart summary by category
- Simple CRUD API for transactions
- Interactive forecasting with adjustable horizon and multiple models
- CatBoost and NeuralProphet support with red/yellow/green spend alerts


## License

Released under the [MIT License](LICENSE).

