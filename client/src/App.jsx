import { useEffect, useState } from "react";

export default function App() {
  const [message, setMessage] = useState("Loading…");

  useEffect(() => {
    fetch("/api/hello")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Could not reach the server."));
  }, []);

  return (
    <main className="app">
      <h1>React + Node.js Boilerplate</h1>
      <p className="card">
        Server says: <strong>{message}</strong>
      </p>
      <p className="hint">
        Edit <code>client/src/App.jsx</code> and save to reload.
      </p>
    </main>
  );
}
