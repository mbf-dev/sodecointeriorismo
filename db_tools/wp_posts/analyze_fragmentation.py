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

    print(f"{'Metric':<30} {'Value':<15}")
    print("-" * 45)

    # 1. Get allocated size from Information Schema
    query_schema = """
    SELECT 
        ROUND(data_length / 1024 / 1024, 2) as data_mb,
        ROUND(index_length / 1024 / 1024, 2) as index_mb,
        ROUND(data_free / 1024 / 1024, 2) as free_mb
    FROM information_schema.TABLES 
    WHERE table_schema = 'sodeco' AND table_name = 'wp_posts'
    """
    cursor.execute(query_schema)
    row = cursor.fetchone()
    
    if row:
        data_mb, index_mb, free_mb = row
        print(f"{'Allocated Data Size':<30} {data_mb} MB")
        print(f"{'Index Size':<30} {index_mb} MB")
        print(f"{'Free/Wasted Space':<30} {free_mb} MB")
        
        total_allocated = float(data_mb) + float(index_mb)
        print(f"{'Total Table Size':<30} {total_allocated:.2f} MB")
    
    print("-" * 45)

    # 2. Get ACTUAL content size sum
    query_content = """
    SELECT 
        ROUND(SUM(LENGTH(post_content)) / 1024 / 1024, 2) as content_mb,
        COUNT(*) as total_rows
    FROM wp_posts
    """
    cursor.execute(query_content)
    row_content = cursor.fetchone()
    
    if row_content:
        content_mb, total_rows = row_content
        content_mb = content_mb if content_mb else 0
        print(f"{'Actual Content Size':<30} {content_mb} MB")
        print(f"{'Total Rows':<30} {total_rows}")

    print("-" * 45)
    
    if row and row_content:
        # Provide Conclusion
        print("\nCONCLUSIÓN:")
        if float(free_mb) > 10 or (float(data_mb) - float(content_mb)) > 10:
            print("(!) Se ha detectado una gran fragmentación.")
            print("El contenido real es mucho menor que el espacio ocupado.")
            print("SOLUCIÓN RECOMENDADA: Ejecutar 'OPTIMIZE TABLE wp_posts;'")
        else:
            print("El tamaño parece consistente con los datos.")


    cursor.close()
    cnx.close()

except mysql.connector.Error as err:
    print(f"Error: {err}")
