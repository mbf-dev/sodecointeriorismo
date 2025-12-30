import mysql.connector
import sys

# CONFIGURACIÓN
config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

def clean_orphans(dry_run=True):
    try:
        cnx = mysql.connector.connect(**config)
        cursor = cnx.cursor()

        print("=== LIMPIEZA DE METADATOS HUÉRFANOS (SEGURIDAD MÁXIMA) ===\n")
        
        if dry_run:
            print(" [MODO SIMULACRO] No se harán cambios reales. Solo reporte.")
        else:
            print(" [MODO REAL] Se ELIMINARÁN datos permanentemente.")
            
        print("-" * 60)

        # ---------------------------------------------------------
        # EXPLICACIÓN TÉCNICA DE SEGURIDAD
        # ---------------------------------------------------------
        # Lógica:
        # En WordPress, 'wp_postmeta' guarda información extra de un post.
        # La columna 'post_id' conecta con 'ID' en la tabla 'wp_posts'.
        #
        # La consulta busca filas en 'wp_postmeta' (pm)
        # e intenta unirlas con 'wp_posts' (p) usando esa ID.
        # LEFT JOIN wp_posts p ON pm.post_id = p.ID
        #
        # Si 'p.ID' es NULL, significa que el padre NO EXISTE.
        # Por tanto, ese metadato es basura inalcanzable.
        # ---------------------------------------------------------

        # 1. Contar Huérfanos
        print("1. Buscando registros sin padre (post_id inexistente)...")
        query_check = """
        SELECT count(*)
        FROM wp_postmeta pm 
        LEFT JOIN wp_posts p ON pm.post_id = p.ID 
        WHERE p.ID IS NULL
        """
        cursor.execute(query_check)
        orphans_count = cursor.fetchone()[0]

        print(f"   > Se encontraron {orphans_count} registros huérfanos.")

        if orphans_count == 0:
            print("   > ¡Excelente! Tu base de datos está limpia.")
            return

        # 2. Ejecutar (o Simular) Limpieza
        print("\n2. Ejecutando limpieza...")
        
        if dry_run:
            print(f"   [SIMULACRO] Se habrían eliminado {orphans_count} registros.")
            print("   Para ejecutar realmente, usa: python db_tools/clean_orphans.py --force")
        else:
            print("   > Eliminando registros...")
            query_delete = """
            DELETE pm 
            FROM wp_postmeta pm 
            LEFT JOIN wp_posts p ON pm.post_id = p.ID 
            WHERE p.ID IS NULL
            """
            cursor.execute(query_delete)
            deleted = cursor.rowcount
            cnx.commit()
            print(f"   [ÉXITO] {deleted} registros eliminados correctamente.")
            
            # Optimizar solo si se borró algo
            print("   > Optimizando tabla postmeta...")
            cursor.execute("SET SESSION sql_mode = 'ALLOW_INVALID_DATES';")
            try:
                cursor.execute("ALTER TABLE wp_postmeta FORCE")
                print("   [OK] Tabla optimizada.")
            except:
                print("   [!] Nota: Optimización omitida, pero los datos fueron borrados.")

        cursor.close()
        cnx.close()

    except mysql.connector.Error as err:
        print(f"Error Database: {err}")

if __name__ == "__main__":
    # Por seguridad, siempre es Dry Run a menos que se pase el flag --force
    force_mode = False
    if len(sys.argv) > 1 and sys.argv[1] == '--force':
        force_mode = True
    
    clean_orphans(dry_run=not force_mode)
