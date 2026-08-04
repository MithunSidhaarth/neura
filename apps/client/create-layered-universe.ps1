# ============================================================
# Mnemosyne - Layered Universe Scaffold
# Run from: apps/client
# ============================================================

$ErrorActionPreference = "Stop"

if (!(Test-Path ".\components\Scene")) {
    Write-Host ""
    Write-Host "ERROR: Run this script from apps/client" -ForegroundColor Red
    exit
}

$scene = ".\components\Scene"

$files = @(
    "BackgroundStars.tsx",
    "DustLayer.tsx",
    "ForegroundLayer.tsx",
    "LayeredUniverse.tsx"
)

foreach($file in $files){

    $path = Join-Path $scene $file

    if(Test-Path $path){

        Write-Host "Skipped (already exists): $file" -ForegroundColor Yellow
        continue

    }

    switch($file){

        "BackgroundStars.tsx" {

@'
"use client";

export default function BackgroundStars(){

    return null;

}
'@ | Set-Content $path -Encoding UTF8

        }

        "DustLayer.tsx" {

@'
"use client";

export default function DustLayer(){

    return null;

}
'@ | Set-Content $path -Encoding UTF8

        }

        "ForegroundLayer.tsx" {

@'
"use client";

export default function ForegroundLayer(){

    return null;

}
'@ | Set-Content $path -Encoding UTF8

        }

        "LayeredUniverse.tsx" {

@'
"use client";

import BackgroundStars from "./BackgroundStars";
import DustLayer from "./DustLayer";
import ParticleField from "./ParticleField";
import ForegroundLayer from "./ForegroundLayer";

export default function LayeredUniverse(){

    return(

        <>

            <BackgroundStars />

            <DustLayer />

            <ParticleField />

            <ForegroundLayer />

        </>

    );

}
'@ | Set-Content $path -Encoding UTF8

        }

    }

    Write-Host "Created: $file" -ForegroundColor Green

}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " Layered Universe Created" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Created files:"
Write-Host " - BackgroundStars.tsx"
Write-Host " - DustLayer.tsx"
Write-Host " - ForegroundLayer.tsx"
Write-Host " - LayeredUniverse.tsx"
Write-Host ""
Write-Host "Next:"
Write-Host "Replace <ParticleField /> with <LayeredUniverse /> in NeuralScene.tsx"