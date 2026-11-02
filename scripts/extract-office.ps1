param([Parameter(Mandatory=$true)][string]$ProjectRoot)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$items = Get-Content -LiteralPath (Join-Path $projectRoot 'source_manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$outDir = Join-Path $projectRoot 'corpus'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$word = $null
$ppt = $null
function Read-Shape($shape) {
    $parts = [System.Collections.Generic.List[string]]::new()
    if ($shape.Type -eq 6) { foreach ($sub in $shape.GroupItems) { $parts.Add((Read-Shape $sub)) } }
    elseif ($shape.HasTable -eq -1) {
        for ($r=1; $r -le $shape.Table.Rows.Count; $r++) {
            $cells = for ($c=1; $c -le $shape.Table.Columns.Count; $c++) { $shape.Table.Cell($r,$c).Shape.TextFrame.TextRange.Text }
            $parts.Add(($cells -join ' | '))
        }
    }
    elseif ($shape.HasTextFrame -eq -1) { if ($shape.TextFrame.HasText -eq -1) { $parts.Add($shape.TextFrame.TextRange.Text) } }
    return ($parts -join "`n")
}
try {
    foreach ($item in $items) {
        if ([System.IO.Path]::GetExtension($item.path).ToLowerInvariant() -notin @('.ppt','.pptx','.doc','.docx')) { continue }
        if ($item.id -notmatch '^[a-z0-9_]+$') { throw 'Invalid source id' }
        $inputPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $item.path))
        if (-not $inputPath.StartsWith($projectRoot.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Source must stay inside project' }
        $outPath = Join-Path $outDir ($item.id + '.md')
        if (Test-Path -LiteralPath $outPath) { continue }
        $text = [System.Text.StringBuilder]::new()
        [void]$text.AppendLine('# ' + $item.name)
        [void]$text.AppendLine('原文件：' + $item.original_path)
        if ([System.IO.Path]::GetExtension($item.path).ToLowerInvariant() -in @('.ppt','.pptx')) {
            if (-not $ppt) { $ppt = New-Object -ComObject PowerPoint.Application; $ppt.AutomationSecurity = 3 }
            $deck = $ppt.Presentations.Open($inputPath, -1, 0, 0)
            try {
                foreach ($slide in $deck.Slides) {
                    [void]$text.AppendLine("`n## 第 $($slide.SlideIndex) 页")
                    foreach ($shape in $slide.Shapes) { $s = Read-Shape $shape; if ($s) { [void]$text.AppendLine($s.Replace([char]13,[char]10).Replace([char]11,[char]10)) } }
                }
            } finally { $deck.Close() }
        } else {
            if (-not $word) { $word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0; $word.AutomationSecurity = 3 }
            $doc = $word.Documents.Open($inputPath, $false, $true, $false)
            try { [void]$text.AppendLine($doc.Content.Text.Replace([char]13,[char]10).Replace([char]7,' ')) } finally { $doc.Close(0) }
        }
        [System.IO.File]::WriteAllText($outPath,$text.ToString(),[System.Text.UTF8Encoding]::new($false))
        Write-Output ($item.id + ' ' + $item.name + ' ' + $text.Length + ' chars')
    }
} finally { if ($word) { $word.Quit() }; if ($ppt) { $ppt.Quit() } }
