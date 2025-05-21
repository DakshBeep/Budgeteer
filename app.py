# streamlit run app.py

import streamlit as st
import os
import requests
import pandas as pd
import plotly.express as px

API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000")
FORECAST_API = f"{API_BASE}/forecast"

API = f"{API_BASE}/tx"   # FastAPI base URL
LOGIN = f"{API_BASE}/login"
REGISTER = f"{API_BASE}/register"
REMINDERS = f"{API_BASE}/reminders"

st.title("Budgeteer – quick demo")

if "token" not in st.session_state:
    st.sidebar.header("Account")
    username = st.sidebar.text_input("Username")
    password = st.sidebar.text_input("Password", type="password")
    if st.sidebar.button("Register"):
        r = requests.post(REGISTER, data={"username": username, "password": password})
        if r.status_code == 200:
            st.sidebar.success("Registered, logging in…")
            r2 = requests.post(LOGIN, data={"username": username, "password": password})
            if r2.status_code == 200:
                st.session_state["token"] = r2.json()["token"]
                st.experimental_rerun()
            else:
                st.sidebar.error(r2.json().get("detail", "Auto-login failed"))
        else:
            st.sidebar.error(r.json().get("detail", "Registration failed"))
    if st.sidebar.button("Login"):
        r = requests.post(LOGIN, data={"username": username, "password": password})
        if r.status_code == 200:
            st.session_state["token"] = r.json()["token"]
            st.experimental_rerun()
        else:
            st.sidebar.error(r.json().get("detail", "Login failed"))
    st.stop()

# ── input form ───────────────────────────────────────────────
st.subheader("Add a transaction")

col1, col2, col3 = st.columns(3)

categories = [
    "Monthly Income", "Financial Aid", "Tuition", "Housing", "Food",
    "Transportation", "Books & Supplies", "Entertainment", "Personal Care",
    "Technology", "Health & Wellness", "Miscellaneous"
]

with col1:
    tx_date = st.date_input("Date")
with col2:
    amount = st.number_input("Amount", value=0.0, step=0.01, format="%.2f")
    tx_type = st.radio("Type", ["Income", "Expense"], horizontal=True)
with col3:
    label = st.selectbox("Category", options=categories, index=4)  # default “Food”
recurring = st.checkbox("Recurring monthly", value=False)

auth_headers = {"Authorization": f"Bearer {st.session_state['token']}"}  # JWT

if st.button("Save"):
    if amount == 0:
        st.warning("Amount can’t be zero")
    else:
        final_amount = amount if tx_type == "Income" else -abs(amount)
        r = requests.post(
            API,
            json={
                "tx_date": str(tx_date),
                "amount": final_amount,
                "label": label,
                "recurring": recurring,
            },
            headers=auth_headers,
        )
        if r.status_code == 200:
            st.success("Saved!")
            get_txs.clear()
            st.rerun()        # refresh the page
        else:
            st.error(r.json().get("detail", "Failed to save"))

# ── fetch + show data ────────────────────────────────────────
@st.cache_data
def fetch_txs(headers):
    r = requests.get(API, headers=headers)
    if r.status_code == 200:
        return r.json()
    st.error(r.json().get("detail", "Failed to fetch transactions"))
    return []

