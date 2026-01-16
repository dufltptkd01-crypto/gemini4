$port = 8080
$root = "$PSScriptRoot" 
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Server started at http://localhost:$port/"
Write-Host "Opening browser..."
Start-Process "http://localhost:$port/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = $root + $request.Url.LocalPath.Replace('/', '\')
    
    if (Test-Path $path -PathType Container) {
        $path += "index.html"
    }

    if (Test-Path $path -PathType Leaf) {
        $content = [System.IO.File]::ReadAllBytes($path)
        $response.ContentLength64 = $content.Length
        
        switch -Regex ($path) {
            "\.html$" { $response.ContentType = "text/html" }
            "\.css$"  { $response.ContentType = "text/css" }
            "\.js$"   { $response.ContentType = "application/javascript" }
            "\.svg$"  { $response.ContentType = "image/svg+xml" }
            default   { $response.ContentType = "application/octet-stream" }
        }
    } else {
        $response.StatusCode = 404
        $content = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.ContentLength64 = $content.Length
    }

    try {
        $response.OutputStream.Write($content, 0, $content.Length)
    } finally {
        $response.Close()
    }
}
