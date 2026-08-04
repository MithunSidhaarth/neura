# =====================================================
# Mnemosyne Engine Scaffold
# Run inside: apps/client
# =====================================================

$ErrorActionPreference = "Stop"

$root = Get-Location

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Creating Mnemosyne Engine" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------
# Engine Folders
# -----------------------------------------------------

$folders = @(

"engine",

"engine/core",

"engine/renderer",

"engine/simulation",

"engine/shaders",

"engine/shaders/neuron",

"engine/shaders/connection",

"engine/shaders/post",

"engine/particles",

"engine/connections",

"engine/signals",

"engine/cursor",

"engine/camera",

"engine/effects",

"engine/math",

"engine/utils",

"engine/types",

"engine/store"

)

foreach($folder in $folders){

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $folder | Out-Null

    Write-Host "Created Folder : $folder" -ForegroundColor DarkGray

}

# -----------------------------------------------------
# Empty Files
# -----------------------------------------------------

$files = @(

"engine/core/Engine.ts",
"engine/core/Renderer.ts",
"engine/core/Scene.ts",

"engine/renderer/ParticleRenderer.ts",
"engine/renderer/ConnectionRenderer.ts",
"engine/renderer/PostProcessor.ts",

"engine/simulation/ParticleSimulation.ts",
"engine/simulation/CursorSimulation.ts",
"engine/simulation/SignalSimulation.ts",

"engine/particles/Particle.ts",
"engine/particles/ParticleData.ts",
"engine/particles/ParticleGenerator.ts",
"engine/particles/ParticleManager.ts",
"engine/particles/ParticleTypes.ts",

"engine/connections/Connection.ts",
"engine/connections/ConnectionManager.ts",

"engine/signals/Signal.ts",
"engine/signals/SignalManager.ts",

"engine/cursor/Cursor.ts",
"engine/cursor/CursorField.ts",

"engine/camera/CameraController.ts",

"engine/effects/Bloom.ts",
"engine/effects/Fog.ts",

"engine/math/Noise.ts",
"engine/math/SpatialHash.ts",
"engine/math/Vector.ts",

"engine/utils/Random.ts",
"engine/utils/Constants.ts",

"engine/store/EngineStore.ts",

"engine/types/index.ts",

"engine/shaders/neuron/vertex.glsl",
"engine/shaders/neuron/fragment.glsl",

"engine/shaders/connection/vertex.glsl",
"engine/shaders/connection/fragment.glsl",

"engine/shaders/post/post.frag"

)

foreach($file in $files){

    if(!(Test-Path $file)){

        New-Item `
            -ItemType File `
            -Force `
            -Path $file | Out-Null

        Write-Host "Created File   : $file" -ForegroundColor Green

    }

}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Engine Scaffold Complete" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Created Modules:" -ForegroundColor Yellow

Write-Host ""
Write-Host "Core"
Write-Host "Renderer"
Write-Host "Simulation"
Write-Host "Particles"
Write-Host "Connections"
Write-Host "Signals"
Write-Host "Cursor"
Write-Host "Camera"
Write-Host "Shaders"
Write-Host "Effects"
Write-Host "Math"
Write-Host "Utils"
Write-Host "Store"

Write-Host ""
Write-Host "Next Step:"
Write-Host "Build engine/particles/ParticleTypes.ts"
Write-Host ""