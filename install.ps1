<#
.SYNOPSIS
Downloads, verifies, and installs a Prime Agent release with npm.

.DESCRIPTION
Resolves the stable or beta release manifest, or installs an explicit version.
The release tarball is checked against SHA256SUMS before npm installs it globally.
Node.js 22.8.0 or newer and npm must already be installed.

.PARAMETER Target
Release channel (stable or beta) or an explicit version such as 0.9.4 or v0.9.4.
Defaults to the release channel configured in the published installer.

.PARAMETER Force
Skips the interactive install confirmation.

.PARAMETER SkipPythonRuntime
Defers Python runtime setup until Prime Agent first needs it.

.EXAMPLE
.\install.ps1 stable

.EXAMPLE
.\install.ps1 beta -Force

.EXAMPLE
.\install.ps1 v0.9.4 -SkipPythonRuntime
#>
#requires -Version 7.0
[CmdletBinding()]
param(
	[Parameter(Position = 0)]
	[string] $Target,

	[switch] $Force,

	[switch] $SkipPythonRuntime
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$LASTEXITCODE = 0

$UnconfiguredBaseUrl = "__PRIME_AGENT_DOWNLOAD_BASE" + "_URL__"
$UnconfiguredDefaultChannel = "__PRIME_AGENT_DEFAULT_RELEASE_" + "CHANNEL__"
$ConfiguredBaseUrl = "__PRIME_AGENT_DOWNLOAD_BASE_URL__"
$ConfiguredDefaultChannel = "__PRIME_AGENT_DEFAULT_RELEASE_CHANNEL__"
$PackageName = "prime-agent"
$CommandName = "prime-agent"
$MinimumNodeVersion = [version] "22.8.0"
$TemporaryDirectory = $null

function Get-NormalizedVersion {
	param([Parameter(Mandatory)][string] $Value)

	$Normalized = $Value.Trim()
	if ($Normalized.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
		$Normalized = $Normalized.Substring(1)
	}
	if (-not $Normalized -or $Normalized -notmatch '^[0-9A-Za-z.-]+$') {
		throw "Invalid Prime Agent version: $Value"
	}
	return $Normalized
}

function Get-DownloadBaseUrl {
	$Value = if ($env:PRIME_AGENT_DOWNLOAD_BASE_URL) {
		$env:PRIME_AGENT_DOWNLOAD_BASE_URL
	} else {
		$ConfiguredBaseUrl
	}
	$Value = $Value.Trim().TrimEnd('/')
	if (-not $Value -or $Value -eq $UnconfiguredBaseUrl) {
		throw "Installer download URL is not configured. Set PRIME_AGENT_DOWNLOAD_BASE_URL or use a published installer."
	}

	$Uri = $null
	if (-not [uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref] $Uri) -or $Uri.Scheme -notin @("http", "https")) {
		throw "PRIME_AGENT_DOWNLOAD_BASE_URL must be an absolute HTTP or HTTPS URL."
	}
	return $Value
}

function Receive-File {
	param(
		[Parameter(Mandatory)][string] $Url,
		[Parameter(Mandatory)][string] $Destination
	)

	Write-Host "Downloading $Url"
	Invoke-WebRequest -Uri $Url -OutFile $Destination -MaximumRedirection 5 -TimeoutSec 120
}

function Get-ChannelRelease {
	param(
		[Parameter(Mandatory)][ValidateSet("stable", "beta")][string] $Channel,
		[Parameter(Mandatory)][string] $BaseUrl,
		[Parameter(Mandatory)][string] $DestinationDirectory
	)

	$ManifestName = if ($Channel -eq "stable") { "latest.json" } else { "beta.json" }
	$ManifestPath = Join-Path $DestinationDirectory $ManifestName
	Receive-File -Url "$BaseUrl/$ManifestName" -Destination $ManifestPath
	try {
		$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
	} catch {
		throw "Release manifest $ManifestName is not valid JSON: $($_.Exception.Message)"
	}

	if (-not $Manifest.version) {
		throw "Release manifest $ManifestName does not contain a version."
	}
	$Version = Get-NormalizedVersion ([string] $Manifest.version)
	$ExpectedTarball = "releases/v$Version/$PackageName-$Version.tgz"
	if ([string] $Manifest.package -ne $PackageName -or [string] $Manifest.tarball -ne $ExpectedTarball) {
		throw "Release manifest $ManifestName does not describe the expected $PackageName tarball."
	}

	$TarballEntry = @($Manifest.tarballs) | Where-Object {
		[string] $_.package -eq $PackageName -and [string] $_.file -eq "$PackageName-$Version.tgz"
	}
	if ($TarballEntry.Count -ne 1 -or [string] $TarballEntry[0].sha256 -notmatch '^[0-9A-Fa-f]{64}$') {
		throw "Release manifest $ManifestName does not contain one valid checksum for $PackageName-$Version.tgz."
	}

	return [pscustomobject] @{
		Version = $Version
		ManifestSha256 = ([string] $TarballEntry[0].sha256).ToLowerInvariant()
	}
}