data = fetch_txs(auth_headers)
df = pd.DataFrame(data)
if not df.empty:
    df["tx_date"] = pd.to_datetime(df["tx_date"])
    ledger_df = df[~((df["recurring"]) & (df["tx_date"] > pd.Timestamp.today()))]
    st.subheader("Transactions")
    for _, row in ledger_df.iterrows():
        cols = st.columns([3,2,2,1,1])
        cols[0].write(row["tx_date"].strftime("%Y-%m-%d"))
        cols[1].write(row["label"])
        cols[2].write(f"{row['amount']:.2f}")
        if cols[3].button("Edit", key=f"e{row['id']}"):
            with st.modal("Edit transaction"):
                etx_date = st.date_input("Date", value=row["tx_date"])
                eamount = st.number_input("Amount", value=float(abs(row['amount'])), step=0.01, format="%.2f")
                etype = st.radio("Type", ["Income", "Expense"], index=0 if row['amount']>0 else 1)
                elabel = st.selectbox("Category", categories, index=categories.index(row['label']))
                erec = st.checkbox("Recurring monthly", value=row['recurring'])
                if st.button("Save", key=f"save{row['id']}"):
                    final_amt = eamount if etype == "Income" else -abs(eamount)
                    resp = requests.put(
                        f"{API}/{row['id']}",
                        json={
                            "tx_date": str(etx_date),
                            "amount": final_amt,
                            "label": elabel,
                            "recurring": erec,
                        },
                        headers=auth_headers,
                    )
                    if resp.status_code == 200:
                        st.success("Updated")
                        fetch_txs.clear()
                        st.experimental_rerun()
                    else:
                        st.error(resp.json().get("detail", "Update failed"))
        if cols[4].button("Delete", key=f"d{row['id']}"):
            with st.modal("Confirm delete"):
                if st.button("Confirm", key=f"conf{row['id']}"):
                    resp = requests.delete(f"{API}/{row['id']}", headers=auth_headers)
                    if resp.status_code == 204:
                        st.success("Deleted")
                        fetch_txs.clear()
                        st.experimental_rerun()
                    else:
                        st.error("Delete failed")
else:
    st.info("No transactions yet")

# show upcoming recurring transactions
reminders = requests.get(REMINDERS, headers=auth_headers).json()
reminder_df = pd.DataFrame(reminders)
if not reminder_df.empty:
    st.subheader("Upcoming recurring transactions")
    st.dataframe(reminder_df)

# ── running-balance chart ───────────────────────────────────
if not df.empty:
    # ensure date column is datetime & sorted
    df["tx_date"] = pd.to_datetime(df["tx_date"])
    df = df.sort_values("tx_date")

    # running balance
    df["running_balance"] = df["amount"].cumsum()

    fig = px.line(
        df,
        x="tx_date",
        y="running_balance",
        title="Running balance over time",
        markers=True,
    )
    fig.update_xaxes(dtick="D", tickformat="%b %d")   # prettier x-axis
    st.plotly_chart(fig, use_container_width=True)

    summary = (
        df.groupby("label", as_index=False)["amount"]
        .sum()
        .sort_values("amount", ascending=False)
    )

    # expenses as positive values for the pie
    summary["abs_amount"] = summary["amount"].abs()

    fig2 = px.pie(
        summary,
        names="label",
        values="abs_amount",
        title="Spending / income by category",
        hole=0.4,                     # makes it a donut
    )
    st.plotly_chart(fig2, use_container_width=True)

    # ---- forecast chart -------------------------------------------
    st.subheader("Forecast")
    forecast_days = st.slider("Days to forecast", min_value=1, max_value=30, value=7)
    model_map = {
        "Linear Regression": "linear",
        "Random Forest": "rf",
        "Monte Carlo": "mc",
        "CatBoost": "catboost",
        "NeuralProphet": "neuralprophet",
    }
    model_label = st.selectbox("Forecast model", list(model_map.keys()))
    params = {"days": forecast_days, "model": model_map[model_label]}

    @st.cache_data
    def fetch_forecast(parms, headers):
        r = requests.get(FORECAST_API, params=parms, headers=headers)
        if r.status_code == 200:
            return r.json()
        st.error(r.json().get("detail", "Forecast failed"))
        return []

    forecast_data = fetch_forecast(params, auth_headers)
    forecast_df = pd.DataFrame(forecast_data)
    if not forecast_df.empty:
        forecast_df["tx_date"] = pd.to_datetime(forecast_df["tx_date"])
        fig3 = px.line(
            forecast_df,
            x="tx_date",
            y="predicted_balance",
            title="Forecasted balance",
            markers=True,
        )
        fig3.update_xaxes(dtick="D", tickformat="%b %d")
        st.plotly_chart(fig3, use_container_width=True)
        final_balance = forecast_df["predicted_balance"].iloc[-1]
        current_balance = df["running_balance"].iloc[-1]
        if final_balance < 0:
            st.error("Forecast shows negative balance!")
        elif final_balance < current_balance:
            st.warning("Spending trend downward")
        else:
            st.success("Balance on track")
