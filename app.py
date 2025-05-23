# streamlit run app.py

import streamlit as st

# compatibility: Streamlit >=1.25 renamed `experimental_rerun` to `rerun`
rerun = getattr(st, "experimental_rerun", st.rerun)
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
GOAL = f"{API_BASE}/goal"
CHANGE_PW = f"{API_BASE}/change_password"


def handle_response(resp):
    """Handle 401 errors by prompting re-login."""
    if resp.status_code == 401:
        st.error("Your session has expired. Please log in again.")
        if "token" in st.session_state:
            del st.session_state["token"]
        rerun()
    return resp


def error_detail(resp, default="Error"):
    """Return error detail from a response, handling non-JSON bodies."""
    try:
        return resp.json().get("detail", default)
    except Exception:
        return resp.text or default

st.title("Budgeteer – quick demo")

token = st.session_state.get("token")
if not token:
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
                rerun()
            else:
                st.sidebar.error(error_detail(r2, "Auto-login failed"))
        else:
            st.sidebar.error(error_detail(r, "Registration failed"))
    if st.sidebar.button("Login"):
        r = requests.post(LOGIN, data={"username": username, "password": password})
        if r.status_code == 200:
            st.session_state["token"] = r.json()["token"]
            rerun()
        else:
            st.sidebar.error(error_detail(r, "Login failed"))
    st.stop()

st.sidebar.header("Account")
if st.sidebar.button("Logout"):
    del st.session_state["token"]
    rerun()

with st.sidebar.expander("Change password"):
    curr = st.text_input("Current password", type="password", key="curr_pw")
    new1 = st.text_input("New password", type="password", key="new_pw")
    new2 = st.text_input("Confirm new password", type="password", key="new_pw2")
    if st.button("Update password"):
        if new1 != new2:
            st.error("New passwords do not match")
        else:
            resp = requests.post(
                CHANGE_PW,
                json={"current_password": curr, "new_password": new1},
                headers=auth_headers,
            )
            handle_response(resp)
            if resp.status_code == 200:
                st.success("Password updated")
            else:
                st.error(error_detail(resp, "Failed"))

# first time help
if not st.session_state.get("seen_help"):
    st.info("Use the form below to add income or expenses. Switch the type to 'Expense' for money you spend.")
    st.session_state["seen_help"] = True

# ── input form ───────────────────────────────────────────────
st.subheader("Add a transaction")

col1, col2, col3 = st.columns(3)

categories = [
    "Monthly Income", "Financial Aid", "Tuition", "Housing", "Food",
    "Transportation", "Books & Supplies", "Entertainment", "Personal Care",
    "Technology", "Health & Wellness", "Miscellaneous"
]

with col1:
    tx_date = st.date_input("Date", value=st.session_state.get("last_date", pd.Timestamp.today()).date())
with col2:
    amount = st.number_input(
        "Amount",
        value=0.0,
        step=0.01,
        format="%.2f",
        min_value=0.0,
        help="No need to enter a minus sign – choose 'Expense' for money spent.",
    )
    tx_type = st.radio("Type", ["Income", "Expense"], horizontal=True)
with col3:
    default_idx = categories.index(st.session_state.get("last_cat", "Food")) if st.session_state.get("last_cat") in categories else 4
    label = st.selectbox("Category", options=categories, index=default_idx)
    recurring = st.checkbox("Recurring monthly", value=False)

notes = st.text_input("Notes", value="")

auth_headers = {"Authorization": f"Bearer {token}"}  # JWT

@st.cache_data
def fetch_goal(headers):
    r = requests.get(GOAL, headers=headers)
    handle_response(r)
    if r.status_code == 200:
        return r.json()
    return {"amount": 0.0, "spent": 0.0}

goal_info = fetch_goal(auth_headers)
st.sidebar.subheader("Monthly budget")
new_budget = st.sidebar.number_input("Budget limit", value=float(goal_info.get("amount", 0.0)), step=0.01)
progress = goal_info.get("spent", 0.0)
if goal_info.get("amount", 0.0) > 0:
    st.sidebar.progress(min(progress/goal_info["amount"], 1.0))
