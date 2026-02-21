The "Real-Time" Solution: Scan & Compare
Instead of waiting for a receipt, the user points their phone camera at a product on the shelf.

1. The Real-Time Workflow
Capture: User takes a photo of a product (or its barcode) using a Streamlit interface.

Analyze (The Brain): Python sends the image directly to Gemini 1.5 Flash.

Why Gemini Flash? It’s incredibly fast and perfect for "real-time" multimodal (image + text) tasks.

Cross-Reference: Gemini identifies the product (e.g., "Venus Women’s Razor, 3-pack, $12.99").

The "Pink Tax" Check: Python (via Gemini or a quick web search tool) looks for the male/neutral version (e.g., "Gillette Men’s Razor, 3-pack, $8.99").

Instant Alert: The app displays: "⚠️ Pink Tax Detected! You are paying a 44% premium. Switch to the blue pack to save $4.00."


The Concept: EquiFlow MobileThe Experience: You walk into a shop in Mumbai. You open EquiFlow, hit "Travel Mode," and snap a photo of a bottle of water listed for ₹100. The app instantly tells you, "Hey, the standard price for this brand here is ₹20. You're being 'Travel Taxed'—look for a vendor with a MRP (Maximum Retail Price) label."1. The Startup: Select Your LensWhen the app opens, the user sees two high-contrast buttons:🚺 Girl Mode: Focuses on detecting gender-based price gaps (shampoos, razors, services).🌍 Travel Mode: Focuses on regional price parity and "local vs. tourist" rates.2. The Core Tech: React Native + GeminiCamera: Use react-native-vision-camera. It’s the fastest, most modern library for handling real-time frames in React Native.The Brain: You’ll send the image from the phone to a Python (Flask/FastAPI) backend or directly to the Gemini 1.5 Flash API.The Comparison Engine: Gemini doesn't just "see" the bottle; it uses its training data (and a Google Search tool integration) to know that a 1L water bottle in India should cost roughly $0.25 (₹20), not $1.20 (₹100).How it works (The Code Logic)Step 1: The Mode Selector (React Native)JavaScriptconst [mode, setMode] = useState('girl'); // 'girl' or 'travel'

return (
  <View>
    <Button title="Girl Mode" onPress={() => setMode('girl')} color={mode === 'girl' ? 'pink' : 'grey'} />
    <Button title="Travel Mode" onPress={() => setMode('travel')} color={mode === 'travel' ? 'blue' : 'grey'} />
    <CameraComponent mode={mode} />
  </View>
);
Step 2: The Gemini Logic (Python Backend)You send the image and the mode to Gemini with a specialized prompt:Prompt for Travel Mode: "I am in [User Location]. I am taking a photo of this [Product]. The price listed is [Price]. Based on current regional data for 2026, what is the fair local price for this item? Is this a 'Tourist Tax'?"The "Scan & Cross-Check" TableModeWhat Gemini ScansWhat it Cross-ChecksThe "Win"Girl ModeWomen's labeled items.Male-equivalent price data + ingredient list.Redirects the "Tax" into a savings goal.Travel ModeForeign items + local currency.Regional MRP (Max Retail Price) + Local custom rates.Prevents overpaying in unfamiliar markets.Why This Wins at a HackathonMultimodal Mastery: You are using the latest Gemini features to solve a high-friction, real-world problem.Global Impact: It’s a tool for equity, whether that’s gender equity or geographical fairness.The "Wow" Factor: A live demo where you scan a product and get a "Fair Price" alert is much more engaging than a static dashboard.Next Step for You:Would you like me to generate the full React Native code for the Camera screen so you can start testing the "Scan" button?Build an Amazon Price Tracker with React NativeThis video provides a practical guide on building a price-tracking mobile app, which is a key technical component of your "EquiFlow" project.