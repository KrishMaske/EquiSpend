# 💰 EquiSpend — Real-Time Pricing Equity Scanner

**EquiSpend** is a cross-platform mobile + web app that uses **AI-powered image analysis** to detect pricing inequity in real time. Point your camera at any product, and EquiSpend will tell you if you're being overcharged due to the **Pink Tax** (gender-based pricing) or the **Tourist Tax** (location-based markup).

Built with **React Native (Expo)** on the frontend and **FastAPI + Gemini AI** on the backend.

---

## 🎯 Features

- **🚺 Girl Mode** — Detects the "Pink Tax" by comparing female-marketed products to their male/generic equivalents
- **🌍 Travel Mode** — Detects the "Tourist Tax" by comparing tourist-area prices to fair local prices
- **📍 Location-Aware** — Uses GPS + reverse geocoding to provide region-specific price analysis
- **📷 Camera + Upload** — Snap a photo or upload from gallery (works on iOS, Android, and Web)
- **🤖 Gemini AI** — Powered by Google's Gemini 2.5 Flash for fast, accurate multimodal analysis
- **💾 Scan History** — All scans are persisted to a local SQLite database
- **🔌 Extensible** — Plug in CSV/API data sources (Numbeo, SerpApi, Open Beauty Facts) for enhanced accuracy

---

## 📂 Project Structure

```
EquiSpend/
├── backend/                  # FastAPI backend
│   ├── main.py               # API server (Gemini AI + SQLite)
│   ├── .env                  # API keys (not committed to git)
│   ├── test_api.py           # Quick API test script
│   ├── config/               # Settings & config
│   └── data/                 # CSV data sources (future)
│
├── frontend/                 # React Native (Expo) app
│   ├── app/                  # Expo Router screens
│   │   ├── _layout.tsx       # Navigation layout
│   │   ├── index.tsx         # Splash / home screen
│   │   ├── scanner.tsx       # Camera + mode selection
│   │   └── results.tsx       # Analysis results display
│   ├── image-store.ts        # Shared in-memory store
│   ├── app.json              # Expo config
│   └── package.json          # Node dependencies
│
├── .gitignore
└── README.md                 # ← You are here
```

---

## 🚀 Prerequisites

Make sure you have the following installed before getting started:

| Tool | Version | Install Link |
|------|---------|-------------|
| **Node.js** | ≥ 18.x | [nodejs.org](https://nodejs.org/) |
| **npm** | ≥ 9.x | Comes with Node.js |
| **Python** | ≥ 3.10 | [python.org](https://www.python.org/downloads/) |
| **pip** | ≥ 22.x | Comes with Python |
| **Expo CLI** | Latest | Installed via `npx` (no global install needed) |
| **Expo Go** *(mobile only)* | Latest | [iOS App Store](https://apps.apple.com/app/expo-go/id982107779) / [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) |

---

## ⚡ Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/KrishMaske/EquiSpend.git
cd EquiSpend
```

### 2. Set up the Backend

```bash
# Navigate to backend
cd backend

# (Recommended) Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install Python dependencies
pip install fastapi uvicorn python-multipart python-dotenv google-generativeai pillow
```

### 3. Configure the API Key

Create a `backend/.env` file (or edit the existing one):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> 🔑 **Get a free Gemini API key** at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 4. Start the Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Verify it's working:

```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

### 5. Set up the Frontend

Open a **new terminal**:

```bash
cd frontend

# Install Node dependencies
npm install
```

### 6. Start the Frontend

**For Web:**

```bash
npx expo start --web
```

**For Mobile (iOS / Android):**

```bash
npx expo start
```

Then scan the QR code with the **Expo Go** app on your phone.

> ⚠️ **Mobile + Backend**: If running the backend on your computer and the app on your phone, they must be on the **same Wi-Fi network**. You'll also need to change `API_BASE_URL` in `frontend/app/results.tsx` from `http://localhost:8000` to your computer's local IP, e.g.:
>
> ```ts
> const API_BASE_URL = 'http://192.168.1.42:8000';
> ```
>
> Find your local IP with `ipconfig` (Windows) or `ifconfig` (macOS/Linux).

---

## 📦 All Dependencies

### Backend (Python)

| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework for the API |
| `uvicorn` | ASGI server to run FastAPI |
| `python-multipart` | Required for `Form(...)` and `File(...)` uploads |
| `python-dotenv` | Loads environment variables from `.env` |
| `google-generativeai` | Google Gemini AI SDK |
| `pillow` | Image processing (PIL) |

**One-liner install:**

```bash
pip install fastapi uvicorn python-multipart python-dotenv google-generativeai pillow
```

### Frontend (Node.js / Expo)

All frontend dependencies are defined in `frontend/package.json` and installed with `npm install`. Key packages:

| Package | Purpose |
|---------|---------|
| `expo` (~54.x) | Core Expo framework |
| `expo-router` (~6.x) | File-based routing |
| `expo-image-picker` (~17.x) | Camera + photo library access |
| `expo-location` (~19.x) | GPS location + reverse geocoding |
| `react-native-reanimated` (~4.x) | Smooth animations |
| `react-native` (0.81.x) | Core React Native |

---

## 📱 How to Use

1. **Open the app** — You'll see the EquiSpend splash screen
2. **Tap to enter** → Scanner screen
3. **Allow location** — The app detects your city & country automatically
4. **Select a mode:**
   - 🚺 **Girl Mode** — for gendered product pricing (razors, shampoo, deodorant, etc.)
   - 🌍 **Travel Mode** — for tourist-inflated prices (water, food, souvenirs, etc.)
   - Select **both** for a dual analysis
5. **Capture or upload** a product image
6. **Tap Analyze** → Results screen shows:
   - Product name identified by AI
   - Price you're paying vs. the fair price
   - The exact dollar amount of the "tax"
   - Percentage markup
   - Actionable suggestions

---

## 🔧 API Reference

### `POST /scan`

Analyze a product image for pricing inequity.

**Form fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | ✅ | `"girl"`, `"travel"`, or `"both"` |
| `image` | file | ✅ | Product/receipt image (JPEG, PNG) |
| `latitude` | string | ❌ | GPS latitude |
| `longitude` | string | ❌ | GPS longitude |
| `city` | string | ❌ | Reverse-geocoded city name |
| `country` | string | ❌ | Reverse-geocoded country name |

**Response (success):**

```json
{
  "status": "success",
  "data": {
    "product_name": "Venus Women's Razor 3-pack",
    "price_scanned": 12.99,
    "fair_price": 8.99,
    "equity_gap": 4.00
  },
  "location": {
    "city": "New York",
    "country": "United States",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "message": "Successfully processed in girl mode."
}
```

### `GET /health`

Returns `{"status": "ok"}` — use this to verify the backend is running.

---

## 🧪 Testing the API Manually

```bash
cd backend
python test_api.py
```

Or with `curl`:

```bash
curl -X POST http://localhost:8000/scan \
  -F "mode=girl" \
  -F "image=@/path/to/product.jpg" \
  -F "city=New York" \
  -F "country=United States"
```

---

## 🛣️ Roadmap

- [ ] **SerpApi Integration** — Live Google Shopping prices for real-time comparisons
- [ ] **Open Beauty Facts** — Ingredient-level verification (prove products are identical)
- [ ] **Numbeo CSV** — Pre-loaded cost-of-living data for 100+ cities
- [ ] **Scan History Screen** — View past scans with trends over time
- [ ] **Share Results** — Export or share findings with friends
- [ ] **Barcode Scanning** — Faster product identification

---

## 🤝 Team

Built for the hackathon by team EquiSpend.

---

## 📄 License

This project is for educational and hackathon purposes.