function Get-ChecksumFromSums {
	param(
		[Parameter(Mandatory)][string] $ChecksumPath,
		[Parameter(Mandatory)][string] $FileName
	)

	$Pattern = '(?im)^([0-9a-f]{64})\s+\*?' + [regex]::Escape($FileName) + '\r?$'
	$Matches = [regex]::Matches((Get-Content -LiteralPath $ChecksumPath -Raw), $Pattern)
	if ($Matches.Count -ne 1) {
		throw "SHA256SUMS must contain exactly one checksum for $FileName."
	}
	return $Matches[0].Groups[1].Value.ToLowerInvariant()
}

function Assert-NodeAndNpm {
	$Node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
	$Npm = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
	if (-not $Npm) {
		$Npm = Get-Command npm -ErrorAction SilentlyContinue | Where-Object CommandType -In @("Application", "ExternalScript") | Select-Object -First 1
	}
	if (-not $Node) {
		throw "Node.js $MinimumNodeVersion or newer is required. Install Node.js, then run this installer again."
	}
	if (-not $Npm) {
		throw "npm is required. Install npm, then run this installer again."
	}

	$NodeVersionText = (& $Node.Source --version | Select-Object -First 1)
	if ($LASTEXITCODE -ne 0 -or -not $NodeVersionText) {
		throw "Could not determine the installed Node.js version."
	}
	try {
		$NodeVersion = [version] $NodeVersionText.Trim().TrimStart('v')
	} catch {
		throw "Could not parse the installed Node.js version: $NodeVersionText"
	}
	if ($NodeVersion -lt $MinimumNodeVersion) {
		throw "Prime Agent requires Node.js $MinimumNodeVersion or newer. Found $NodeVersionText."
	}
	return $Npm
}

function Test-InteractiveConsole {
	try {
		return -not [Console]::IsInputRedirected
	} catch {
		return $false
	}
}

function Invoke-PrimeAgentNpmInstall {
	param(
		[Parameter(Mandatory)] $NpmCommand,
		[Parameter(Mandatory)][string] $TarballPath
	)

	$VariableNames = @(
		"PRIME_AGENT_BOOTSTRAP_TOOLS_ON_INSTALL",
		"PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL",
		"PRIME_AGENT_INSTALL_UV"
	)
	$SavedEnvironment = @{}
	foreach ($Name in $VariableNames) {
		$SavedEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, "Process")
	}

	try {
		$env:PRIME_AGENT_BOOTSTRAP_TOOLS_ON_INSTALL = "1"
		$env:PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL = if ($SkipPythonRuntime) { "0" } else { "1" }
		$env:PRIME_AGENT_INSTALL_UV = if ($SkipPythonRuntime) { "0" } else { "1" }

		$NpmVersionText = (& $NpmCommand.Source --version | Select-Object -First 1)
		if ($LASTEXITCODE -ne 0 -or $NpmVersionText -notmatch '^(\d+)\.') {
			throw "Could not determine the installed npm version."
		}
		$Arguments = @("install", "-g", "--no-fund", "--no-audit", "--loglevel=error", "--progress=false")
		if ([int] $Matches[1] -ge 12) {
			$Arguments += @("--allow-remote=all", "--allow-scripts=$TarballPath")
		}
		$Arguments += $TarballPath

		Write-Host "Installing Prime Agent globally with npm..."
		& $NpmCommand.Source @Arguments
		if ($LASTEXITCODE -ne 0) {
			throw "npm install failed with exit code $LASTEXITCODE."
		}
	} finally {
		foreach ($Name in $VariableNames) {
			[Environment]::SetEnvironmentVariable($Name, $SavedEnvironment[$Name], "Process")
		}
	}
}

