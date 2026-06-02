# Prompt para el agente de Windows

Copiá y pegá esto en el chat de GitHub Copilot en VS Code (Windows):

---

Necesito que configures la extensión de navegador WebMatic en esta PC con Windows. Solo trabajamos con la extensión, no con ninguna app de escritorio. Seguí exactamente estos pasos:

**1. Clonar el repositorio**
Abrí una terminal en la carpeta donde querés el proyecto y ejecutá:

```
git clone https://github.com/aldowagner78-cmd/WebMatic.git
cd WebMatic
```

**2. Instalar dependencias**

```
npm install
```

**3. Instalar la extensión en Chrome o Edge**

- Abrí Chrome/Edge → ir a `chrome://extensions` (o `edge://extensions`)
- Activar "Modo desarrollador"
- Clic en "Cargar extensión sin empaquetar"
- Seleccionar la carpeta raíz del proyecto: `WebMatic/` (la que contiene `manifest.json`)

**4. Verificar que los tests pasan**

```
npm test
```

Deben pasar 80/80.

**5. Crear un script de sincronización**
Creá el archivo `WebMatic/sync.bat` con este contenido:

```bat
@echo off
cd /d %~dp0
git pull
echo.
echo Cambios sincronizados. Recarga la extension en chrome://extensions
pause
```

Este script se usa cada vez que quiero traer cambios: doble clic en `sync.bat` → pullea → recargar la extensión en `chrome://extensions`.

**Verificación final**

- La extensión debe aparecer activa en el navegador
- `npm test` debe mostrar `# pass 80` y `# fail 0`
