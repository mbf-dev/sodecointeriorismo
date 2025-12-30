# Lógica Técnica de Eliminación de Huérfanos: Análisis de Seguridad

Este documento detalla la lógica matemática y SQL utilizada en el script `clean_orphans.py` para garantizar **matemáticamente** que solo se eliminen datos basura inservibles.

## 1. El Problema: Integridad Referencial en WordPress
WordPress utiliza una estructura de base de datos relacional donde:
- **`wp_posts`**: Es la tabla "Padre" (contiene entradas, páginas, pedidos, productos).
- **`wp_postmeta`**: Es la tabla "Hija" (contiene atributos, precios, configuraciones).

La relación se define por la columna `wp_postmeta.post_id` que debe apuntar a `wp_posts.ID`.

Cuando se borra un registro en `wp_posts` (por ejemplo, un log de API o un producto), MySQL **no borra automáticamente** los registros hijos en `wp_postmeta` (a menos que haya claves foráneas en cascada, que WordPress no usa por defecto). Esto crea "Huérfanos": hijos que apuntan a un padre fantasma.

## 2. La Sentencia SQL (El "Algoritmo")

El script utiliza exactamente esta sentencia SQL estándar para la limpieza:

```sql
DELETE pm 
FROM wp_postmeta pm 
LEFT JOIN wp_posts p ON pm.post_id = p.ID 
WHERE p.ID IS NULL
```

### Desglose Paso a Paso

#### A. `FROM wp_postmeta pm`
Seleccionamos la tabla de destino donde existen los datos (los metadatos).

#### B. `LEFT JOIN wp_posts p ON pm.post_id = p.ID`
Esta es la operación clave de seguridad.
- El comando `LEFT JOIN` intenta emparejar **cada fila** de `wp_postmeta` con una fila de `wp_posts`.
- La condición es: "Busca en `wp_posts` aquel ID que sea igual a mi `post_id`".

**Resultado del JOIN:**
1.  **Si el post existe:** El sistema encuentra al padre. La columna `p.ID` tendrá un valor (ej: 1240).
2.  **Si el post NO existe:** El sistema falla al encontrar al padre. La columna `p.ID` se rellena con `NULL`.

#### C. `WHERE p.ID IS NULL`
Este es el filtro de seguridad absoluto.
- Le decimos a la base de datos: "Quédate **SOLO** con las filas donde el resultado del emparejamiento fue `NULL`".
- Es decir: "Selecciona solo los metadatos cuyo `post_id` no existe en la tabla de posts".

## 3. Demostración de Seguridad

Imagina estos datos:

**Cenarios:**

1.  **Dato Válido**:
    - `wp_postmeta` tiene un dato con `post_id = 50`.
    - `wp_posts` tiene una fila con `ID = 50` (Título: "Producto A").
    - JOIN: Encuentra el 50.
    - Condición `WHERE ID IS NULL`: **Falso** (50 no es NULL).
    - **Resultado**: El dato SE PROTEGE y NO se borra.

2.  **Huérfano (Basura)**:
    - `wp_postmeta` tiene un dato con `post_id = 9999` (pertenecía a un log borrado).
    - `wp_posts` **NO** tiene ninguna fila con `ID = 9999`.
    - JOIN: No encuentra nada. Devuelve `NULL`.
    - Condición `WHERE ID IS NULL`: **Verdadero**.
    - **Resultado**: El dato SE ELIMINA.

## 4. Conclusión Técnica
Esta lógica no se basa en suposiciones, nombres de claves o fechas. Se basa estrictamente en la **existencia relacional** del ID. Si el script borra algo, es **matemáticamente imposible** que ese dato fuera accesible por WordPress, porque WordPress necesita el `ID` del post padre para buscar sus metadatos. Si el padre no existe, el hijo es inaccesible y, por definición, basura.
