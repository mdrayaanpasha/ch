# ch

Boilerplate monorepo: **React (JSX + Vite)** client and **Node.js (Express)** server.

## Structure

```
ch/
├── client/     # React + Vite frontend (JSX)
└── server/     # Express backend
```

## Getting started

### Server
```bash
cd server
npm install
npm run dev        # http://localhost:5000
```

### Client
```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

The client dev server proxies `/api` requests to the server (see `client/vite.config.js`).
