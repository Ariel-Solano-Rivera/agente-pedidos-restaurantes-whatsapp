$ErrorActionPreference = 'Stop'
function Basic([string] $email) {
  $value = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$email`:password"))
  @{ Authorization = "Basic $value" }
}
function Require-Status([int] $expected, [string] $url, [hashtable] $headers) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers
    $status = [int]$response.StatusCode
  } catch {
    $status = [int]$_.Exception.Response.StatusCode
  }
  if ($status -ne $expected) { throw "$url devolvió $status, se esperaba $expected" }
}

$base = 'http://localhost:8080/api/v1'
$admin = Basic 'admin@marazul.test'
$kitchen = Basic 'cocina@marazul.test'
$other = Basic 'admin@sierraverde.test'

Require-Status 200 "$base/me" $admin
Require-Status 200 "$base/menu/dishes" $admin
Require-Status 200 "$base/orders" $kitchen
Require-Status 403 "$base/payments" $kitchen
Require-Status 404 "$base/menu/dishes/11111111-1111-1111-1111-111111111301" $other
$kitchenOrders = Invoke-RestMethod -Uri "$base/orders?size=100" -Headers $kitchen
if (@($kitchenOrders.items | Where-Object { $null -ne $_.total }).Count -gt 0) { throw 'COCINA no debe recibir montos de pedidos' }
Require-Status 404 "$base/orders/11111111-1111-1111-1111-111111112001" $other
Require-Status 200 'http://localhost:8080/actuator/health' @{}
Require-Status 200 'http://localhost:5173' @{}
Write-Host 'Smoke test correcto: autenticacion, permisos, aislamiento y panel disponibles.'
