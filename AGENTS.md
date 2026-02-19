# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview
KRISHI-AI is a full-stack AI-powered platform helping Indian farmers discover and apply for government schemes. It features multilingual support (English, Hindi, Marathi), voice interaction, offline-first PWA, and explainable AI recommendations.

## Architecture
- **Frontend**: React 18 + TypeScript + Tailwind CSS (PWA with Service Worker)
- **Backend**: Node.js + Express + TypeScript (API Gateway)
- **ML Service**: Python + FastAPI (Scheme matching, OCR)
- **Database**: PostgreSQL + Redis (production), in-memory (development)

## Build Commands

### Docker (Recommended)
```bash
docker-compose up --build          # Start all services
docker-compose down                # Stop all services
```

### Local Development
```bash
# ML Service (Terminal 1) — use ";" on Windows PowerShell instead of "&&"
cd ml-service && pip install -r requirements.txt && uvicorn app.main:app --reload --port 5000

# Backend (Terminal 2)
cd backend && npm install && npm run dev

# Frontend (Terminal 3)
cd frontend && npm install && npm start
```
**Windows PowerShell:** Replace `&&` with `;`. Use `python -m uvicorn` if `uvicorn` is not in PATH.

## Testing
```bash
cd backend && npm test             # Backend tests
cd ml-service && pytest            # ML service tests
cd frontend && npm test            # Frontend tests
```

## Key Files to Edit

### Scheme Rules (No code changes needed)
- `ml-service/data/schemes.yaml` - Add/modify scheme eligibility rules

### Translations
- `frontend/src/i18n/locales/*.json` - Language files (en, hi, mr)

### Environment
- `.env.example` - Configuration template

## API Endpoints

### Backend (port 4000)
- `POST /api/v1/auth/request-otp` - Request OTP
- `POST /api/v1/auth/login` - Login with OTP
- `POST /api/v1/profile` - Create/update farmer profile
- `POST /api/v1/schemes/match` - Get scheme recommendations
- `POST /api/v1/documents/upload` - Upload document for OCR
- `POST /api/v1/application/submit` - Submit application

### ML Service (port 5000)
- `POST /api/v1/schemes/match` - Scheme matching with explainability
- `POST /api/v1/ocr/process` - OCR document processing
- `GET /health` - Health check

## Code Conventions
- TypeScript strict mode in frontend and backend
- Python type hints in ML service
- Pydantic for request/response validation
- YAML for scheme rule definitions (non-developers can edit)
- i18next for translations

## Offline Support
- IndexedDB via `idb` library for local storage
- Service Worker for asset caching
- Sync queue for offline applications

## Security Notes
- JWT authentication required for protected endpoints
- File uploads validated for type and size
- Rate limiting on API endpoints
- PII redacted in logs
