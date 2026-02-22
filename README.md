# 💰 EquiSpend — AI-Powered Price Gouging Detector

> **Snap a photo. Get the truth. Stop getting gouged.**

Price gouging isn't just a disaster-day problem — it happens every day on store shelves. EquiSpend is a cross-platform mobile app that uses **AI image recognition** and **live Google Shopping data** to catch price gouging in real time. Point your camera at any product, and EquiSpend instantly compares what you're being charged against the **true market price** — exposing hidden markups before you pay.

Two built-in filters target the most common forms of everyday gouging:
- **🚺 Pink Tax Filter** — Detects gender-based price gouging, where women's products are marked up over identical men's equivalents
- **🌍 Tourist Tax Filter** — Detects location-based price gouging, where vendors inflate prices for travelers who don't know local rates

**Built with React Native (Expo) · FastAPI · Google Gemini 2.5 Flash · SerpAPI · Supabase**

---

## 🧠 The Problem

**Price gouging is everywhere — and it's invisible.** Without real-time market data in your hand at the point of sale, you have no way to know if the price on the shelf is fair. Retailers, resellers, and vendors exploit this information gap every day:

- **Gender-Based Gouging ("Pink Tax")** — Women pay an average of **13% more** for nearly identical personal care products. Same formula, different color, higher price. This affects razors, shampoo, deodorant, body wash, and more.
- **Location-Based Gouging ("Tourist Tax")** — Vendors near tourist areas routinely mark up everyday items by **30–300%**, exploiting the fact that visitors don't know what things should cost locally.
- **General Overpricing** — Even outside these categories, individual stores frequently price items well above the regional market rate.

Consumers have no tool to check prices in the moment — until now.

---

## 💡 The Solution

EquiSpend puts a **price gouging detector in your pocket**:

1. 📷 **Snap** a photo of any product on the shelf
2. 🤖 **Gemini AI** identifies the product, brand, volume, and gender marketing
3. 🔍 **SerpAPI** pulls live Google Shopping prices for your region
4. 📊 **Statistical engine** (median pricing, anchor filtering, bulk/delivery app penalties) calculates the true fair market price
5. 💱 **Live currency conversion** ensures accurate comparisons anywhere in the world
6. ⚡ **Instant verdict** — see exactly how much you're being gouged, the fair price, and a direct link to buy it cheaper

Apply the **Pink Tax filter** to catch gender-based gouging, the **Tourist Tax filter** for location-based gouging, or run **both** simultaneously.

---

## 🎬 Demo Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  📷 Scanner  │ ──▶ │  🤖 Identify │ ──▶ │  💵 Enter Your Price │ ──▶ │  📊 Results      │
│  Take photo  │     │  Gemini AI   │     │  Confirm product     │     │  Fair market price│
│  Set location│     │  returns     │     │  Apply filter(s):    │     │  Gouging amount   │
│              │     │  product info│     │  Pink / Tourist /Both│     │  Suggested alt    │
└──────────────┘     └──────────────┘     └──────────────────────┘     │  Direct buy link  │
                                                                       └──────────────────┘
