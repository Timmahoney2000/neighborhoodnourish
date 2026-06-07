# 🥫 NJ Food Pantries API

A REST API for finding food pantries, food banks, and soup kitchens across New Jersey.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run locally
```bash
npm start
# or for auto-reload during development:
npm run dev
```

The API will be available at `http://localhost:3000`.

---

## 📡 Endpoints

### `GET /`
Returns API info and a full list of available endpoints.

---

### `GET /api/pantries`
Returns all pantries (regional food banks + local pantries).

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `county` | string | Filter by county name (e.g. `Bergen`, `Cape_May`) |
| `city` | string | Filter by city (partial match, case-insensitive) |
| `has_hours` | boolean | If `true`, returns only pantries with listed hours |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 50, max: 200) |

**Examples:**
```
GET /api/pantries
GET /api/pantries?county=Bergen
GET /api/pantries?city=Hackensack
GET /api/pantries?has_hours=true&page=2
```

**Response:**
```json
{
  "total": 42,
  "page": 1,
  "limit": 50,
  "total_pages": 1,
  "results": [...]
}
```

---

### `GET /api/pantries/counties`
Returns a list of all available counties and their pantry counts.

**Response:**
```json
{
  "total": 13,
  "counties": [
    { "county": "Bergen", "display_name": "Bergen", "pantry_count": 34 },
    { "county": "Cape_May", "display_name": "Cape May", "pantry_count": 3 }
  ]
}
```

---

### `GET /api/pantries/county/:name`
Returns all local pantries and relevant regional food banks for a specific county.

County names are **case-insensitive**. Spaces can be replaced with underscores or hyphens.

**Examples:**
```
GET /api/pantries/county/Bergen
GET /api/pantries/county/cape-may
GET /api/pantries/county/Cape_May
```

**Response:**
```json
{
  "county": "Bergen",
  "local_pantry_count": 34,
  "regional_food_bank_count": 2,
  "regional_food_banks": [...],
  "local_pantries": [...]
}
```

---

### `GET /api/pantries/regional`
Returns all regional / statewide food bank distribution centers.

**Response:**
```json
{
  "total": 8,
  "results": [...]
}
```

---

### `GET /api/pantries/search`
Full-text search across pantry name, city, address, and notes.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | **Required.** Search term (min 2 characters) |
| `county` | string | Optional county pre-filter |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 50, max: 200) |

**Examples:**
```
GET /api/pantries/search?q=salvation
GET /api/pantries/search?q=soup+kitchen&county=Bergen
GET /api/pantries/search?q=church
```

**Response:**
```json
{
  "query": "salvation",
  "total": 3,
  "page": 1,
  "limit": 50,
  "total_pages": 1,
  "results": [...]
}
```

---

### `GET /api/resources`
Returns additional statewide resources and food locator tools (NJ 211, CFBNJ text line, Feeding America, etc.).

---

## 🌐 Deploying to the Cloud

### Vercel (recommended — free tier)
```bash
npm install -g vercel
vercel
```
A `vercel.json` is already included.

### Railway / Render
1. Push this repo to GitHub.
2. Connect the repo on [railway.app](https://railway.app) or [render.com](https://render.com).
3. Set `npm start` as the start command.
4. Set the `PORT` environment variable if needed.

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 🛡️ Features

- **CORS enabled** — safe to call from any frontend
- **Helmet** — sets secure HTTP headers
- **Rate limiting** — 100 requests per 15 minutes per IP
- **Pagination** — all list endpoints support `page` and `limit`
- **Case-insensitive** county and city matching
- **Full-text search** across name, city, address, and notes

---

## 📂 Project Structure

```
nj-food-pantries-api/
├── data/
│   └── nj_food_pantries.json   # The pantry dataset
├── src/
│   ├── server.js               # Express app & middleware
│   └── routes/
│       ├── pantries.js         # All pantry endpoints
│       └── resources.js        # Resources endpoint
├── .env.example
├── vercel.json                 # Vercel deployment config
├── package.json
└── README.md
```

---

## ⚠️ Data Notice

Hours and contact details are subject to change. Always direct users to call ahead to confirm availability. For the most up-to-date listings, supplement with [NJ 211](https://nj211.org) or [CFBNJ's locator](https://cfbnj.org/find-foods-services/).
