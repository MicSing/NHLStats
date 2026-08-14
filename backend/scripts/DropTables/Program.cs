using System;
using Microsoft.Data.SqlClient;

namespace DropTables
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length < 1)
            {
                Console.WriteLine("Usage: DropTables <connection_string>");
                return;
            }

            string connectionString = args[0];

            using var conn = new SqlConnection(connectionString);
            conn.Open();

            // SQL script to drop all foreign keys, then all tables
            string dropScript = @"
                DECLARE @Sql NVARCHAR(MAX) = '';
                
                -- Drop Foreign Keys
                SELECT @Sql += 'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + 
                               ' DROP CONSTRAINT ' + QUOTENAME(name) + ';' + CHAR(13)
                FROM sys.foreign_keys;
                
                EXEC sp_executesql @Sql;
                
                SET @Sql = '';
                
                -- Drop Tables
                SELECT @Sql += 'DROP TABLE ' + QUOTENAME(TABLE_SCHEMA) + '.' + QUOTENAME(TABLE_NAME) + ';' + CHAR(13)
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE';
                
                EXEC sp_executesql @Sql;
            ";

            using var cmd = new SqlCommand(dropScript, conn);
            cmd.ExecuteNonQuery();

            Console.WriteLine("All tables and foreign keys dropped successfully.");
        }
    }
}
