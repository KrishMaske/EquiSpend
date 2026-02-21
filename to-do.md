Here is your master hackathon TO-DO list for EquiSpend.

I have merged your dual-mode UI concept (Girl Mode / Travel Mode), the 3-Tier Fallback backend we discussed earlier, and the new "Beauty Tax/Facts" integration into a single, chronological action plan.

Divide these tasks among your team based on who is handling Frontend (React Native), Backend (FastAPI), and AI/Data.

Phase 1: Project Setup & Infrastructure 🛠️
[ ] Initialize GitHub Repo: Create the EquiSpend repository and share access.

[ ] Setup Backend Environment: Create a Python virtual environment, install FastAPI, Uvicorn, Pandas, Pandas, and the Google GenAI SDK.

[ ] Setup Frontend Environment: Initialize the React Native app and install react-native-vision-camera and axios.

[ ] API Keys: Get your free API keys for Google Gemini (gemini-1.5-flash) and SerpApi, and add them to a .env file in your backend folder.

Phase 2: Database & Local Data (The Safety Net) 🗄️
[ ] Clean the Kaggle CSV: Review the cost-of-living.csv and identify which columns (x1, x2, etc.) represent generic items (water, coffee, meals).

[ ] Write init_db.py: Create a Python script that builds a local SQLite database (equispend.db).

[ ] Create Tables: Program the script to create two tables: macro_pricing (to hold the CSV data) and price_cache (to store successful API hits for the demo).

[ ] Run Migration: Execute init_db.py once to populate the SQLite database.

Phase 3: The AI & Backend API (FastAPI) 🧠
[ ] Create the API Route: Build a POST /api/analyze endpoint in FastAPI that accepts a Base64 image, user GPS coordinates/City, and the selected Mode (girl or travel).

[ ] Step 1: The Vision Extraction: Write the Gemini prompt to analyze the image and return a JSON object containing the product name, brand, listed price, and ingredients (if applicable).

[ ] Step 2: Implement "Travel Mode" Logic:

Route to SerpApi for exact matches.

If it fails, fallback to querying the SQLite macro_pricing table.

If that fails, fallback to a Gemini Zero-Shot PPP estimate.

[ ] Step 3: Implement "Girl Mode & Beauty Tax" Logic:

Prompt Gemini to identify if the item is marketed toward women.

The Beauty Fact Check: If it's skincare/makeup, ask Gemini to identify the active ingredients and search SerpApi for a male or gender-neutral product with the exact same active ingredients but a lower price.

[ ] Step 4: The Calculator: Write a quick Python function to calculate the percentage markup and exact dollar amount saved.

[ ] Step 5: Caching: Ensure the final result is saved to the SQLite price_cache table before returning the JSON to the frontend.

Phase 4: The Mobile Frontend (React Native) 📱
[ ] Build the Mode Toggle UI: Create the two high-contrast buttons at the top of the screen: 🚺 Girl/Beauty Mode and 🌍 Travel Mode.

[ ] Implement the Camera: Set up react-native-vision-camera to show a live feed with a target "crop box" overlay so users know where to place the price tag.

[ ] Image Capture & Compression: Write the function to snap the photo, shrink the file size, and convert it to a Base64 string.

[ ] API Connection: Use axios or fetch to send the Base64 string, location, and Mode state to your FastAPI backend.

[ ] Build the Results UI (The "Wow" Factor):

Create a Red Alert Card ("⚠️ Travel Taxed!" or "⚠️ Pink Tax Detected!"). Show the price difference and the fair local price.

Create a Green Success Card ("✅ Fair Price!").

For Girl/Beauty mode, add a "Switch & Save" button that suggests the cheaper, functionally identical alternative.

Phase 5: Demo Prep & Polish (Crucial for Winning) 🏆
[ ] Pre-Load the Cache: The night before the presentation, scan the exact items you plan to use on stage. This caches the results in your SQLite database, guaranteeing your live demo will work perfectly even if the venue Wi-Fi crashes.

[ ] Source Props: Go to a local pharmacy or raid your team's travel bags. Get a "Pink Tax" razor, a high-priced beauty serum, and a generic bottle of water. Put fake high-price stickers on them for the demo.

[ ] Draft the Pitch: Focus the pitch on Financial Equity. Explain how EquiSpend seamlessly bridges the gap between complex macro-economic data (Travel Mode) and ingredient-level chemical analysis (Beauty Tax) to put money back in the user's pocket.

What is your team's immediate next step? Do you want me to write the init_db.py script for Phase 2, or draft the exact react-native-vision-camera component for Phase 4?