# KRISHI-AI Demo Script — 3 Minutes

## Prerequisites
- Run `docker-compose up --build`
- Open http://localhost:3000

---

## Scenario 1: Eligible Farmer (1 min)

1. **Click "Get Started"**

2. **Fill Profile Wizard:**
   - Name: "Ramesh Kumar"
   - Mobile: "9876543210"
   - State: "Maharashtra"
   - District: "Pune"
   - Click Next

3. **Farm Details:**
   - Land Type: "Irrigated"
   - Acreage: "1.5"
   - Select crops: "rice", "wheat"
   - Farmer Type: "Owner"
   - Click Next

4. **Family & Income:**
   - Family Members: "4"
   - Annual Income: "150000"
   - Click "Find Schemes"

5. **View Results:**
   - Show top 3 schemes with scores
   - Click "Why this scheme?" to see matched rules
   - Show estimated benefit amounts

---

## Scenario 2: Language Switch (30 sec)

1. **Change language to Hindi** (dropdown in header)
2. Show translated interface
3. Navigate to schemes page
4. Show Hindi explanations for schemes

---

## Scenario 3: Offline Mode (30 sec)

1. **Open DevTools → Network → Offline**
2. Show offline banner appears
3. Navigate to profile page
4. Show "Offline Mode" indicator
5. **Re-enable network**
6. Show sync status updating

---

## Scenario 4: Document Mismatch (30 sec)

1. Navigate to Documents page
2. Upload a sample document
3. Show OCR extracted fields
4. Demonstrate edit capability
5. Show validation status

---

## Key Talking Points

- ✅ **Multilingual**: English, Hindi, Marathi support
- ✅ **Voice Input**: Click speak button for hands-free input
- ✅ **Offline-First**: Works without internet
- ✅ **Explainable AI**: Shows why each scheme is recommended
- ✅ **20 Real Schemes**: PM-KISAN, PMFBY, KCC, and more
- ✅ **OCR Integration**: Auto-extract from Aadhaar, land records

---

## API Demo (Optional)

```bash
# Get scheme recommendations
curl -X POST http://localhost:4000/api/v1/schemes/match \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "name": "Test Farmer",
      "mobile": "9876543210",
      "state": "Maharashtra",
      "district": "Pune",
      "land_type": "irrigated",
      "acreage": 1.5,
      "main_crops": ["rice", "wheat"],
      "family_count": 4,
      "annual_income": 150000,
      "farmer_type": "owner"
    },
    "top_k": 5
  }'
```