if st.sidebar.button("Set budget"):
    r = requests.post(GOAL, params={"amount": new_budget}, headers=auth_headers)
    handle_response(r)
    if r.status_code == 200:
        fetch_goal.clear()
        st.sidebar.success("Budget saved")
    else:
        st.sidebar.error("Failed")

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
                "notes": notes or None,
                "recurring": recurring,
            },
            headers=auth_headers,
        )
        handle_response(r)
        if r.status_code == 200:
            st.success("Saved!")
            st.session_state["last_date"] = tx_date
            st.session_state["last_cat"] = label
            fetch_txs.clear()
            st.rerun()        # refresh the page
        else:
            st.error(error_detail(r, "Failed to save"))

# ── fetch + show data ────────────────────────────────────────
@st.cache_data
def fetch_txs(headers):
    r = requests.get(API, headers=headers)
    handle_response(r)
    if r.status_code == 200:
        return r.json()
    st.error(error_detail(r, "Failed to fetch transactions"))
    return []

data = fetch_txs(auth_headers)
df = pd.DataFrame(data)
if not df.empty:
    df["tx_date"] = pd.to_datetime(df["tx_date"])
    ledger_df = df[~((df["recurring"]) & (df["tx_date"] > pd.Timestamp.today()))]
    ledger_df = ledger_df.sort_values("tx_date", ascending=False)
    st.subheader("Transactions")
    search = st.text_input("Search", "")
    colf1, colf2 = st.columns(2)
    start_filter = colf1.date_input("Start", value=ledger_df["tx_date"].min())
    end_filter = colf2.date_input("End", value=ledger_df["tx_date"].max())
    if search:
        ledger_df = ledger_df[ledger_df["label"].str.contains(search, case=False)]
    ledger_df = ledger_df[(ledger_df["tx_date"] >= pd.Timestamp(start_filter)) & (ledger_df["tx_date"] <= pd.Timestamp(end_filter))]
    for _, row in ledger_df.iterrows():
        cols = st.columns([3,2,2,1,1])
        cols[0].write(row["tx_date"].strftime("%Y-%m-%d"))
        cols[1].write(row["label"])
        if row.get("notes"):
            cols[1].caption(row["notes"])
        cols[2].write(f"${row['amount']:,.2f}")
        if cols[3].button("Edit", key=f"e{row['id']}"):
            with st.modal("Edit transaction"):
                etx_date = st.date_input("Date", value=row["tx_date"])
                eamount = st.number_input(
                    "Amount",
                    value=float(abs(row['amount'])),
                    step=0.01,
                    format="%.2f",
                    min_value=0.0,
                    help="No need to enter a minus sign – choose 'Expense' for money spent.",
                )
                etype = st.radio("Type", ["Income", "Expense"], index=0 if row['amount']>0 else 1)
                elabel = st.selectbox("Category", categories, index=categories.index(row['label']))
                enotes = st.text_input("Notes", value=row.get("notes", ""))
                erec = st.checkbox("Recurring monthly", value=row['recurring'])
                prop = st.checkbox("Apply to future entries", value=False)
                if st.button("Save", key=f"save{row['id']}"):
                    final_amt = eamount if etype == "Income" else -abs(eamount)
                    resp = requests.put(
                        f"{API}/{row['id']}",
                        json={
                            "tx_date": str(etx_date),
                            "amount": final_amt,
                            "label": elabel,
                            "notes": enotes or None,
                            "recurring": erec,
                        },
                        params={"propagate": prop},
                        headers=auth_headers,
                    )
                    handle_response(resp)
                    if resp.status_code == 200:
                        st.success("Updated")
                        st.session_state["last_date"] = etx_date
                        st.session_state["last_cat"] = elabel
                        fetch_txs.clear()
                        rerun()
                    else:
                        st.error(error_detail(resp, "Update failed"))
        if cols[4].button("Delete", key=f"d{row['id']}"):
            with st.modal("Confirm delete"):
                if st.button("Confirm", key=f"conf{row['id']}"):
                    resp = requests.delete(f"{API}/{row['id']}", headers=auth_headers)
                    handle_response(resp)
                    if resp.status_code == 204:
                        st.success("Deleted")
                        fetch_txs.clear()
                        rerun()
                    else:
                        st.error("Delete failed")
