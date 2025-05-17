import pandas as pd
from catboost import CatBoostRegressor
from neuralprophet import NeuralProphet


def catboost_predict(idx, running_values, future_idx):
    """Train a CatBoost regressor and predict future balances."""
    model = CatBoostRegressor(iterations=200, verbose=False)
    model.fit(idx, running_values)
    preds = model.predict(future_idx)
    return preds


def neuralprophet_predict(running_series, future_dates):
    """Forecast running balance using NeuralProphet."""
    df = running_series.reset_index()
    df.columns = ["ds", "y"]
    m = NeuralProphet()
    m.fit(df, freq="D", progress="none")
    future = m.make_future_dataframe(df, periods=len(future_dates))
    forecast = m.predict(future)
    preds = forecast["yhat1"].tail(len(future_dates)).values
    return preds