```

---

## 🎯 Features

| Feature | Description |
|---------|-------------|
| � **Price Gouging Detection** | Compares the price you see on the shelf against live Google Shopping market data to expose unfair markups |
| 🚺 **Pink Tax Filter** | Filters for gender-based gouging — compares female-marketed products to male/generic equivalents via AI-generated queries |
| 🌍 **Tourist Tax Filter** | Filters for location-based gouging — searches the user's actual local market to find the true price vs. the inflated tourist price |
| 🔄 **Combined Filter** | Run Pink Tax + Tourist Tax filters simultaneously on a single scan |
| 📍 **Location-Aware** | GPS auto-detection + manual override. SERP results are localized (`gl=in` for India, `gl=fr` for France, etc.) |
| 💱 **Multi-Currency** | 20+ currencies supported. Live exchange rates via [open.er-api.com](https://open.er-api.com). Prices auto-convert to user's currency |
| 📊 **Statistical Pricing** | Median-based pricing with Anchor Filter (2.5x cap), bulk listing penalties (-10), and delivery app penalties (-5) |
| 🔗 **Direct Product Links** | Every alternative includes a clickable buy link with thumbnail image — act on gouging instantly |
| 💾 **Smart Caching** | Results cached in Supabase with currency tagging to avoid redundant API calls |
| 📜 **Scan History** | Persistent local history of all past scans with location, prices, and timestamps |
| 🔐 **Auth** | Supabase-backed user authentication (signup/login) |
| 🖼️ **Image Zoom** | Full-screen zoomable modal for product and suggestion images |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│           React Native (Expo SDK 54)                │
│                                                     │
│  Scanner ──▶ Results ──▶ History ──▶ Profile        │
│  expo-camera   Animated    AsyncStorage   Auth      │
│  expo-location Reanimated                           │
│  expo-image-picker                                  │
└────────────────────┬────────────────────────────────┘
                     │ REST API (FormData)
                     ▼
┌─────────────────────────────────────────────────────┐
│                    BACKEND                          │
│              FastAPI (Python 3.10+)                 │
│                                                     │
│  POST /scan/identify   ──▶  Gemini 2.5 Flash       │
│  POST /scan/analyze    ──▶  Gemini → SerpAPI → Stats│
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Gemini  │  │ SerpAPI  │  │ Exchange Rate API │  │
│  │ Vision  │  │ Google   │  │ open.er-api.com   │  │
│  │ + Query │  │ Shopping │  │ Live FX rates     │  │
│  └─────────┘  └──────────┘  └───────────────────┘  │
│                     │                               │
│                     ▼                               │
│            ┌─────────────────┐                      │
│            │    Supabase     │                      │
│            │  PostgreSQL DB  │                      │
│            │  cached_products│                      │
│            │  users / auth   │                      │
│            └─────────────────┘                      │
└─────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
EquiSpend/
├── backend/                     # FastAPI backend
│   ├── app.py                   # Entry point (CORS, routers)
│   ├── requirements.txt         # Python dependencies
│   ├── config/
│   │   └── settings.py          # Supabase, Gemini, SerpAPI keys
│   ├── routes/
│   │   ├── scanner_route.py     # /scan/identify + /scan/analyze
│   │   ├── auth_route.py        # Authentication endpoints
│   │   └── db_route.py          # Database operations
│   └── utils/
│       ├── gemini.py            # Gemini AI prompts & analysis
│       ├── logic.py             # Pricing engine (SERP, scoring, median, cache)
│       ├── auth.py              # Auth utilities
│       ├── prompt.json          # Primary Gemini prompt template
│       └── failover_prompt.json # Fallback prompt template
│
├── frontend/                    # React Native (Expo) app
│   ├── app/
│   │   ├── _layout.tsx          # Navigation layout
│   │   ├── index.tsx            # Splash / onboarding
│   │   ├── scanner.tsx          # Camera + mode select + location
│   │   ├── results.tsx          # Results display (animated)
│   │   ├── history.tsx          # Scan history
│   │   ├── login.tsx            # Login screen
│   │   ├── signup.tsx           # Signup screen
│   │   └── profile.tsx          # User profile
│   ├── constants/
│   │   ├── api.ts               # API base URL config
│   │   ├── auth.ts              # Token management
│   │   ├── fetch.ts             # Authenticated fetch wrapper
│   │   ├── theme.ts             # Color palette
│   │   └── currencies.ts        # Currency codes & symbols
│   ├── image-store.ts           # Shared in-memory state (image, location, price)
│   └── package.json
│
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites

| Tool | Version | Link |
|------|---------|------|
| **Node.js** | ≥ 18.x | [nodejs.org](https://nodejs.org/) |
| **Python** | ≥ 3.10 | [python.org](https://python.org/) |
| **Expo Go** *(mobile)* | Latest | [App Store](https://apps.apple.com/app/expo-go/id982107779) / [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) |

### 1. Clone

```bash
git clone https://github.com/KrishMaske/EquiSpend.git
cd EquiSpend
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
SERP_KEY=your_serpapi_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

