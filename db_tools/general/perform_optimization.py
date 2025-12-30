import mysql.connector

config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

tables_to_optimize = [
    'wp_posts', 
    'wp_postmeta', 
    'wp_actionscheduler_actions', 
    'wp_actionscheduler_logs', 
    'wp_options'
]

try:
    cnx = mysql.connector.connect(**config)
    cursor = cnx.cursor()

    print("Iniciando optimización de tablas (recuperación de espacio en disco)...")
    print("-" * 60)

    for table in tables_to_optimize:
        print(f"Optimizando {table}...", end=" ")
        cursor.execute(f"OPTIMIZE TABLE {table}")
        # Fetch output of optimize command
        result = cursor.fetchall() 
        status = result[0][3] if result else "Unknown"
        print(f"[{status}]")
    
    print("-" * 60)
    print("Optimización completada.")

    cursor.close()
    cnx.close()

except mysql.connector.Error as err:
    print(f"Error: {err}")
