$csvContent = Get-Content -Path 'C:\Users\user\Desktop\workspace20\SPPED-AD-TEST\sample\0008000154ncd.csv' | ConvertFrom-Csv
$jsonContent = $csvContent | ConvertTo-Json -Depth 100
$jsonContent | Out-File -FilePath 'C:\Users\user\Desktop\workspace20\SPPED-AD-TEST\sample\0008000154ncd.json' -Encoding UTF8