import mysql.connector

config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

tables_to_optimize = ['wp_posts', 'wp_postmeta']

try:
    cnx = mysql.connector.connect(**config)
    cursor = cnx.cursor()

    print("Configurando modo SQL permisivo para fechas '0000-00-00'...")
    # Allow zero dates for this session
    cursor.execute("SET SESSION sql_mode = 'ALLOW_INVALID_DATES';")
    
    print("-" * 60)

    for table in tables_to_optimize:
        print(f"Optimizando {table} con modo permisivo...", end=" ")
        try:
            # Forcing recreate + analyze manually if optimize still complains in some versions,
            # but usually session mode fix is enough for OPTIMIZE.
            cursor.execute(f"OPTIMIZE TABLE {table}")
            rows = cursor.fetchall()
            status = rows[0][3] if rows else "Unknown"
            print(f"[{status}]")
        except mysql.connector.Error as err:
            print(f"\n[ERROR] Falló optimización de {table}: {err}")

    print("-" * 60)
    print("Verificando nuevo tamaño...")
    
    # Check size again
    cursor.execute("""
    SELECT 
        table_name, 
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb 
    FROM information_schema.TABLES 
    WHERE table_schema = 'sodeco' AND table_name IN ('wp_posts', 'wp_postmeta')
    """)
    
    for (name, size) in cursor:
        print(f"{name}: {size} MB")

    cursor.close()
    cnx.close()

except mysql.connector.Error as err:
    print(f"Error General: {err}")