else:
    st.info("No transactions yet")

# show upcoming recurring transactions
reminders_resp = requests.get(REMINDERS, headers=auth_headers)
handle_response(reminders_resp)
reminders = reminders_resp.json() if reminders_resp.status_code == 200 else []
reminder_df = pd.DataFrame(reminders)
if not reminder_df.empty:
    st.subheader("Upcoming recurring transactions")
    st.dataframe(reminder_df)

# ── running-balance chart ───────────────────────────────────
if not df.empty:
    # ensure date column is datetime & sorted
    df["tx_date"] = pd.to_datetime(df["tx_date"])
    df = df.sort_values("tx_date")

    # exclude future-dated entries from calculations
    chart_df = df[df["tx_date"] <= pd.Timestamp.today()].copy()

    # running balance on historical data only
    chart_df["running_balance"] = chart_df["amount"].cumsum()

    fig = px.line(
        chart_df,
        x="tx_date",
        y="running_balance",
        title="Running balance over time",
        markers=True,
    )
    fig.update_xaxes(dtick="D", tickformat="%b %d")   # prettier x-axis
    fig.update_yaxes(tickprefix="$")
    st.plotly_chart(fig, use_container_width=True)

    summary = (
        chart_df.groupby("label", as_index=False)["amount"]
        .sum()
        .sort_values("amount", ascending=False)
    )

    income_df = summary[summary["amount"] > 0]
    expense_df = summary[summary["amount"] < 0].copy()
    expense_df["amount"] = expense_df["amount"].abs()

    colA, colB = st.columns(2)
    if not income_df.empty:
        colA.subheader("Income")
        fig_inc = px.pie(
            income_df,
            names="label",
            values="amount",
            hole=0.4,
        )
        fig_inc.update_traces(texttemplate="$%{value:,.2f}")
        colA.plotly_chart(fig_inc, use_container_width=True)
    if not expense_df.empty:
        colB.subheader("Expenses")
        fig_exp = px.pie(
            expense_df,
            names="label",
            values="amount",
            hole=0.4,
        )
        fig_exp.update_traces(texttemplate="$%{value:,.2f}")
        colB.plotly_chart(fig_exp, use_container_width=True)

    # ---- forecast chart -------------------------------------------
    st.subheader("Forecast")
    forecast_days = st.slider("Days to forecast", min_value=1, max_value=30, value=7)
    advanced = st.checkbox("Show advanced options", value=False)
    model_map = {
        "Linear Regression": "linear",
        "Random Forest": "rf",
        "Monte Carlo": "mc",
        "CatBoost": "catboost",
        "NeuralProphet": "neuralprophet",
    }
    if advanced:
        model_label = st.selectbox("Model", list(model_map.keys()))
        model_choice = model_map[model_label]
    else:
        model_choice = "linear"
    params = {"days": forecast_days, "model": model_choice}

    @st.cache_data
    def fetch_forecast(parms, headers):
        r = requests.get(FORECAST_API, params=parms, headers=headers)
        handle_response(r)
        if r.status_code == 200:
            return r.json()
        st.error(error_detail(r, "Forecast failed"))
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
        fig3.update_yaxes(tickprefix="$")
        st.plotly_chart(fig3, use_container_width=True)
        final_balance = forecast_df["predicted_balance"].iloc[-1]
        current_balance = (
            chart_df["running_balance"].iloc[-1] if not chart_df.empty else 0
        )
        if final_balance < 0:
            st.error("Forecast shows negative balance!")
        elif final_balance < current_balance:
            st.warning("Spending trend downward")
        else:
            st.success("Balance on track")
