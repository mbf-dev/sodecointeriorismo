# Herramientas de Optimización de Base de Datos WordPress

Este directorio contiene scripts en Python organizados por categorías para analizar, limpiar y optimizar la base de datos `sodeco`.

## Requisitos
- Python 3.x
- Driver MySQL: `pip install mysql-connector-python`
- Ejecutar los scripts desde la raíz del proyecto (e.g., `python db_tools/wp_posts/analyze_posts.py`)

## Estructura de Directorios

### 📂 `wp_postmeta/` (Metadatos)
Herramientas enfocadas en la tabla más compleja y propensa a ensuciarse.

- **`analyze_postmeta.py`**: Analiza qué plugins llenan la tabla y detecta huérfanos.
- **`clean_orphans.py`**: Elimina registros huérfanos (basura sin padre). 
  - *Seguro: Modo Simulacro por defecto.*
- **`clean_specific_meta.py`**: Elimina claves específicas (e.g., `_imagify_data`). 
  - *Seguro: Modo Simulacro por defecto.*
- **`LOGICA_SEGURIDAD.md`**: Explicación técnica de por qué borrar huérfanos es seguro.

### 📂 `wp_posts/` (Contenido)
Herramientas para la tabla de posts, páginas y logs.

- **`analyze_posts.py`**: Desglosa contenido por tipo y detecta items gigantes.
- **`analyze_fragmentation.py`**: Detecta el "espacio fantasma" (fragmentación) en disco.
- **`force_rebuild.py`**: Reconstruye la tabla `wp_posts` para recuperar espacio fragmentado.

### 📂 `general/` (Mantenimiento Global)
Herramientas que afectan a toda la base de datos.

- **`analyze_db.py`**: Ranking de las tablas más pesadas.
- **`perform_optimization.py`**: Ejecuta `OPTIMIZE TABLE` estándar.
- **`fix_and_optimize.py`**: Intenta optimizar relajando restricciones de fechas SQL.
- **`force_rebuild_2.py`**: Reconstrucción agresiva de múltiples tablas críticas.

## Resumen de Uso
1. **Analizar**: Ejecuta los scripts `analyze_*.py` de cada carpeta.
2. **Limpiar**: Usa los scripts `clean_*.py` en `wp_postmeta/`.
3. **Optimizar**: Si el espacio no baja, usa `force_rebuild.py` en `wp_posts/`.
