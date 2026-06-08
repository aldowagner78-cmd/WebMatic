# Prompt para agente Linux: copia exacta local de WebMatic

Quiero que actúes como agente técnico en Linux y dejes mi repo local **exactamente igual** al remoto de GitHub.

## Contexto
- Repo remoto: https://github.com/aldowagner78-cmd/WebMatic.git
- Rama objetivo: master
- Tengo una copia local desactualizada en otra PC Linux.
- Objetivo: copia local idéntica al remoto actual (sin diferencias en tracked files).

## Reglas de trabajo
1. Muestra cada comando antes de ejecutarlo.
2. Si detectas cambios locales sin commitear, **no los borres sin confirmación**.
3. Si necesitas operación destructiva (reset/clean), primero pide confirmación explícita.
4. Al final, valida y demuestra que quedó idéntico al remoto.

## Flujo requerido

### Fase 1: Diagnóstico
Ejecuta y muestra salida:
- `pwd`
- `git rev-parse --is-inside-work-tree`
- `git remote -v`
- `git branch --show-current`
- `git status --short`

Si no está clonado el repo correcto, ve a la Fase 3 (clonado limpio).

### Fase 2: Sincronizar repo existente (con confirmación si es destructivo)
1. Actualiza referencias remotas:
- `git fetch --all --prune`

2. Compara estado local vs remoto:
- `git rev-parse HEAD`
- `git rev-parse origin/master`
- `git status --short`

3. Si hay cambios locales o archivos extra:
- Pídeme confirmación y luego ejecuta:
  - `git reset --hard origin/master`
  - `git clean -fdx`

4. Si no hay cambios locales, solo alinea rama:
- `git checkout master`
- `git reset --hard origin/master`

### Fase 3: Clonado limpio (si no existe repo válido)
En caso de repo inexistente o dañado:
1. Crear carpeta destino (si no existe).
2. Clonar:
- `git clone https://github.com/aldowagner78-cmd/WebMatic.git`
3. Entrar al repo:
- `cd WebMatic`
4. Garantizar rama/estado:
- `git checkout master`
- `git fetch --all --prune`
- `git reset --hard origin/master`
- `git clean -fdx`

### Fase 4: Verificación obligatoria
Ejecuta y muestra salida final:
- `git status --short`
- `git rev-parse HEAD`
- `git rev-parse origin/master`
- `git log --oneline -n 1`

Condición de éxito:
- `git status --short` vacío.
- `HEAD` igual a `origin/master`.

## Entrega final esperada
Devuélveme un resumen corto con:
1. Ruta local final del repo.
2. Commit final aplicado.
3. Confirmación de que quedó idéntico al remoto.
4. Si hubo limpieza destructiva, indica que fue confirmada por mí.
