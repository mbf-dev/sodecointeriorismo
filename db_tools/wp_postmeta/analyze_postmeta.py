import mysql.connector

config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

try:
    cnx = mysql.connector.connect(**config)
    cursor = cnx.cursor()

    print("=== ANÁLISIS DE WP_POSTMETA ===\n")

    # 1. Check for Orphaned Meta (Meta assigned to deleted posts)
    print("1. Buscando Metadatos Huérfanos (sin post asociado)...")
    query_orphans = """
    SELECT COUNT(*) 
    FROM wp_postmeta pm 
    LEFT JOIN wp_posts p ON pm.post_id = p.ID 
    WHERE p.ID IS NULL
    """
    cursor.execute(query_orphans)
    orphans_count = cursor.fetchone()[0]
    
    if orphans_count > 0:
        print(f"[!] Se encontraron {orphans_count} registros huérfanos.")
        print("    Recomendación: Ejecutar limpieza.")
    else:
        print("[OK] No hay metadatos huérfanos.")

    print("\n" + "-"*60 + "\n")

    # 2. Top Meta Keys by Size
    print("2. Distribución por Meta Key (Top 30 por Peso):")
    print(f"{'Meta Key':<50} {'Count':<10} {'Size (MB)':<10}")
    print("-" * 75)
    
    query_keys = """
    SELECT 
        meta_key, 
        COUNT(*) as count, 
        ROUND(SUM(LENGTH(meta_value)) / 1024 / 1024, 2) as size_mb
    FROM wp_postmeta
    GROUP BY meta_key
    ORDER BY size_mb DESC
    LIMIT 30
    """
    cursor.execute(query_keys)
    
    for (key, count, size) in cursor:
        key_display = (key[:47] + '..') if key and len(key) > 47 else key
        size_display = size if size else 0
        print(f"{key_display:<50} {count:<10} {size_display:<10}")

    cursor.close()
    cnx.close()

except mysql.connector.Error as err:
    print(f"Error Database: {err}")
