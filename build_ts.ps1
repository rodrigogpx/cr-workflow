$files = Get-ChildItem -Path 'email-templates' -Filter '*.html' | Where-Object { $_.Name -notmatch '\.min\.html$' }
$out = 'export const defaultEmailTemplates: {templateKey: string, title: string, subject: string, contentB64: string}[] = [];' + [Environment]::NewLine

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    $contentB64 = [Convert]::ToBase64String($bytes)
    $key = $file.BaseName
    
    # Mapear títulos e assuntos (simplificado, podemos ajustar depois)
    $title = $key
    $subject = ""
    
    $out += "defaultEmailTemplates.push({ templateKey: '$key', title: '$title', subject: '$subject', contentB64: '$contentB64' });" + [Environment]::NewLine
}

Set-Content -Path 'server\defaults\emailTemplatesData.ts' -Value $out -Encoding UTF8
Write-Host "Done!"
