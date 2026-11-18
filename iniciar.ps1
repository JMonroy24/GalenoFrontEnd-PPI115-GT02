$ErrorActionPreference = 'Stop'

# Usar siempre esta copia del proyecto, sin depender de la carpeta de la terminal.
Write-Host "Sirviendo el proyecto: $PSScriptRoot"
Write-Host 'Aplicación: http://localhost:3000/src/'
Write-Host 'Pruebas: http://localhost:3000/test/runner.html'
python -m http.server 3000 --directory "$PSScriptRoot"
