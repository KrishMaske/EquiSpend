# EquiSpend

**Stop getting ripped off.** Snap a photo of any product, and EquiSpend tells you the real price — instantly.

EquiSpend is a mobile app that detects price gouging in real time using AI image recognition and live market data. It catches the two most common pricing scams consumers face every day:

- **Pink Tax** — Women's products priced higher than identical men's versions (same formula, different color, bigger price tag)
- **Tourist Tax** — Vendors inflating prices for travelers who don't know what things cost locally

It also includes **Haggle Mode**: an AI voice agent that negotiates with the merchant *for you*, in *their language*, anchored to the real market price.

---

## How It Works

1. **Snap** a photo of a product on the shelf
2. **AI identifies** the brand, product, category, and gender marketing (Gemini 2.5 Flash)
3. **Live price search** pulls real Google Shopping data for your region (SerpAPI)
4. **Pricing engine** scores results, filters junk listings, and calculates the true fair price
5. **Verdict** — see the markup percentage, fair price, cheaper alternative with a buy link, and a one-tap button to haggle

```
 📷 Scan ──▶ 🤖 Identify ──▶ 💵 Confirm Price ──▶ 📊 Results ──▶ 🤝 Haggle
```

---

## Features

| | Feature | What it does |
|---|---------|-------------|
| 🚺 | **Pink Tax Detection** | Compares female-marketed products to male/generic equivalents. Same razor, same gel — exposes the gender markup. |
| 🌍 | **Tourist Tax Detection** | Searches the local market in your actual location to find the real price vs. inflated tourist price. |
| 🤝 | **Haggle Mode** | AI voice agent negotiates with the shopkeeper in their language. Anchored to the fair market price from your scan. Uses ElevenLabs Conversational AI. |
| 💱 | **Multi-Currency** | 20+ currencies. Live exchange rates. Prices auto-convert so you can compare across borders. |
| 📊 | **Smart Pricing Engine** | Median-based pricing. Anchor filter (2.5x cap). Penalties for bulk listings and delivery apps. Resistant to outliers. |
| 🔗 | **Buy Links** | Every alternative includes a clickable link with thumbnail — act on it immediately. |
| 💾 | **Caching** | Results cached in Supabase with currency tags. Faster repeat lookups, fewer API calls. |
| 📜 | **Scan History** | Every scan saved locally with timestamps, prices, and location. |
| 📍 | **Location-Aware** | GPS auto-detection + manual override. SERP results localized by country code. |

---

## Haggle Mode

After scanning, if a product is overpriced, a **"Haggle This Price"** button appears on the results card. Tap it, and an AI voice agent connects via ElevenLabs Conversational AI to negotiate with the merchant directly.

**What makes it work:**
- The agent receives the **exact product name, asking price, and fair market price** from your scan — it's not guessing
- Opens at ~70% of fair price and grinds up in tiny increments. Hard ceiling at fair price × 1.15. Walks away if the merchant won't budge
- **Speaks the merchant's language** — detects what language they use and mirrors it instantly
- Adapts negotiation style to local culture (relationship-focused in Latin America, direct in Germany)
- Runs inside a WebView (ElevenLabs convai widget) — works in Expo Go, no native build required

The full agent configuration (system prompt, client tools, voice settings) is in [`docs/elevenlabs-agent-config.md`](docs/elevenlabs-agent-config.md).

---

## Pricing Engine

The price comparison isn't a simple average. The pipeline:

```
Gemini identifies product → generates comparison search query
        ↓
SerpAPI hits Google Shopping (localized by country)
        ↓
Results scored:
  +4  major retailer (Amazon, Walmart, Target)
  +3  brand match
  +2  keyword overlap
  -10 bulk/multipack ("pack of 12")
  -5  delivery app (Instacart, DoorDash)
  ✕   filtered: refurbished, accessories, knockoffs
        ↓
Anchor Filter: drops prices > 2.5× the best trusted-retailer price
        ↓
Median of remaining prices (immune to dropshipper outliers)
        ↓
Currency conversion if needed (live FX rates)
        ↓
Fair price + markup % + savings amount + buy link
```

**Why median, not mean:** E-commerce data is right-skewed. A $7 razor appears next to a $45 dropshipper bundle. The mean gets pulled up; the median finds the truth.

**Why the anchor filter:** If the best trusted-retailer price is $7, anything over $17.50 (2.5×) gets dropped — bulk packs and scalpers eliminated before they inflate the benchmark.

---

## Architecture

