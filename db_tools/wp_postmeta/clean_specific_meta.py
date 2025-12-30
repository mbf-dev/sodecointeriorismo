import mysql.connector
import sys

# CONFIGURACIÓN
config = {
  'user': 'root',
  'password': '',
  'host': 'localhost',
  'database': 'sodeco'
}

# MATRIZ DE KEYS A ELIMINAR
KEYS_TO_REMOVE = [
    '_imagify_data',
    '_imagify_status',
    # '_otra_key_ejemplo'
]

def clean_specific_keys(dry_run=True):
    try:
        cnx = mysql.connector.connect(**config)
        cursor = cnx.cursor()

        print("=== LIMPIEZA DE KEYS ESPECÍFICAS DE WP_POSTMETA ===\n")
        
        if dry_run:
            print(" [MODO SIMULACRO] No se harán cambios reales.")
        else:
            print(" [MODO REAL] Se ELIMINARÁN datos de las keys seleccionadas.")

        print("-" * 50)

        # 1. Análisis
        print(f"1. Analizando claves: {KEYS_TO_REMOVE}")
        total_found = 0
        for key in KEYS_TO_REMOVE:
            query = "SELECT COUNT(*) FROM wp_postmeta WHERE meta_key = %s"
            cursor.execute(query, (key,))
            count = cursor.fetchone()[0]
            print(f"   - {key}: {count} registros.")
            total_found += count

        if total_found == 0:
            print("\n   > No se encontraron registros para estas claves.")
            return

        # 2. Ejecutar (o Simular)
        print("\n2. Acción...")
        if dry_run:
             print(f"   [SIMULACRO] Se borrarían {total_found} registros en total.")
             print("   Para ejecutar: python db_tools/clean_specific_meta.py --force")
        else:
            print("   > Eliminando registros...")
            format_strings = ','.join(['%s'] * len(KEYS_TO_REMOVE))
            query_delete = f"DELETE FROM wp_postmeta WHERE meta_key IN ({format_strings})"
            cursor.execute(query_delete, tuple(KEYS_TO_REMOVE))
            deleted = cursor.rowcount
            cnx.commit()
            print(f"   [ÉXITO] {deleted} registros eliminados.")

            # Optimizar
            print("   > Optimizando tabla (ALTER TABLE FORCE)...")
            cursor.execute("SET SESSION sql_mode = 'ALLOW_INVALID_DATES';")
            try:
                cursor.execute("ALTER TABLE wp_postmeta FORCE")
                print("   [OK] Tabla reconstruida.")
            except:
                print("   [!] Nota: Datos borrados, pero optimización forzada falló.")

        cursor.close()
        cnx.close()

    except mysql.connector.Error as err:
        print(f"Error Database: {err}")

if __name__ == "__main__":
    force_mode = False
    if len(sys.argv) > 1 and sys.argv[1] == '--force':
        force_mode = True
    
    clean_specific_keys(dry_run=not force_mode)
