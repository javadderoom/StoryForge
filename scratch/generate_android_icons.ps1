Add-Type -AssemblyName System.Drawing

$sourceIcon = 'g:\Code\StoryForge\app\assets\images\app_icon.jpg'
$img = [System.Drawing.Image]::FromFile($sourceIcon)

$sizes = [ordered]@{
  'mipmap-mdpi' = 48
  'mipmap-hdpi' = 72
  'mipmap-xhdpi' = 96
  'mipmap-xxhdpi' = 144
  'mipmap-xxxhdpi' = 192
}

foreach ($folder in $sizes.Keys) {
  $sz = $sizes[$folder]
  $dest = "g:\Code\StoryForge\app\android\app\src\main\res\$folder\ic_launcher.png"
  $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($img, 0, 0, $sz, $sz)
  $g.Dispose()
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Created $dest ($sz x $sz)"
}
$img.Dispose()

# Also save splash art into drawable
$sourceSplash = 'g:\Code\StoryForge\app\assets\images\splash_art.jpg'
$splashDest = 'g:\Code\StoryForge\app\android\app\src\main\res\drawable\splash_art.png'
$sImg = [System.Drawing.Image]::FromFile($sourceSplash)
$sImg.Save($splashDest, [System.Drawing.Imaging.ImageFormat]::Png)
$sImg.Dispose()
Write-Host "Created $splashDest"
