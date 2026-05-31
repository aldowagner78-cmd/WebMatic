# WebMatic Desktop — Build para Linux Ubuntu (AppImage)

## Contexto

Quiero buildear la app **WebMatic Desktop** (Electron) para Linux y generar un AppImage instalable en Ubuntu.

El repo es: `https://github.com/aldowagner78-cmd/WebMatic.git` rama `master`

---

## Instrucciones para el agente

### 1. Clonar el repositorio

```bash
git clone https://github.com/aldowagner78-cmd/WebMatic.git
cd WebMatic/webmatic-desktop
```

### 2. Verificar Node.js >= 18

```bash
node --version
```

Si la versión es menor a 18, instalarla:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Instalar dependencias del sistema requeridas por Electron

```bash
sudo apt-get update
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.0-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  fuse \
  libfuse2
```

### 4. Instalar dependencias npm

```bash
npm install
```

### 5. Buildear el AppImage

```bash
npm run dist:linux
```

El resultado estará en:

```
dist-build/WebMatic Desktop-0.1.0.AppImage
```

### 6. Ejecutar el AppImage (opcional — para probar)

```bash
chmod +x "dist-build/WebMatic Desktop-0.1.0.AppImage"
"./dist-build/WebMatic Desktop-0.1.0.AppImage"
```

---

## Qué incluye esta versión (commit ec9cff6, rama master)

- Flash **rojo** (#ef4444) durante grabación y reproducción
- **Smart hover**: solo graba hover si genera nuevo contenido DOM (menú/dropdown)
- **Smart scroll**: solo graba scroll dentro de contenedores tipo menú, no navegación de página
- Barra de favoritos con:
  - Botón **toggle solo-iconos** (oculta etiquetas para ahorrar espacio)
  - Botón **importar desde Chrome/Edge/Brave** (JSON Chromium)
  - Botón **importar desde archivo .html** (formato Firefox/Netscape — para importar `bookmarks.html` con las macros)
  - Botón **exportar a .html**

---

## Notas

- El AppImage es portable: se ejecuta sin instalar, con doble clic o desde terminal.
- El directorio de salida del build es `dist-build/` (no `dist-installer/`).
- Si `dist:linux` no existe en `package.json`, el script es: `electron-builder --linux --x64`
