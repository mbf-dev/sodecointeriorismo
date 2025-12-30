import mysql.connector

# Database configuration
config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

try:
    # Connect
    cnx = mysql.connector.connect(**config)
    cursor = cnx.cursor()

    print("=== REPORTE DE ANÁLISIS DE wp_posts ===\n")

    # 1. Breakdown by Post Type (Count and Total Size)
    print("1. Distribución por Tipo de Post (Post Type):")
    print(f"{'Post Type':<30} {'Count':<10} {'Size (MB)':<10}")
    print("-" * 55)
    
    query_types = """
    SELECT 
        post_type, 
        COUNT(*) as count, 
        ROUND(SUM(LENGTH(post_content)) / 1024 / 1024, 2) as size_mb
    FROM wp_posts
    GROUP BY post_type
    ORDER BY size_mb DESC
    """
    cursor.execute(query_types)
    for (pt, count, size) in cursor:
        print(f"{pt:<30} {count:<10} {size if size else 0:<10}")
    
    print("\n" + "="*55 + "\n")

    # 2. Individual Posts > 1MB (approx 1,048,576 bytes)
    print("2. Items individuales pesados (> 0.5 MB):")
    # Lowered threshold to 0.5MB to capture more distinct large items if 1MB returns nothing
    print(f"{'ID':<10} {'Type':<15} {'Size (MB)':<10} {'Title'}")
    print("-" * 80)

    query_posts = """
    SELECT 
        ID, 
        post_type, 
        ROUND(LENGTH(post_content) / 1024 / 1024, 2) as size_mb,
        post_title
    FROM wp_posts
    WHERE LENGTH(post_content) > 500000 
    ORDER BY LENGTH(post_content) DESC
    LIMIT 50
    """
    cursor.execute(query_posts)
    
    rows = cursor.fetchall()
    if not rows:
        print("No se encontraron posts individuales mayores a 0.5 MB.")
    else:
        for (pid, ptype, size, title) in rows:
            # Truncate title if too long
            safe_title = (title[:40] + '..') if title and len(title) > 40 else title
            print(f"{pid:<10} {ptype:<15} {size:<10} {safe_title}")

    cursor.close()
    cnx.close()

except mysql.connector.Error as err:
    print(f"Error Database: {err}")
except Exception as e:
    print(f"Error: {e}")
