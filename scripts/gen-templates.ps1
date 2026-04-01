# gen-templates.ps1 — generates emailTemplatesData.ts from HTML files
# Uses $PSScriptRoot to avoid path encoding issues
$root = Split-Path -Parent $PSScriptRoot
$templatesDir = Join-Path $root 'email-templates'
$outPath = Join-Path $root 'server\defaults\emailTemplatesData.ts'

Write-Host "Root: $root"
Write-Host "Templates dir: $templatesDir"

$ignore = @('agendamento-laudo.html','sinarm_montagem_iniciada.html','process.html','process.min.html','status.html','status.min.html','welcome.min.html')

$fileToKey = @{
  'cadastro_concluido'      = 'cadastro_concluido'
  'welcome'                 = 'welcome'
  'psicotecnico'            = 'psicotecnico'
  'psicotecnico_agendado'   = 'psicotecnico_agendado'
  'psicotecnico_concluido'  = 'psicotecnico_concluido'
  'laudo_tecnico'           = 'laudo_tecnico'
  'laudo_tecnico_concluido' = 'laudo_tecnico_concluido'
  'juntada_documentos'      = 'juntada_documentos'
  'sinarm_iniciado'         = 'sinarm_iniciado'
  'sinarm_protocolado'      = 'sinarm_solicitado'
  'sinarm_aguardando_gru'   = 'sinarm_aguardando_gru'
  'sinarm_em_analise'       = 'sinarm_em_analise'
  'sinarm_restituido'       = 'sinarm_restituido'
  'sinarm_deferido'         = 'sinarm_deferido'
  'sinarm_indeferido'       = 'sinarm_indeferido'
}

$files = Get-ChildItem $templatesDir -Filter '*.html' |
         Where-Object { $_.Name -notin $ignore } |
         Sort-Object Name

$sb = [System.Text.StringBuilder]::new()
$null = $sb.AppendLine('// AUTO-GENERATED -- nao edite manualmente.')
$null = $sb.AppendLine('// Execute: node scripts/generate-email-templates-data.mjs')
$null = $sb.AppendLine('')
$null = $sb.AppendLine('export interface EmailTemplateData {')
$null = $sb.AppendLine('  templateKey: string;')
$null = $sb.AppendLine('  title: string;')
$null = $sb.AppendLine('  contentB64: string; // base64 UTF-8')
$null = $sb.AppendLine('}')
$null = $sb.AppendLine('')
$null = $sb.AppendLine('export const defaultEmailTemplates: EmailTemplateData[] = [')

$first = $true
foreach ($f in $files) {
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
  $key  = if ($fileToKey.ContainsKey($stem)) { $fileToKey[$stem] } else { $stem }
  $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
  $b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))
  if (-not $first) { $null = $sb.AppendLine(',') }
  $first = $false
  $null = $sb.AppendLine('  {')
  $null = $sb.AppendLine("    templateKey: `"$key`",")
  $null = $sb.AppendLine("    title: `"$stem`",")
  $null = $sb.AppendLine("    contentB64: `"$b64`",")
  $null = $sb.Append('  }')
  Write-Host "  v $($f.Name) -> $key ($($content.Length) chars)"
}

$null = $sb.AppendLine('')
$null = $sb.AppendLine('];')
$null = $sb.AppendLine('')

[System.IO.File]::WriteAllText($outPath, $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Host ""
Write-Host "Generated: $outPath ($($files.Count) templates)"
