$base='http://localhost:4001/api/v1'
$mobile='9999999999'
$req = Invoke-RestMethod -Uri "$base/auth/request-otp" -Method POST -Body (ConvertTo-Json @{mobile=$mobile}) -ContentType 'application/json'
$otp = $req.demo_otp
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body (ConvertTo-Json @{mobile=$mobile; otp=$otp}) -ContentType 'application/json'
$token = $login.token
Write-Output 'Posting chat message: Find schemes for me'
$chat = Invoke-RestMethod -Uri "$base/ai/chat" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body (ConvertTo-Json @{message='Find schemes for me'; lang='en'} -Depth 4) -ContentType 'application/json'
Write-Output ('CHAT_RESPONSE:' + ($chat | ConvertTo-Json -Compress))
