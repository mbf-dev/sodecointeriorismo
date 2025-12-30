import mysql.connector

# Database configuration
config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

try:
    # Connect to database
    cnx = mysql.connector.connect(**config)
    cursor = cnx.cursor()

    # Query to get table sizes
    query = """
    SELECT 
        table_name, 
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb 
    FROM information_schema.TABLES 
    WHERE table_schema = 'sodeco' 
    ORDER BY (data_length + index_length) DESC 
    LIMIT 20
    """

    cursor.execute(query)

    print(f"{'Table Name':<40} {'Size (MB)':<15}")
    print("-" * 55)

    for (table_name, size_mb) in cursor:
        print(f"{table_name:<40} {size_mb:<15}")

    cursor.close()
    cnx.close()

except ImportError:
    print("Error: The 'mysql-connector-python' module is missing.")
    print("Please install it by running: pip install mysql-connector-python")
except mysql.connector.Error as err:
    print(f"Database Error: {err}")
except Exception as e:
    print(f"An error occurred: {e}")