```
┌────────────────────────────────────────────────┐
│  FRONTEND — React Native (Expo SDK 54)         │
│                                                │
│  Scanner → Results → History → Profile         │
│  expo-camera    Reanimated    AsyncStorage     │
│  expo-location  expo-image-picker              │
│                                                │
│  Talk (Haggle Mode)                            │
│  └─ WebView → ElevenLabs convai widget         │
└──────────────────┬─────────────────────────────┘
                   │ REST API
                   ▼
┌────────────────────────────────────────────────┐
│  BACKEND — FastAPI (Python 3.10+)              │
│                                                │
│  POST /scan/identify  →  Gemini 2.5 Flash      │
│  POST /scan/analyze   →  Gemini → SerpAPI      │
│                          → Pricing Engine       │
│                                                │
│  Gemini (Vision + Query Gen)                   │
│  SerpAPI (Google Shopping)                     │
│  open.er-api.com (Live FX Rates)               │
│  Supabase (PostgreSQL — cache + auth)          │
└────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Mobile App** | React Native 0.81, Expo SDK 54, TypeScript, expo-router |
| **UI / Animation** | react-native-reanimated, Animated API |
| **Camera / Location** | expo-camera, expo-image-picker, expo-location |
| **Haggle Mode** | ElevenLabs Conversational AI (convai widget via react-native-webview) |
| **Backend** | FastAPI, Python 3.10+, Uvicorn |
| **AI** | Google Gemini 2.5 Flash (vision + text generation) |
| **Price Data** | SerpAPI (Google Shopping, localized) |
| **Database** | Supabase (PostgreSQL) — product cache + user auth |
| **Currency** | open.er-api.com (live exchange rates) |

---

## Project Structure

```
EquiSpend/
├── backend/
│   ├── app.py                    # FastAPI entry point
│   ├── config/settings.py        # API keys (Supabase, Gemini, SerpAPI)
│   ├── routes/
│   │   ├── scanner_route.py      # /scan/identify + /scan/analyze
│   │   ├── auth_route.py         # Auth endpoints
│   │   └── db_route.py           # Database ops
│   └── utils/
│       ├── gemini.py             # Gemini prompts & analysis
│       ├── logic.py              # Pricing engine (SERP, scoring, cache)
│       ├── prompt.json           # Primary Gemini prompt
│       └── failover_prompt.json  # Fallback prompt
│
├── frontend/
│   ├── app/
│   │   ├── scanner.tsx           # Camera + filter select + location
│   │   ├── results.tsx           # Results cards + Haggle button
│   │   ├── talk.tsx              # Haggle Mode (ElevenLabs WebView)
│   │   ├── history.tsx           # Scan history
│   │   ├── login.tsx / signup.tsx
│   │   └── profile.tsx
│   ├── constants/
│   │   ├── api.ts                # Backend URL
│   │   ├── currencies.ts         # Currency codes + symbols
│   │   └── theme.ts              # Colors
│   └── image-store.ts            # Shared state (image, location, price)
│
├── docs/
│   └── elevenlabs-agent-config.md  # Haggle Mode dashboard config
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18 — [nodejs.org](https://nodejs.org/)
- **Python** ≥ 3.10 — [python.org](https://python.org/)
- **Expo Go** — [App Store](https://apps.apple.com/app/expo-go/id982107779) / [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Backend

```bash
cd backend
python -m venv venv && venv\Scripts\activate  # Windows
# source venv/bin/activate                    # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GEMINI_API_KEY=your_key
SERP_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
```

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with Expo Go. Both devices must be on the same network — update `frontend/constants/api.ts` with your machine's IP, or use [ngrok](https://ngrok.com/) for tunneling.

### Haggle Mode Setup

1. Create an agent at [elevenlabs.io/app/conversational-ai](https://elevenlabs.io/app/conversational-ai)
2. Paste the system prompt and client tool config from [`docs/elevenlabs-agent-config.md`](docs/elevenlabs-agent-config.md)
3. Set the Agent ID in `frontend/app/talk.tsx`

---

## API

### `POST /scan/identify`

Send a product photo, get back the identified product.

```json
{
  "brand": "Gillette Venus",
  "product_name": "Smoothing Cleanser + Shave Gel",
  "category": "Shave Gel",
  "volume": "6.42 oz",
  "gender_marketing": "women"
}
```

### `POST /scan/analyze`

Run the gouging analysis. Pass mode (`girl`, `travel`, `general`, or `both`), product info, user price, currency, and location.

```json
{
  "product_name": "Smoothing Cleanser + Shave Gel",
  "price_scanned": 9.99,
  "fair_price": 6.99,
  "equity_gap": 3.00,
  "comparable_product": "Gillette Series Sensitive Shave Gel",
  "source": "Target",
  "suggestion_link": "https://...",
  "suggestion_image": "https://..."
}
```

---

## Supported Regions

Works anywhere with Google Shopping coverage. Localized via country codes (`gl=us`, `gl=in`, `gl=fr`, etc.). Currency conversion for 20+ currencies via live FX rates.

| Region | Status |
|--------|--------|
| US, Canada, UK, Australia | Full support |
| India, Japan, Germany, France | Full support |
| Any other | Supported via FX conversion fallback |

---

## Team

Built by **Team EquiSpend** — because price gouging shouldn't be invisible.

---

## License

Educational and hackathon purposes.
