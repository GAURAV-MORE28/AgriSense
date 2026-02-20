# KRISHI-AI 🌾 — AI-Powered Government Scheme Discovery for Indian Farmers

> **Intelligent matching, document verification, and application automation for rural India's farmers**

---

## ✅ System Status — All Core Features Operational

| Feature | Status | Notes |
|---------|--------|-------|
| Docker-based deployment | ✅ | Single `docker-compose up --build` |
| OTP-based Auth + JWT | ✅ | Secure, stateless auth |
| Farmer Profile Wizard | ✅ | 3-step form, auto-saves locally |
| AI Scheme Matching (20 schemes) | ✅ | YAML-driven rules engine + ML ranking |
| Explainable Recommendations | ✅ | Multilingual (EN/HI/MR) explanations |
| Document Upload + OCR | ✅ | Tesseract OCR (Aadhaar, Land Records) |
| OCR Validation | ✅ | Fuzzy-match against profile (Levenshtein) |
| Application Submission | ✅ | Mock Gov API integration |
| Application Status Tracking | ✅ | Real-time status with timeline |
| Admin Dashboard | ✅ | Metrics, top schemes, fraud alerts |
| Offline Sync (backend) | ✅ | Batch sync with conflict resolution |
| Multilingual UI | ✅ | i18n with EN/HI/MR |
| Accessibility | ✅ | High-contrast mode |

---

## 🚀 Quick Start

### Prerequisites
- **Docker Desktop** (Windows/Mac/Linux)
- **Git**

### 1. Clone & Start
```bash
git clone <repo_url>
cd krishi-ai
docker-compose up --build
```

### 2. Access the Application
| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:4001/api/v1 |
| **ML Service (Swagger UI)** | http://localhost:5000/docs |
| **Admin Dashboard** | http://localhost:3000/admin |

### 3. Run the Demo Script (PowerShell)
```powershell
.\scripts\demo.ps1
```

This tests the full flow: health check → login → profile creation → AI scheme matching → application submission → admin metrics → OCR.

---

## 💻 Local Development (without Docker)

> **Note:** On Windows PowerShell, use `;` instead of `&&` to chain commands.

### Terminal 1 — ML Service
```powershell
cd ml-service; pip install -r requirements.txt; python -m uvicorn app.main:app --reload --port 5000
```

### Terminal 2 — Backend
```powershell
cd backend; npm install; npm run dev
```

### Terminal 3 — Frontend
```powershell
cd frontend; npm install; npm start
```

**Requirements:** PostgreSQL and Redis running locally, or update `.env` with connection strings.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KRISHI-AI Stack                           │
│                                                             │
│  ┌─────────┐    ┌──────────┐    ┌───────────────┐          │
│  │ Frontend │───►│ Backend  │───►│  ML Service   │          │
│  │ React    │    │ Express  │    │  FastAPI       │          │
│  │ :3000    │    │ :4001    │    │  :5000         │          │
│  └─────────┘    └────┬─────┘    └───────┬───────┘          │
│                      │                  │                   │
│                 ┌────┴─────┐     ┌──────┴──────┐           │
│                 │PostgreSQL│     │ Tesseract   │           │
│                 │ :5432    │     │ OCR Engine  │           │
│                 └──────────┘     └─────────────┘           │
│                 ┌──────────┐                               │
│                 │  Redis   │                               │
│                 │  :6379   │                               │
│                 └──────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

### Services
- **Frontend (React)** — Mobile-first UI with Tailwind CSS, i18n, high-contrast mode
- **Backend (Express/TypeScript)** — REST API, JWT auth, profile CRUD, scheme proxy, admin
- **ML Service (FastAPI/Python)** — Rules engine, ranking engine, OCR service
- **PostgreSQL** — Users, profiles, documents, applications, sync queue
- **Redis** — Session caching (ready for rate limiting)

---

## 🔑 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/request-otp` | Request OTP (demo: returns OTP in response) |
| POST | `/api/v1/auth/login` | Login with OTP → returns JWT token |
| POST | `/api/v1/auth/refresh` | Refresh JWT token |

