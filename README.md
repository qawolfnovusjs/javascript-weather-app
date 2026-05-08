# Atmos — Weather Observatory

A small full-stack weather app with email/password authentication. Search any
city, view current conditions and a 7-day forecast, and (when logged in) save
favourite locations.

```
weather-app/
├── backend/        Express API + SQLite (auth, saved locations, weather proxy)
└── frontend/       Static HTML/CSS/JS — served by the same Node process
```

## Stack

- **Backend** — Node.js, Express, SQLite (`better-sqlite3`), `bcryptjs`, `jsonwebtoken`
- **Weather data** — [Open-Meteo](https://open-meteo.com) (free, no API key required)
- **Frontend** — Plain HTML/CSS/JS, no build step
- **Auth** — JWT bearer tokens stored in `localStorage`

## Prerequisites

- Node.js **18+** (uses the global `fetch` API)
- npm

## Setup

```bash
cd backend
cp .env.example .env        # then edit JWT_SECRET to something random
npm install
npm start
```

Open <http://localhost:3000>.

The Express server serves both the JSON API (`/api/*`) and the static frontend
from `../frontend`, so a single `npm start` runs the whole app.

## API

| Method | Path                          | Auth | Description                       |
| -----: | ----------------------------- | :--: | --------------------------------- |
| POST   | `/api/auth/signup`            |  ✗   | Create an account, returns a JWT  |
| POST   | `/api/auth/login`             |  ✗   | Returns a JWT                     |
| GET    | `/api/auth/me`                |  ✓   | Current user                      |
| GET    | `/api/auth/locations`         |  ✓   | List saved locations              |
| POST   | `/api/auth/locations`         |  ✓   | Save a location                   |
| DELETE | `/api/auth/locations/:id`     |  ✓   | Remove a saved location           |
| GET    | `/api/weather/geocode?q=...`  |  ✗   | Look up coordinates by name       |
| GET    | `/api/weather/forecast?lat=..&lon=..` | ✗ | Current + 7-day forecast    |
| GET    | `/api/health`                 |  ✗   | Liveness check                    |

Authenticated routes expect an `Authorization: Bearer <token>` header.

## Notes

- Passwords are hashed with bcrypt (cost 12). Never logged.
- `express-rate-limit` throttles `/api/auth/signup` and `/login` to 20 attempts
  per 15 minutes per IP.
- The SQLite database file (`data.db`) is created automatically on first run.
- For production, set a real `JWT_SECRET`, run behind HTTPS, and consider
  serving the frontend from a CDN.

## License

MIT
