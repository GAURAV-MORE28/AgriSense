$base='http://localhost:4001/api/v1'
$mobile='9999999999'
Write-Output 'REQUEST OTP'
$req = Invoke-RestMethod -Uri "$base/auth/request-otp" -Method POST -Body (ConvertTo-Json @{mobile=$mobile}) -ContentType 'application/json'
$otp = $req.demo_otp
Write-Output ('OTP=' + $otp)
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body (ConvertTo-Json @{mobile=$mobile; otp=$otp}) -ContentType 'application/json'
$token = $login.token
Write-Output ('TOKEN_LEN=' + ($token.Length))
Write-Output 'FETCH /schemes FULL RESPONSE'
$schemes = Invoke-RestMethod -Uri "$base/schemes" -Method GET -Headers @{ Authorization = "Bearer $token" }
Write-Output ($schemes | ConvertTo-Json -Compress)
