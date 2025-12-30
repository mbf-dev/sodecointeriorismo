import mysql.connector

config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

tables_to_rebuild = ['wp_posts']

try:
    cnx = mysql.connector.connect(**config)
    cursor = cnx.cursor()
    
    print("Conectado. Intentando reconstrucción forzada de tablas (ALTER TABLE... FORCE).")
    print("Esto obliga a MySQL a copiar los datos a una nueva tabla limpia y borrar la vieja.")

    # Allow zero dates just in case
    cursor.execute("SET SESSION sql_mode = 'ALLOW_INVALID_DATES';")

    for table in tables_to_rebuild:
        print(f"Reconstruyendo {table}...", end=" ")
        try:
            # This is the "nuclear" option for reclaim
            cursor.execute(f"ALTER TABLE {table} FORCE")
            print("[OK]")
        except mysql.connector.Error as err:
            print(f"\n[ERROR] {err}")
            
    print("-" * 60)
    print("Actualizando estadísticas...")
    cursor.execute("ANALYZE TABLE wp_posts")
    cursor.fetchall() # Retrieve results to clear buffer
    
    print("Verificando tamaño final...")
    cursor.execute("""
    SELECT 
        table_name, 
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
        table_rows
    FROM information_schema.TABLES 
    WHERE table_schema = 'sodeco' AND table_name = 'wp_posts'
    """)
    
    for (name, size, rows) in cursor:
        print(f"{name}: {size} MB (Filas: {rows})")

    cursor.close()
    cnx.close()

except mysql.connector.Error as err:
    print(f"Error Crítico: {err}")
