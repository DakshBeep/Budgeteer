# streamlit run app.py

import streamlit as st
import requests
import pandas as pd
import plotly.express as px

FORECAST_API = "http://127.0.0.1:8000/forecast"
API = "http://127.0.0.1:8000/tx"   # FastAPI base URL
LOGIN_API = "http://127.0.0.1:8000/login"
LOGOUT_API = "http://127.0.0.1:8000/logout"
REGISTER_API = "http://127.0.0.1:8000/register"

st.title("Budgeteer – quick demo")

if "token" not in st.session_state:
    st.session_state["token"] = None
    st.session_state["username"] = ""

st.sidebar.header("Account")
if st.session_state["token"]:
    st.sidebar.write(f"Logged in as {st.session_state['username']}")
    if st.sidebar.button("Logout"):
        headers = {"Authorization": f"Bearer {st.session_state['token']}"}
        requests.post(LOGOUT_API, headers=headers)
        st.session_state["token"] = None
        st.session_state["username"] = ""
        st.experimental_rerun()
else:
    username = st.sidebar.text_input("Username")
    password = st.sidebar.text_input("Password", type="password")
    if st.sidebar.button("Login"):
        r = requests.post(LOGIN_API, json={"username": username, "password": password})
        if r.status_code == 200:
            st.session_state["token"] = r.json()["token"]
            st.session_state["username"] = username
            st.experimental_rerun()
        else:
            st.sidebar.error("Login failed")
    if st.sidebar.button("Register"):
        r = requests.post(REGISTER_API, json={"username": username, "password": password})
        if r.status_code == 200:
            st.sidebar.success("Registered. Please log in.")
        else:
            st.sidebar.error("Registration failed")

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
with col3:
    label = st.selectbox("Category", options=categories, index=4)  # default “Food”

if st.button("Save"):
    if amount == 0:
        st.warning("Amount can’t be zero")
    else:
        if not st.session_state["token"]:
            st.error("Please log in first")
        else:
            headers = {"Authorization": f"Bearer {st.session_state['token']}"}
            r = requests.post(API, json={
                "tx_date": str(tx_date),
                "amount": amount,
                "label": label
            }, headers=headers)
            if r.status_code == 200:
                st.success("Saved!")
                st.rerun()        # refresh the page
            else:
                st.error("Error saving")

# ── fetch + show data ────────────────────────────────────────
headers = None
if st.session_state["token"]:
    headers = {"Authorization": f"Bearer {st.session_state['token']}"}
    resp = requests.get(API, headers=headers)
    if resp.status_code == 200:
        data = resp.json()
    else:
        data = []
        st.error("Failed to load data")
else:
    st.info("Please log in to view data")
    data = []
df = pd.DataFrame(data)
st.dataframe(df)

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
    forecast_headers = {"Authorization": f"Bearer {st.session_state['token']}"}
    forecast_resp = requests.get(FORECAST_API, headers=forecast_headers)
    forecast_data = forecast_resp.json() if forecast_resp.status_code == 200 else []
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