try {
	$BaseUrl = Get-DownloadBaseUrl
	$NpmCommand = Assert-NodeAndNpm

	$DefaultChannel = if ($ConfiguredDefaultChannel -eq $UnconfiguredDefaultChannel) {
		"stable"
	} else {
		$ConfiguredDefaultChannel.Trim()
	}
	$RequestedTarget = if ($PSBoundParameters.ContainsKey("Target")) {
		$Target
	} elseif ($env:PRIME_AGENT_VERSION) {
		$env:PRIME_AGENT_VERSION
	} elseif ($env:PRIME_AGENT_RELEASE_CHANNEL) {
		$ReleaseChannel = $env:PRIME_AGENT_RELEASE_CHANNEL.Trim()
		if ($ReleaseChannel -notin @("stable", "beta")) {
			throw "Invalid Prime Agent release channel: $ReleaseChannel"
		}
		$ReleaseChannel
	} else {
		if ($DefaultChannel -notin @("stable", "beta")) {
			throw "Invalid configured Prime Agent release channel: $DefaultChannel"
		}
		$DefaultChannel
	}
	if ($null -ne $RequestedTarget) {
		$RequestedTarget = $RequestedTarget.Trim()
	}
	if (-not $RequestedTarget) {
		throw "Target must be stable, beta, or an explicit version."
	}

	$TemporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("prime-agent-install-" + [guid]::NewGuid().ToString("N"))
	New-Item -ItemType Directory -Path $TemporaryDirectory | Out-Null

	$ManifestSha256 = $null
	if ($RequestedTarget -in @("stable", "beta")) {
		$Release = Get-ChannelRelease -Channel $RequestedTarget -BaseUrl $BaseUrl -DestinationDirectory $TemporaryDirectory
		$Version = $Release.Version
		$ManifestSha256 = $Release.ManifestSha256
	} else {
		$Version = Get-NormalizedVersion $RequestedTarget
	}

	$TarballName = "$PackageName-$Version.tgz"
	$ReleaseBaseUrl = "$BaseUrl/releases/v$Version"
	$ChecksumsPath = Join-Path $TemporaryDirectory "SHA256SUMS"
	$TarballPath = Join-Path $TemporaryDirectory $TarballName
	Receive-File -Url "$ReleaseBaseUrl/SHA256SUMS" -Destination $ChecksumsPath
	Receive-File -Url "$ReleaseBaseUrl/$TarballName" -Destination $TarballPath

	$ExpectedSha256 = Get-ChecksumFromSums -ChecksumPath $ChecksumsPath -FileName $TarballName
	if ($ManifestSha256 -and $ManifestSha256 -ne $ExpectedSha256) {
		throw "The release manifest and SHA256SUMS disagree for $TarballName."
	}
	$ActualSha256 = (Get-FileHash -LiteralPath $TarballPath -Algorithm SHA256).Hash.ToLowerInvariant()
	if ($ActualSha256 -ne $ExpectedSha256) {
		throw "SHA-256 verification failed for $TarballName."
	}
	Write-Host "Verified $TarballName ($ActualSha256)."

	if (-not $Force -and (Test-InteractiveConsole)) {
		$Answer = Read-Host "Install Prime Agent v$Version globally with npm? [Y/n]"
		if ($Answer -match '^(n|no)$') {
			Write-Host "Installation cancelled."
			return
		}
	}

	Invoke-PrimeAgentNpmInstall -NpmCommand $NpmCommand -TarballPath $TarballPath
	Write-Host "Prime Agent v$Version was installed successfully."

	if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
		Write-Host "Run it with: $CommandName"
	} else {
		$GlobalPrefix = (& $NpmCommand.Source prefix -g | Select-Object -First 1)
		if ($LASTEXITCODE -eq 0 -and $GlobalPrefix) {
			Write-Warning "$CommandName is not on PATH. Add npm's global command directory to your user PATH: $($GlobalPrefix.Trim())"
		} else {
			Write-Warning "$CommandName is not on PATH. Run 'npm prefix -g' and add that directory to your user PATH."
		}
		Write-Host "Open a new PowerShell window after updating PATH."
	}
} catch {
	throw "Prime Agent installation failed: $($_.Exception.Message)"
} finally {
	if ($TemporaryDirectory -and (Test-Path -LiteralPath $TemporaryDirectory)) {
		Remove-Item -LiteralPath $TemporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
	}
}
