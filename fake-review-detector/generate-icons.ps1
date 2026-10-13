Add-Type -AssemblyName System.Drawing

$outDir = "T:\Studies\nlp prj\fake-review-detector\icons"

foreach ($sz in @(16, 48, 128)) {
    $bmp = New-Object System.Drawing.Bitmap $sz, $sz
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::FromArgb(16, 185, 129))

    $pw = [math]::Max(2, [int]($sz / 8))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $pw)
    $pen.StartCap = 'Round'
    $pen.EndCap = 'Round'
    $pen.LineJoin = 'Round'

    # Draw a checkmark
    $x1 = [int]($sz * 0.25)
    $y1 = [int]($sz * 0.53)
    $x2 = [int]($sz * 0.41)
    $y2 = [int]($sz * 0.69)
    $x3 = [int]($sz * 0.75)
    $y3 = [int]($sz * 0.31)

    $g.DrawLine($pen, $x1, $y1, $x2, $y2)
    $g.DrawLine($pen, $x2, $y2, $x3, $y3)

    $g.Dispose()
    $pen.Dispose()

    $path = Join-Path $outDir "icon$sz.png"
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $path"
}
