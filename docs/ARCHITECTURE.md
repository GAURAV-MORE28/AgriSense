# KRISHI-AI Architecture

## System Overview

KRISHI-AI is a microservices-based platform with three main components:

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React PWA)                     │
│  ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐   │
│  │ Landing   │ │ Profile  │ │ Schemes   │ │ Documents/OCR  │   │
│  │ Page      │ │ Wizard   │ │ Results   │ │ Upload         │   │
│  └───────────┘ └──────────┘ └───────────┘ └────────────────┘   │
│  ┌──────────────────┐ ┌──────────────────┐                      │
│  │ Voice Input      │ │ Offline/IndexedDB│                      │
│  │ (Web Speech API) │ │ Sync Manager     │                      │
│  └──────────────────┘ └──────────────────┘                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┴────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                   │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│  │ Auth      │ │ Profile   │ │ Schemes   │ │ Documents │       │
│  │ Service   │ │ Service   │ │ Gateway   │ │ Service   │       │
│  └───────────┘ └───────────┘ └─────┬─────┘ └───────────┘       │
│                                    │                             │
│  ┌───────────────────┐ ┌──────────┴──────────┐                  │
│  │ Mock Gov API      │ │ Sync Manager        │                  │
│  │ (Simulation)      │ │ (Offline Support)   │                  │
│  └───────────────────┘ └─────────────────────┘                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┴────────────────────────────────────┐
│                    ML SERVICE (Python/FastAPI)                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Rules Engine    │ │ Ranking Engine  │ │ OCR Service     │   │
│  │ (YAML-based)    │ │ (Heuristic/ML)  │ │ (Tesseract)     │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Explainability Module                                     │   │
│  │ - Matched/Failed Rules, Confidence Scores, Explanations   │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                        DATA LAYER                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐   │
│  │ PostgreSQL  │ │ Redis       │ │ schemes.yaml            │   │
│  │ (Users,     │ │ (Cache,     │ │ (Rule definitions)      │   │
│  │ Profiles,   │ │ Sessions)   │ │                         │   │
│  │ Apps)       │ │             │ │                         │   │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Scheme Matching Flow
1. User creates profile via frontend
2. Profile sent to backend API
3. Backend forwards to ML Service
4. Rules Engine evaluates all 20 schemes
5. Ranking Engine scores and sorts
6. Explainability module generates reasons
7. Top K recommendations returned with explanations

### OCR Flow
1. User uploads document image
2. Backend sends to ML Service OCR endpoint
3. Tesseract extracts text
4. Regex parsers identify fields (Aadhaar, name, address)
5. Fuzzy matching validates against profile
6. Results returned for user confirmation

### Offline Flow
1. User action stored in IndexedDB
2. Sync queue tracks pending operations
3. On reconnect, batch sync to server
4. Conflict resolution via last-wins or user choice

## Key Design Decisions

1. **YAML-based rules**: Non-developers can modify scheme eligibility
2. **Heuristic ranking**: Deterministic, explainable results
3. **IndexedDB for offline**: Browser-native, no external dependencies
4. **Microservices**: Independent scaling of ML workloads
5. **Mock Government API**: Demonstrates full flow without real integration

## Scaling Considerations

- Frontend: CDN for static assets
- Backend: Horizontal scaling behind load balancer
- ML Service: GPU instances for future ML models
- Database: Read replicas for query load
- Cache: Redis cluster for session and scheme data
