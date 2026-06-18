# Task_Dashbord クリーンアップ起動スクリプト
# 古いプロセスとポートを完全にクリアしてから起動する

Write-Host "[1] 既存のPythonプロセスを終了..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  PID $($_.Id) を終了"
    Stop-Process -Id $_.Id -Force
}

Write-Host "[2] ポート8001の使用プロセスを終了..." -ForegroundColor Yellow
$pids = netstat -ano | findstr ":8001" | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
foreach ($p in $pids) {
    if ($p -match '^\d+$' -and $p -ne '0') {
        Write-Host "  PID $p を終了 (port 8001)"
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep 2

Write-Host "[3] ポート確認..." -ForegroundColor Yellow
$check = netstat -ano | findstr ":8001"
if ($check) {
    Write-Host "  警告: ポート8001がまだ使用中" -ForegroundColor Red
    Write-Host $check
} else {
    Write-Host "  ポート8001 クリア OK" -ForegroundColor Green
}

Write-Host "[4] バックエンド起動..." -ForegroundColor Yellow
Start-Process python -ArgumentList "app.py" -WorkingDirectory "C:\Users\yoshi\OneDrive\ドキュメント\Task_Dashbord\backend"
Start-Sleep 5

Write-Host "[5] 起動確認..." -ForegroundColor Yellow
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/tasks/" -TimeoutSec 10
    Write-Host "  バックエンド起動OK" -ForegroundColor Green
} catch {
    Write-Host "  バックエンド未起動（Electronから起動する場合はそちらで確認）" -ForegroundColor Red
}

Write-Host "`n完了。Electronを起動してください。" -ForegroundColor Cyan
