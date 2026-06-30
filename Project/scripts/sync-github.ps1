param(
  [string]$Message = "",
  [string]$Remote = "origin",
  [string]$Branch = "",
  [string[]]$Pathspec = @("Project", ".ai", "Agent.md", ".gitignore"),
  [switch]$SkipTests,
  [switch]$AllowConfig
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed."
  }
}

function Test-GitSuccess {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & git @Args *> $null
  return $LASTEXITCODE -eq 0
}

function Get-GitOutput {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  $output = & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed."
  }
  return ($output -join "`n").Trim()
}

function Assert-NoInterruptedOperation {
  $gitDir = Get-GitOutput rev-parse --git-dir
  $mergeHead = Join-Path $gitDir "MERGE_HEAD"
  $rebaseMerge = Join-Path $gitDir "rebase-merge"
  $rebaseApply = Join-Path $gitDir "rebase-apply"

  if ((Test-Path $mergeHead) -or (Test-Path $rebaseMerge) -or (Test-Path $rebaseApply)) {
    throw "Git has an unfinished merge or rebase. Please resolve it before running this script again."
  }
}

function Assert-NoUnmergedFiles {
  $unmerged = & git diff --name-only --diff-filter=U
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect unmerged files."
  }
  if ($unmerged) {
    throw "Unmerged files found. Please resolve conflicts before running this script again.`n$($unmerged -join "`n")"
  }
}

if (-not (Test-GitSuccess rev-parse --is-inside-work-tree)) {
  throw "Current directory is not inside a Git repository."
}

$repoRoot = Get-GitOutput rev-parse --show-toplevel
Set-Location $repoRoot

Assert-NoInterruptedOperation
Assert-NoUnmergedFiles

if (-not $Branch) {
  $Branch = Get-GitOutput branch --show-current
}
if (-not $Branch) {
  throw "Unable to detect the current branch. Please pass -Branch explicitly."
}

if (-not $SkipTests) {
  $projectDir = Join-Path $repoRoot "Project"
  if (Test-Path (Join-Path $projectDir "package.json")) {
    Push-Location $projectDir
    try {
      & npm test
      if ($LASTEXITCODE -ne 0) {
        throw "Tests failed. Fix the test failure or rerun with -SkipTests if this is intentional."
      }
    } finally {
      Pop-Location
    }
  }
}

Write-Host "Staging changes..."
Invoke-Git add -- @Pathspec

$staged = & git diff --cached --name-only
if ($LASTEXITCODE -ne 0) {
  throw "Unable to inspect staged changes."
}

$stagedConfig = $staged | Where-Object { $_ -match '(^|/)config.*\.toml$' }
if ($stagedConfig -and -not $AllowConfig) {
  throw "Config files are staged and may contain secrets. Unstage them or rerun with -AllowConfig if this is intentional.`n$($stagedConfig -join "`n")"
}

if ($staged) {
  if (-not $Message) {
    $Message = "Update project $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  }
  Write-Host "Committing changes: $Message"
  Invoke-Git commit -m $Message
} else {
  Write-Host "No staged changes to commit."
}

Write-Host "Fetching $Remote..."
Invoke-Git fetch $Remote

$remoteBranch = "$Remote/$Branch"
$hasRemoteBranch = Test-GitSuccess rev-parse --verify $remoteBranch

if ($hasRemoteBranch) {
  Write-Host "Rebasing local $Branch onto $remoteBranch..."
  Invoke-Git pull --rebase $Remote $Branch
} else {
  Write-Host "Remote branch $remoteBranch does not exist yet. It will be created on push."
}

Assert-NoUnmergedFiles

Write-Host "Pushing $Branch to $Remote..."
Invoke-Git push -u $Remote $Branch

Write-Host "Sync complete."
