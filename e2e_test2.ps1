$base='http://localhost:4001/api/v1'
$mobile='9999999999'
Write-Output '=== REQUEST OTP ==='
$req = Invoke-RestMethod -Uri "$base/auth/request-otp" -Method POST -Body (ConvertTo-Json @{mobile=$mobile}) -ContentType 'application/json'
Write-Output ('OTP_RESPONSE:' + ($req | ConvertTo-Json -Compress))
$otp = $req.demo_otp
if(-not $otp){ Write-Output 'No demo_otp returned, aborting'; exit 1 }
Write-Output ('=== LOGIN with OTP ' + $otp + ' ===')
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body (ConvertTo-Json @{mobile=$mobile; otp=$otp}) -ContentType 'application/json'
Write-Output ('LOGIN_RESPONSE:' + ($login | ConvertTo-Json -Compress))
$token = $login.token
Write-Output ('TOKEN_LEN:' + ($token.Length))

Write-Output '=== CREATE PROFILE ==='
$profileBody = @{ name='E2E Farmer'; state='Maharashtra'; district='Pune'; village='AutoTest'; gps_lat=18.5204; gps_lng=73.8567; land_type='irrigated'; acreage=2.0; main_crops=@('rice'); family_count=4; annual_income=180000; farmer_type='owner'; education_level='secondary'; irrigation_available=$true; loan_status='none'; bank_account_linked=$true; aadhaar_linked=$true; caste_category='general'; livestock=@('Goat'); soil_type='loamy'; water_source='canal'; machinery_owned=@('Tractor') }
$profRes = Invoke-RestMethod -Uri "$base/profile" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body (ConvertTo-Json $profileBody -Depth 6) -ContentType 'application/json'
Write-Output ('PROFILE_RESPONSE:' + ($profRes | ConvertTo-Json -Compress))

$profileId = $profRes.profile.profile_id
Write-Output ('PROFILE_ID:' + $profileId)

Write-Output '=== GET SCHEMES ==='
$schemes = Invoke-RestMethod -Uri "$base/schemes" -Method GET -Headers @{ Authorization = "Bearer $token" }
Write-Output ('SCHEMES_TOTAL:' + $schemes.total_schemes_evaluated)
Write-Output ('FULL_SCHEMES:' + ($schemes | ConvertTo-Json -Compress))
$firstSchemeId = $schemes.recommendations[0].scheme_id
$firstSchemeName = $schemes.recommendations[0].name
Write-Output ('Top scheme id:' + $firstSchemeId)
Write-Output ('Top scheme name:' + $firstSchemeName)

Write-Output '=== SUBMIT APPLICATION ==='
$appPayload = @{ profile_id = $profileId; scheme_id = $firstSchemeId; scheme_name = $firstSchemeName; documents = @(); form_data = @{ name = $profRes.profile.name; state = $profRes.profile.state }; client_timestamp = (Get-Date).ToString('o') }
$appRes = Invoke-RestMethod -Uri "$base/application/submit" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body (ConvertTo-Json $appPayload -Depth 6) -ContentType 'application/json'
Write-Output ('APPLICATION_RESPONSE:' + ($appRes | ConvertTo-Json -Compress))

Write-Output '=== CHATBOT QUERY ==='
$chat = Invoke-RestMethod -Uri "$base/ai/chat" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body (ConvertTo-Json @{message='Which schemes do I qualify for?'; lang='en'} -Depth 4) -ContentType 'application/json'
Write-Output ('CHAT_RESPONSE:' + ($chat | ConvertTo-Json -Compress))
