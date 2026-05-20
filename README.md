# CarbonDesk

Carbon accounting web app (React + Node.js + MongoDB).

## Structure

- `frontend/` — Vite + React UI
- `backend/` — Express API (`server.js`)

## Local development

### Backend

```bash
cd backend
cp .env.example .env   # set MONGODB_URI, JWT_SECRET, etc.
npm install
npm run dev
```

API default: `http://localhost:5001`

### Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=https://carbondesk.onrender.com/api (hosted API)
npm install
npm run dev
```

Use `frontend/.env.local` only if you need to override `.env` (e.g. a different API URL).

UI default: `http://localhost:5173`

## Production (typical)

- **Backend:** Render (or similar) — env from `backend/.env.example`
- **Frontend:** Vercel — `VITE_API_URL` must end with `/api` (e.g. your Render URL + `/api`)

## Useful backend scripts

```bash
npm run init-env              # create .env from example if missing
npm run create-company-operator
npm run check-email
```

See `backend/.env.example` and `frontend/.env.example` for all configuration options.
