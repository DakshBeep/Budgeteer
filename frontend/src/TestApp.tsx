export default function TestApp() {
  console.log('TestApp component rendering!')
  return (
    <div style={{ padding: '20px', background: 'lightblue', textAlign: 'center' }}>
      <h1>React is Working!</h1>
      <p>If you can see this, React is rendering correctly.</p>
      <button onClick={() => alert('Button clicked!')}>Test Button</button>
    </div>
  )
}