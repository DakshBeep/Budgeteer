import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
} from '@mui/material';

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
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>Login</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="User" value={username} onChange={e=>setUsername(e.target.value)} />
          <TextField label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <Button variant="contained" onClick={login}>Login</Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Add Transaction</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="Amount" value={amount} onChange={e=>setAmount(e.target.value)} />
        <TextField label="Label" value={label} onChange={e=>setLabel(e.target.value)} />
        <Button variant="contained" onClick={addTx}>Save</Button>
      </Box>
      <Typography variant="h5" sx={{ mt: 4 }}>Transactions</Typography>
      <List>
        {txs.map(tx => <ListItem key={tx.id}>{tx.label}: {tx.amount}</ListItem>)}
      </List>
    </Container>
  );
}