> **API Keys:**
> - Gemini → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
> - SerpAPI → [serpapi.com](https://serpapi.com/)
> - Supabase → [supabase.com](https://supabase.com/)

Start the server:

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `w` to open in the browser.

> **Mobile + Backend:** Both devices must be on the same Wi-Fi network. Update `frontend/constants/api.ts` with your machine's local IP (e.g., `http://192.168.1.42:8000`). For production, use a tunnel like [ngrok](https://ngrok.com/).

---

## 🔬 How the Gouging Detection Engine Works

### The Pipeline

```
User scans product on the shelf
        │
        ▼
   Gemini 2.5 Flash identifies: brand, name, category, gender, volume
        │
        ▼
   Gemini generates a comparison search query (filter-aware)
   • Pink Tax filter → searches for the male/generic equivalent
   • Tourist Tax filter → searches for the same product at fair local prices
   • General → searches for the same product across retailers
        │
        ▼
   SerpAPI hits Google Shopping (localized via gl= code)
        │
        ▼
   Scoring Algorithm ranks results:
   ✅ +4 for major retailers (Amazon, Walmart, Target, Best Buy)
   ✅ +3 for brand name match
   ✅ +2 for keyword overlap
   ❌ -10 for bulk/multipack listings ("pack of 12", "bundle")
   ❌ -5 for delivery apps (Instacart, DoorDash, Uber Eats)
   ❌ Filtered out: refurbished, replacement parts, accessories, knockoffs
        │
        ▼
   Anchor Filter: drops any price > 2.5× the best first-party price
        │
        ▼
   Median Calculation: immune to outliers from dropshippers
        │
        ▼
   Currency conversion (if SERP currency ≠ user currency)
        │
        ▼
   Result: fair market price, gouging amount, % markup, product link + image
```

### Why Median > Mean

E-commerce data is heavily right-skewed — a $7 razor might appear alongside a $45 "premium bundle" from a dropshipper. The **mean** gets pulled up; the **median** finds the true middle.

### The Anchor Filter

If the best trusted-retailer price is $7, any result over $17.50 (2.5×) is dropped entirely. This eliminates bulk multipacks and marketplace scalpers before they can inflate the "fair price" and hide the gouging.

---

## 🌍 Supported Regions

| Country | GL Code | Currency | Status |
|---------|---------|----------|--------|
| United States | `us` | USD | ✅ Full support |
| India | `in` | INR | ✅ Full support |
| United Kingdom | `uk` | GBP | ✅ Full support |
| Canada | `ca` | CAD | ✅ Full support |
| Australia | `au` | AUD | ✅ Full support |
| Germany | `de` | EUR | ✅ Full support |
| France | `fr` | EUR | ✅ Full support |
| Japan | `jp` | JPY | ✅ Full support |
| *Any other* | *fallback* | *via FX API* | ✅ Currency conversion |

---

## 📦 Tech Stack

### Backend

| Package | Purpose |
|---------|---------|
| `fastapi` | REST API framework |
| `google-genai` | Gemini 2.5 Flash (vision + text) |
| `serpapi` | Google Shopping live price data |
| `supabase` | PostgreSQL database + auth |
| `pillow` | Image optimization before AI analysis |
| `python-dotenv` | Environment variable management |

### Frontend

| Package | Purpose |
|---------|---------|
| `expo` (SDK 54) | Cross-platform React Native framework |
| `expo-router` | File-based navigation |
| `expo-camera` | Camera access for scanning |
| `expo-image-picker` | Photo library upload |
| `expo-location` | GPS + reverse geocoding |
| `react-native-reanimated` | Smooth UI animations |
| `@react-native-async-storage` | Persistent scan history |

---

## 📡 API Reference

### `POST /scan/identify`

Identify a product from an image using Gemini AI.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | File | ✅ | Product photo (JPEG/PNG) |

**Response:**
```json
{
  "status": "success",
  "data": {
    "brand": "Gillette Venus",
    "product_name": "Smoothing Cleanser + Shave Gel",
    "category": "Shave Gel",
    "volume": "6.42 oz",
    "gender_marketing": "women"
  }
}
```

### `POST /scan/analyze`

Run the price gouging analysis pipeline.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | ✅ | Gouging filter: `"girl"` (Pink Tax), `"travel"` (Tourist Tax), `"general"`, or `"both"` |
| `brand` | string | ✅ | Product brand |
| `product_name` | string | ✅ | Product name |
| `category` | string | ✅ | Product category |
| `user_price` | string | ✅ | Price the user is paying |
| `currency` | string | ❌ | Currency code (default: `"USD"`) |
| `city` | string | ❌ | User's city |
| `state` | string | ❌ | User's state/region |
| `country` | string | ❌ | User's country |

**Response:**
```json
{
  "status": "success",
  "data": {
    "product_name": "Smoothing Cleanser + Shave Gel",
    "price_scanned": 9.99,
    "fair_price": 6.99,
    "suggestion_price": 6.99,
    "equity_gap": 3.00,
    "gouging_percent": 42.9,
    "currency_symbol": "$",
    "comparable_product": "Gillette Series Sensitive Shave Gel",
    "source": "Target",
    "suggestion_image": "https://...",
    "suggestion_link": "https://..."
  }
}
```

---

## 🤝 Team

Built by **Team EquiSpend** for the hackathon — because price gouging shouldn't be invisible.

---

## 📄 License

This project is for educational and hackathon purposes.
