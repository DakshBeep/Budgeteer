# Budgeteer

Budgeteer is a demo budget tracking application with a FastAPI backend and a Streamlit UI. It lets you record basic transactions and visualize your finances.

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

## Usage

1. Register a user by sending a POST to `/register` with a JSON body containing `username` and `password`.
2. Log in via `/login` to receive a session token.
3. Include the token in an `Authorization: Bearer <token>` header for all subsequent requests from the Streamlit UI.
4. Call `/logout` or use the logout button in the UI to invalidate the current token.

If upgrading from a previous version of Budgeteer without user accounts, remove the existing `budgeteer.db` to recreate the database with user tables.

## Planned Features

- Record income and expenses with categories
- View running balance over time
- Pie chart summary by category
- Simple CRUD API for transactions
- User registration and login with session tokens

