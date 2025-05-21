import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

export default function App() {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [txs, setTxs] = useState([]);
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('Food');

  const login = async () => {
    const res = await axios.post(`${API_BASE}/login`, `username=${username}&password=${password}`);
    setToken(res.data.token);
  };

  const addTx = async () => {
    await axios.post(`${API_BASE}/tx`, { tx_date: new Date().toISOString().slice(0,10), amount: parseFloat(amount), label }, { headers: { Authorization: `Bearer ${token}` }});
    loadTx();
  };

  const loadTx = async () => {
    const res = await axios.get(`${API_BASE}/tx`, { headers: { Authorization: `Bearer ${token}` }});
    setTxs(res.data);
  };

  useEffect(() => { if(token) loadTx(); }, [token]);

  if(!token) {
    return (
      <div>
        <h3>Login</h3>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="User" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div>
      <h3>Add Transaction</h3>
      <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount" />
      <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Label" />
      <button onClick={addTx}>Save</button>
      <h3>Transactions</h3>
      <ul>
        {txs.map(tx => <li key={tx.id}>{tx.label}: {tx.amount}</li>)}
      </ul>
    </div>
  );
}