### Profile
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/profile` | ✅ | Create/update farmer profile |
| GET | `/api/v1/profile` | ✅ | Get current user's profile |

### Schemes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/schemes` | ✅ | AI-matched schemes for user's profile |
| POST | `/api/v1/schemes/match` | Optional | Match schemes with provided profile JSON |
| GET | `/api/v1/schemes/list` | No | List all 20 available schemes |
| GET | `/api/v1/schemes/:id` | No | Get scheme details |

### Documents & OCR
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/documents/upload` | ✅ | Upload document → OCR processing |
| POST (ML) | `/api/v1/ocr/process` | No | Process base64 image |
| POST (ML) | `/api/v1/ocr/upload` | No | Upload file for OCR |
| POST (ML) | `/api/v1/ocr/validate` | No | Cross-validate OCR vs profile |

### Applications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/application/submit` | ✅ | Submit application |
| GET | `/api/v1/application/:id` | ✅ | Get application status |
| GET | `/api/v1/application/user/all` | ✅ | All user's applications |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/metrics` | ✅ | Dashboard metrics overview |
| GET | `/api/v1/admin/applications` | ✅ | Paginated application list |
| GET | `/api/v1/admin/fraud-alerts` | ✅ | Low-confidence documents |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Backend health |
| GET | `/health` (ML) | ML service health |
| GET | `/docs` (ML) | Swagger documentation |

---

## 📋 Scheme Database

20 real Indian government schemes in `ml-service/data/schemes.yaml`:

1. PM-KISAN Samman Nidhi — ₹6,000/yr income support
2. Soil Health Card — Free soil testing
3. PM Fasal Bima Yojana — Crop insurance
4. Kisan Credit Card — Subsidized credit
5. PM Krishi Sinchai Yojana — Irrigation subsidy
6. National Food Security Mission — Production support
7. Small Farmer Agri-Business — Market linkage
8. Paramparagat Krishi Vikas — Organic farming
9. Agricultural Mechanization — Farm machinery
10. Horticulture Development — Fruit/vegetable support
11. Dairy Entrepreneurship — Dairy units
12. Interest Subvention Scheme — Loan interest rebate
13. Warehouse Development — Post-harvest storage
14. Rainfed Area Development — Dry land support
15. National Livestock Mission — Poultry/goatery
16. Maharashtra Farm Loan Waiver — State-specific
17. Mahila Kisan Sashaktikaran — Women farmers
18. PM-KUSUM Solar Pump — Solar irrigation
19. Sugarcane Development Fund — Sugarcane support
20. Technology Mission on Cotton — Cotton farmers

---

## 🔧 Configuration

### Port Mapping (`.env`)
```bash
FRONTEND_PORT=3000
BACKEND_PORT=4001    # Using 4001 to avoid conflicts
ML_PORT=5000
POSTGRES_PORT=5432
REDIS_PORT=6379
```

### Fixing Port Conflicts
If any port is already in use:
1. Edit `.env` and change the conflicting port
2. Rebuild: `docker-compose up --build`

### Windows/OneDrive Users
If builds are slow due to OneDrive sync:
```powershell
# Pause OneDrive sync during development
# Or move project outside OneDrive folder
```

---

## 🧪 Testing

```bash
# Backend tests
cd backend && npm test

# ML service tests
cd ml-service && pytest

# Demo script (tests full stack)
.\scripts\demo.ps1
```

---

## 📁 Project Structure

```
krishi-ai/
├── frontend/              # React + TypeScript + Tailwind
│   ├── src/pages/         # Landing, Login, ProfileWizard, SchemeResults, etc.
│   ├── src/components/    # Header, OfflineBanner, LoadingSpinner, VoiceInput
│   ├── src/contexts/      # AuthContext, OfflineContext
│   └── nginx.conf         # Production serving config
├── backend/               # Express + TypeScript
│   ├── src/routes/        # auth, profile, schemes, documents, application, admin, sync
│   ├── src/middleware/     # auth (JWT), errorHandler, rateLimit
│   └── db/init.sql        # PostgreSQL schema
├── ml-service/            # FastAPI + Python
│   ├── app/api/           # schemes, ocr, health endpoints
│   ├── app/services/      # rules_engine, ranking_engine, ocr_service
│   ├── app/models/        # Pydantic schemas
│   └── data/schemes.yaml  # 20 scheme definitions
├── scripts/
│   └── demo.ps1           # PowerShell demo script
├── docker-compose.yml     # Full stack orchestration
├── .env                   # Port & config variables
└── README.md              # This file
```
