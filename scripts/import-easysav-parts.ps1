param(
  [string]$ModelsFile = "..\saunier-duval-models.js",
  [string]$OutputFile = "..\saunier-duval-parts-by-model.js"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$modelsPath = Resolve-Path (Join-Path $PSScriptRoot $ModelsFile)
$outputPath = Join-Path $PSScriptRoot $OutputFile

function Convert-ToModelSlug([string]$name) {
  $slug = $name.ToLowerInvariant()
  $slug = $slug -replace "([0-9])([a-z])", '$1-$2'
  $slug = $slug -replace "([a-z])([0-9])", '$1-$2'
  $slug = $slug -replace "[^a-z0-9]+", "-"
  return $slug.Trim("-")
}

function Convert-ToModelKey([string]$name) {
  $normalized = $name.ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
  $withoutMarks = [regex]::Replace($normalized, "\p{Mn}", "")
  return ($withoutMarks -replace "[^a-z0-9]", "")
}

function Convert-ToJsString([string]$value) {
  return ($value | ConvertTo-Json -Compress)
}

$rawModels = Get-Content -LiteralPath $modelsPath -Raw
$jsonModels = $rawModels -replace "(?s)^.*?=\s*", "" -replace ";\s*$", ""
$models = $jsonModels | ConvertFrom-Json
$allParts = [ordered]@{}
$headers = @{
  "User-Agent" = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
}
$officialUrls = @{}
$manualUrls = @{}
$stats = [ordered]@{
  totalModels = $models.Count
  modelsWithParts = 0
  totalParts = 0
  officialUrlMatches = 0
  failed = @()
}

try {
  $indexResponse = Invoke-WebRequest -UseBasicParsing -Headers $headers "https://easysav.com/chaudieres/saunier-duval"
  $indexHtml = [System.Net.WebUtility]::HtmlDecode($indexResponse.Content)
  $modelMatches = [regex]::Matches(
    $indexHtml,
    "(?is)<a[^>]+href=`"(?<url>/marques/saunier-duval/[^`"]+)`"[^>]*>.*?<span[^>]*class=`"[^`"]*text-base[^`"]*`"[^>]*>(?<name>[^<]+)</span>"
  )

  foreach ($match in $modelMatches) {
    $name = ($match.Groups["name"].Value -replace "\s+", " ").Trim()
    $url = $match.Groups["url"].Value.Trim()
    if ($name -and $url) {
      $officialUrls[(Convert-ToModelKey $name)] = "https://easysav.com$url/pieces-detachees"
    }
  }
} catch {
  $stats.failed += [ordered]@{
    model = "INDEX CHAUDIERES SAUNIER DUVAL"
    url = "https://easysav.com/chaudieres/saunier-duval"
    error = $_.Exception.Message
  }
}

$manualUrls[(Convert-ToModelKey "HELIOTWIN CONDENS F24 150.01")] = @("https://easysav.com/marques/saunier-duval/heliotwin-condens-f24-150-1-es-fr-0010014604/pieces-detachees")
$manualUrls[(Convert-ToModelKey "ISOMAX CONDENS F 30 B (N-P)")] = @("https://easysav.com/marques/saunier-duval/isomax-condens-f-30-b-p-fr-0010007950/pieces-detachees")
$manualUrls[(Convert-ToModelKey "THEMAPLUS CONDENS 30 A 2015 2016")] = @("https://easysav.com/marques/saunier-duval/themaplus-condens-30-a-h-fr-0010017388/pieces-detachees")
$manualUrls[(Convert-ToModelKey "THEMAPLUS CONDENS 30 B 2015 2016")] = @("https://easysav.com/marques/saunier-duval/themaplus-condens-30-b-h-fr-0010017424/pieces-detachees")
$manualUrls[(Convert-ToModelKey "THEMAPLUS CONDENS F25 A RT")] = @("https://easysav.com/marques/saunier-duval/themaplus-condens-25-a-h-fr-0010017387/pieces-detachees")
$manualUrls[(Convert-ToModelKey "THEMIS AS 23 ENTRE 1995 ET 1996")] = @("https://easysav.com/marques/saunier-duval/themis-as-23-entre-95-et-96/pieces-detachees")

$officialItems = foreach ($key in $officialUrls.Keys) {
  [pscustomobject]@{
    key = $key
    url = $officialUrls[$key]
  }
}

foreach ($model in $models) {
  $slug = Convert-ToModelSlug $model
  $modelKey = Convert-ToModelKey $model
  $urls = @()

  if ($manualUrls[$modelKey]) {
    $urls = $manualUrls[$modelKey]
  } else {
    $url = $officialUrls[$modelKey]
    if (-not $url) {
      $candidate = $officialItems |
        Where-Object { $_.key.StartsWith($modelKey) -or $modelKey.StartsWith($_.key) } |
        Sort-Object @{ Expression = { [Math]::Abs($_.key.Length - $modelKey.Length) } } |
        Select-Object -First 1
      if ($candidate) {
        $url = $candidate.url
      }
    }
    if ($url) {
      $stats.officialUrlMatches += 1
      $urls = @($url)
    } else {
      $urls = @("https://easysav.com/marques/saunier-duval/$slug/pieces-detachees")
    }
  }

  $parts = New-Object System.Collections.Generic.List[object]
  $seen = New-Object System.Collections.Generic.HashSet[string]

  foreach ($url in $urls) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Headers $headers $url
      $html = [System.Net.WebUtility]::HtmlDecode($response.Content)
      $matches = [regex]::Matches(
        $html,
        "(?is)<a[^>]+href=`"[^`"]*/piece-detachee/[^`"]*?-(?<number>[a-z0-9]+)-(?<dispart>\d{6,8})`".*?<span[^>]*>Num.ro d.article\s+[^<]+</span>\s*<span[^>]*>(?<name>[^<]+)</span>"
      )

      foreach ($match in $matches) {
        $number = $match.Groups["number"].Value.Trim()
        $dispart = $match.Groups["dispart"].Value.Trim()
        $name = ($match.Groups["name"].Value -replace "\s+", " ").Trim()
        if (-not $name) { continue }
        if (-not $seen.Add($number.ToLowerInvariant())) { continue }

        $parts.Add([ordered]@{
          number = $number
          name = $name
          dispart = $dispart
        })
      }
    } catch {
      $stats.failed += [ordered]@{
        model = $model
        url = $url
        error = $_.Exception.Message
      }
    }

    Start-Sleep -Milliseconds 150
  }

  if ($parts.Count) {
    $allParts[$model] = $parts
    $stats.modelsWithParts += 1
    $stats.totalParts += $parts.Count
  }
}

$json = $allParts | ConvertTo-Json -Depth 8
$content = "globalThis.SAUNIER_DUVAL_PARTS_BY_MODEL = $json;`n"
Set-Content -LiteralPath $outputPath -Value $content -Encoding UTF8

$stats | ConvertTo-Json -Depth 5
