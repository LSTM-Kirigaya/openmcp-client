# Create resources directory if it doesn't exist
New-Item -ItemType Directory -Force -Path .\resources | Out-Null

# Start both build tasks in parallel
$jobs = @(
    Start-Job -ScriptBlock {
        Set-Location $using:PWD\renderer
        npm run build
        Move-Item -Force -Path .\dist -Destination ..\resources\renderer
    }
    Start-Job -ScriptBlock {
        Set-Location $using:PWD\service
        npm run build
        Move-Item -Force -Path .\dist -Destination ..\resources\service
    }
)

# Wait for all jobs to complete
Wait-Job -Job $jobs | Out-Null
Receive-Job -Job $jobs
Remove-Job -Job $jobs

Write-Host "finish building services in ./resources"
