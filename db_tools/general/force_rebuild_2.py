import mysql.connector

config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

tables_to_rebuild = ['wp_postmeta', 'wp_actionscheduler_actions', 'wp_actionscheduler_logs']

try:
    cnx = mysql.connector.connect(**config)
    cursor = cnx.cursor()
    
    print("Continuando optimización forzada para resto de tablas...")
    cursor.execute("SET SESSION sql_mode = 'ALLOW_INVALID_DATES';")

    for table in tables_to_rebuild:
        print(f"Reconstruyendo {table}...", end=" ")
        try:
            cursor.execute(f"ALTER TABLE {table} FORCE")
            print("[OK]")
        except mysql.connector.Error as err:
            print(f"\n[ERROR] {err}")
            
    print("-" * 60)
    print("Actualizando estadísticas finales...")
    cursor.execute("ANALYZE TABLE wp_posts, wp_postmeta")
    cursor.fetchall()
    
    print("REPORTE FINAL DE ESTADO:")
    print(f"{'Tabla':<30} {'Tamaño (MB)':<15}")
    print("-" * 45)
    
    cursor.execute("""
    SELECT 
        table_name, 
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb 
    FROM information_schema.TABLES 
    WHERE table_schema = 'sodeco' 
    ORDER BY (data_length + index_length) DESC
    LIMIT 10
    """)
    
    for (name, size) in cursor:
        print(f"{name:<30} {size:<15}")

    cursor.close()
    cnx.close()

except mysql.connector.Error as err:
    print(f"Error Crítico: {err}")
