import sqlite3
import json
import os

db_path = "db_backups/nhlstats-2026-08-14-220536.db"
output_dir = "db_backups/json_export"

os.makedirs(output_dir, exist_ok=True)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall() if not row[0].startswith('sqlite_')]

for table in tables:
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    
    data = []
    for row in rows:
        data.append(dict(row))
        
    with open(f"{output_dir}/{table}.json", "w") as f:
        json.dump(data, f, indent=2)
        
    print(f"Exported {len(data)} rows from {table}")

conn.close()
