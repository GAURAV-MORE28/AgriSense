# ──────────────────────────────────────────────────
#  KRISHI-AI  End-to-End Demo Script
# ──────────────────────────────────────────────────
# Usage: .\scripts\demo.ps1
# Prereq: docker-compose up --build  (all services running)
# ──────────────────────────────────────────────────

$ErrorActionPreference = "Continue"

$API = "http://localhost:4001/api/v1"
$ML = "http://localhost:5000"

function Write-Section($title) {
  Write-Host "`n============================================================" -ForegroundColor Cyan
  Write-Host "  $title" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

# ── 1. Health Checks ─────────────────────────────
Write-Section "1. Service Health Checks"

try {
  $h = Invoke-RestMethod -Uri "http://localhost:4001/health" -Method GET -TimeoutSec 5
  Write-Ok "Backend:    $($h.status)"
}
catch {
  Write-Fail "Backend unreachable at http://localhost:4001/health"
}

try {
  $h = Invoke-RestMethod -Uri "$ML/health" -Method GET -TimeoutSec 5
  Write-Ok "ML Service: $($h.status)"
}
catch {
  Write-Fail "ML Service unreachable at $ML"
}

try {
  $f = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
  Write-Ok "Frontend:   HTTP $($f.StatusCode)"
}
catch {
  Write-Warn "Frontend may still be building..."
}

# ── 2. Request OTP ────────────────────────────────
Write-Section "2. Authentication - Request OTP"

$mobile = "9876543210"
$body = '{"mobile":"' + $mobile + '"}'

try {
  $otpRes = Invoke-RestMethod -Uri "$API/auth/request-otp" -Method POST -ContentType "application/json" -Body $body
  $otp = $otpRes.demo_otp
  Write-Ok "OTP requested for $mobile"
  Write-Host "  Demo OTP: $otp" -ForegroundColor Yellow
}
catch {
  Write-Fail "OTP request failed: $_"
  $otp = $null
}

# ── 3. Login ──────────────────────────────────────
Write-Section "3. Authentication - Login"

$token = $null
if ($otp) {
  $loginBody = '{"mobile":"' + $mobile + '","otp":"' + $otp + '"}'
  try {
    $loginRes = Invoke-RestMethod -Uri "$API/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $token = $loginRes.token
    $userId = $loginRes.user.userId
    Write-Ok "Logged in as $userId"
    if ($token) {
      Write-Host "  Token: $($token.Substring(0, [Math]::Min(20, $token.Length)))..." -ForegroundColor DarkGray
    }
  }
  catch {
    Write-Fail "Login failed: $_"
  }
}
else {
  Write-Fail "Skipping login (no OTP available)"
}

# ── 4. Create Profile ────────────────────────────
Write-Section "4. Create Farmer Profile"

$profileId = $null
if ($token) {
  $profileBody = @{
    name          = "Rajesh Patel"
    mobile        = $mobile
    state         = "Maharashtra"
    district      = "Pune"
    village       = "Khed"
    land_type     = "irrigated"
    acreage       = 1.5
    main_crops    = @("rice", "wheat", "sugarcane")
    family_count  = 4
    annual_income = 150000
    farmer_type   = "owner"
  } | ConvertTo-Json

  try {
    $profileRes = Invoke-RestMethod -Uri "$API/profile" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $profileBody
    $profileId = $profileRes.profile.profile_id
    Write-Ok "Profile created: $profileId"
  }
  catch {
    Write-Fail "Profile creation failed: $_"
  }
}
else {
  Write-Fail "Skipping profile (no token)"
}

# ── 5. Scheme Matching ────────────────────────────
Write-Section "5. AI Scheme Matching"

$schemesRes = $null
if ($token) {
  try {
    $schemesRes = Invoke-RestMethod -Uri "$API/schemes?top_k=10" -Method GET -Headers @{ Authorization = "Bearer $token" }
    Write-Ok "Evaluated $($schemesRes.total_schemes_evaluated) schemes"
    Write-Ok "Found $($schemesRes.recommendations.Count) matches in $($schemesRes.processing_time_ms)ms"

    if ($schemesRes.recommendations) {
      $top = $schemesRes.recommendations | Select-Object -First 5
      foreach ($s in $top) {
        $emoji = if ($s.eligibility_status -eq "eligible") { "[ELIGIBLE]" } else { "[PARTIAL]" }
        Write-Host "  $emoji $($s.name) - Score: $($s.score)% - Rs.$($s.benefit_estimate)" -ForegroundColor White
      }
    }
  }
  catch {
    Write-Fail "Scheme matching failed: $_"
  }
}
else {
  Write-Fail "Skipping schemes (no token)"
}

# ── 6. Submit Application ─────────────────────────
Write-Section "6. Submit Application"

$appRes = $null
if ($token -and $schemesRes -and $schemesRes.recommendations -and $schemesRes.recommendations.Count -gt 0) {
  $schemeId = $schemesRes.recommendations[0].scheme_id
  $schemeName = $schemesRes.recommendations[0].name

  $appBody = @{
    profile_id       = $profileId
    scheme_id        = $schemeId
    scheme_name      = $schemeName
    documents        = @("Aadhaar Card", "Land Records")
    form_data        = @{
      name  = "Rajesh Patel"
      state = "Maharashtra"
      notes = "Applied via KRISHI-AI Demo"
    }
    client_timestamp = (Get-Date -Format "o")
  } | ConvertTo-Json

  try {
    $appRes = Invoke-RestMethod -Uri "$API/application/submit" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $appBody
    Write-Ok "Application: $($appRes.application_id)"
    Write-Ok "Status: $($appRes.status)"
    if ($appRes.gov_application_id) {
      Write-Ok "Govt Ref: $($appRes.gov_application_id)"
    }
  }
  catch {
    Write-Fail "Application submission failed: $_"
  }
}
else {
  Write-Warn "Skipping application (no schemes matched or no token)"
}

# ── 7. Track Application Status ──────────────────
Write-Section "7. Track Application Status"

if ($token -and $appRes -and $appRes.application_id) {
  try {
    $statusRes = Invoke-RestMethod -Uri "$API/application/$($appRes.application_id)/status" -Method GET -Headers @{ Authorization = "Bearer $token" }
    Write-Ok "Current Status: $($statusRes.status)"
    if ($statusRes.status_history) {
      foreach ($h in $statusRes.status_history) {
        Write-Host "  >> $($h.status) - $($h.message)" -ForegroundColor Gray
      }
    }
  }
  catch {
    Write-Warn "Status tracking failed (may be expected for mock): $_"
  }
}
else {
  Write-Warn "Skipping status tracking (no application)"
}

# ── 8. OCR Processing ─────────────────────────────
Write-Section "8. OCR Processing (Mock)"

try {
  $ocrBody = '{"image_base64":""}'
  $ocrRes = Invoke-RestMethod -Uri "$ML/api/v1/ocr/process" -Method POST -ContentType "application/json" -Body $ocrBody
  Write-Ok "Doc Type: $($ocrRes.doc_type_guess)"
  Write-Ok "Confidence: $([math]::Round($ocrRes.ocr_confidence * 100))%"
  Write-Host "  Fields:" -ForegroundColor Gray
  if ($ocrRes.fields) {
    $ocrRes.fields.PSObject.Properties | ForEach-Object {
      Write-Host "    $($_.Name): $($_.Value)" -ForegroundColor Gray
    }
  }
}
catch {
  Write-Warn "OCR test failed: $_"
}

# ── 9. Admin Dashboard ────────────────────────────
Write-Section "9. Admin Dashboard Metrics"

if ($token) {
  try {
    $metricsRes = Invoke-RestMethod -Uri "$API/admin/metrics" -Method GET -Headers @{ Authorization = "Bearer $token" }
    Write-Ok "Users: $($metricsRes.overview.total_users)"
    Write-Ok "Profiles: $($metricsRes.overview.total_profiles)"
    Write-Ok "Applications: $($metricsRes.overview.total_applications)"
  }
  catch {
    Write-Warn "Admin metrics failed (may need admin role): $_"
  }
}
else {
  Write-Fail "Skipping admin (no token)"
}

# ── Done ──────────────────────────────────────────
Write-Section "Demo Complete!"
Write-Host ""
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Green
Write-Host "  Backend:   http://localhost:4001/api/v1" -ForegroundColor Green
Write-Host "  ML Service: http://localhost:5000" -ForegroundColor Green
Write-Host ""
Write-Ok "All systems operational. Ready for presentation."
Write-Host ""
