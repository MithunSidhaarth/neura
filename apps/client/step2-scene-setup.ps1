# ============================================================
# Mnemosyne - Scene Scaffold Generator
# Safe for Windows PowerShell 5.1 and PowerShell 7+
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Mnemosyne Scene Scaffold" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Verify location
# ------------------------------------------------------------

$client = Get-Location

if (!(Test-Path ".\app")) {
    Write-Host "ERROR: This script must be run inside apps/client" -ForegroundColor Red
    exit
}

# ------------------------------------------------------------
# Create folders
# ------------------------------------------------------------

$folders = @(
    ".\components",
    ".\components\Scene"
)

foreach ($folder in $folders) {

    if (!(Test-Path $folder)) {

        New-Item `
            -ItemType Directory `
            -Force `
            -Path $folder | Out-Null

        Write-Host "Created Folder: $folder"

    }

}

# ------------------------------------------------------------
# Files
# ------------------------------------------------------------

$sceneFiles = @{}

# ============================================================

$sceneFiles[".\components\Scene\NeuralScene.tsx"] = @'
"use client";

import { Canvas } from "@react-three/fiber";
import Universe from "./Universe";

export default function NeuralScene() {

    return (

        <Canvas

            camera={{

                position:[0,0,18],

                fov:55

            }}

            gl={{

                antialias:true,

                alpha:false

            }}

        >

            <Universe />

        </Canvas>

    );

}
'@

# ============================================================

$sceneFiles[".\components\Scene\Universe.tsx"] = @'
"use client";

import { Color } from "three";

export default function Universe(){

    return(

        <>

            <color

                attach="background"

                args={[new Color("#020202")]}

            />

        </>

    );

}
'@

# ============================================================

$sceneFiles[".\components\Scene\CameraRig.tsx"] = @'
"use client";

export default function CameraRig(){

    return null;

}
'@

# ============================================================

$sceneFiles[".\components\Scene\ParticleField.tsx"] = @'
"use client";

export default function ParticleField(){

    return null;

}
'@

# ============================================================

$sceneFiles[".\components\Scene\CursorField.tsx"] = @'
"use client";

export default function CursorField(){

    return null;

}
'@

# ============================================================

$sceneFiles[".\components\Scene\NeuralLinks.tsx"] = @'
"use client";

export default function NeuralLinks(){

    return null;

}
'@

# ============================================================

$sceneFiles[".\components\Scene\Bloom.tsx"] = @'
"use client";

export default function Bloom(){

    return null;

}
'@

# ============================================================

$sceneFiles[".\components\Scene\index.ts"] = @'
export { default } from "./NeuralScene";
'@

# ------------------------------------------------------------
# Write Files
# ------------------------------------------------------------

foreach($file in $sceneFiles.Keys){

    $sceneFiles[$file] | Set-Content $file -Encoding UTF8

    Write-Host "Created File: $file"

}

# ------------------------------------------------------------
# page.tsx
# ------------------------------------------------------------

$page = @'
import NeuralScene from "@/components/Scene";

export default function Home() {

    return <NeuralScene />;

}
'@

$page | Set-Content ".\app\page.tsx" -Encoding UTF8

Write-Host "Created app/page.tsx"

# ------------------------------------------------------------
# globals.css
# ------------------------------------------------------------

$css = @'
*{

    margin:0;
    padding:0;
    box-sizing:border-box;

}

html,
body{

    width:100%;
    height:100%;

    overflow:hidden;

    background:#020202;

    color:white;

    font-family:Inter,sans-serif;

}

body{

    cursor:none;

}

canvas{

    display:block;

}
'@

$css | Set-Content ".\app\globals.css" -Encoding UTF8

Write-Host "Updated globals.css"

# ------------------------------------------------------------
# Done
# ------------------------------------------------------------

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " Scene scaffold completed successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Files created:"
Write-Host ""
Write-Host "components/Scene/"
Write-Host "  NeuralScene.tsx"
Write-Host "  Universe.tsx"
Write-Host "  CameraRig.tsx"
Write-Host "  ParticleField.tsx"
Write-Host "  CursorField.tsx"
Write-Host "  NeuralLinks.tsx"
Write-Host "  Bloom.tsx"
Write-Host "  index.ts"
Write-Host ""
Write-Host "app/page.tsx"
Write-Host "app/globals.css"
Write-Host ""
Write-Host "Next:"
Write-Host "yarn dev"