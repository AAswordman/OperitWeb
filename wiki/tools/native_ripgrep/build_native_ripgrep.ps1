param(
    [string[]]$Targets = @("aarch64-linux-android"),
    [string]$SdkDir = "",
    [int]$ApiLevel = 23
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$crateDir = $PSScriptRoot
$localPropertiesPath = Join-Path $repoRoot "local.properties"

if ([string]::IsNullOrWhiteSpace($SdkDir)) {
    if (Test-Path $localPropertiesPath) {
        $sdkLine = Get-Content $localPropertiesPath | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
        if ($sdkLine) {
            $SdkDir = ($sdkLine -replace '^sdk\.dir=', '') -replace '\\:', ':'
        }
    }
}

if ([string]::IsNullOrWhiteSpace($SdkDir)) {
    $SdkDir = $env:ANDROID_HOME
}
if ([string]::IsNullOrWhiteSpace($SdkDir)) {
    $SdkDir = $env:ANDROID_SDK_ROOT
}
if ([string]::IsNullOrWhiteSpace($SdkDir)) {
    throw "Android SDK path was not found"
}

$ndkRoot = $env:ANDROID_NDK_HOME
if ([string]::IsNullOrWhiteSpace($ndkRoot)) {
    $ndkRoot = $env:ANDROID_NDK_ROOT
}
if ([string]::IsNullOrWhiteSpace($ndkRoot)) {
    $ndkDir = Join-Path $SdkDir "ndk"
    $ndkRoot = Get-ChildItem $ndkDir -Directory |
        Sort-Object { [version]$_.Name } -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if ([string]::IsNullOrWhiteSpace($ndkRoot)) {
    throw "Android NDK path was not found"
}

$toolchainBin = Join-Path $ndkRoot "toolchains\llvm\prebuilt\windows-x86_64\bin"
$targetConfig = @{
    "aarch64-linux-android" = @{ Linker = "aarch64-linux-android$ApiLevel-clang.cmd"; Abi = "arm64-v8a" }
    "armv7-linux-androideabi" = @{ Linker = "armv7a-linux-androideabi$ApiLevel-clang.cmd"; Abi = "armeabi-v7a" }
    "x86_64-linux-android" = @{ Linker = "x86_64-linux-android$ApiLevel-clang.cmd"; Abi = "x86_64" }
    "i686-linux-android" = @{ Linker = "i686-linux-android$ApiLevel-clang.cmd"; Abi = "x86" }
}

foreach ($target in $Targets) {
    if (-not $targetConfig.ContainsKey($target)) {
        throw "Unsupported target: $target"
    }
    rustup target add $target | Out-Host
    $config = $targetConfig[$target]
    $linker = Join-Path $toolchainBin $config.Linker
    if (-not (Test-Path $linker)) {
        throw "Android linker was not found: $linker"
    }

    $envName = "CARGO_TARGET_$($target.ToUpperInvariant().Replace('-', '_'))_LINKER"
    Set-Item -Path "Env:$envName" -Value $linker
    cargo build --manifest-path (Join-Path $crateDir "Cargo.toml") --release --target $target | Out-Host

    $source = Join-Path $crateDir "target\$target\release\liboperit_ripgrep.so"
    $destinationDir = Join-Path $repoRoot "app\src\main\jniLibs\$($config.Abi)"
    New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $destinationDir "liboperit_ripgrep.so") -Force
    Write-Host "Built $target -> $destinationDir\liboperit_ripgrep.so"
}
