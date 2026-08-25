using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace DataExporter
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length < 2)
            {
                Console.WriteLine("Usage: DataExporter <connection_string> <output_directory>");
                return;
            }

            string connectionString = args[0];
            string outputDir = args[1];

            Directory.CreateDirectory(outputDir);

            using var conn = new SqlConnection(connectionString);
            conn.Open();

            // Get all user tables
            var tables = new List<string>();
            using (var cmdTables = new SqlCommand("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME", conn))
            using (var reader = cmdTables.ExecuteReader())
            {
                while (reader.Read())
                {
                    tables.Add(reader.GetString(0));
                }
            }

            var jsonOptions = new JsonSerializerOptions
            {
                WriteIndented = true
            };

            foreach (var table in tables)
            {
                var rows = new List<Dictionary<string, object?>>();
                using (var cmdSelect = new SqlCommand($"SELECT * FROM [{table}]", conn))
                using (var reader = cmdSelect.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var row = new Dictionary<string, object?>();
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            string colName = reader.GetName(i);
                            object val = reader.GetValue(i);
                            if (val == DBNull.Value)
                            {
                                row[colName] = null;
                            }
                            else if (val is DateTime dt)
                            {
                                row[colName] = dt.ToString("o");
                            }
                            else
                            {
                                row[colName] = val;
                            }
                        }
                        rows.Add(row);
                    }
                }

                string filePath = Path.Combine(outputDir, $"{table}.json");
                string json = JsonSerializer.Serialize(rows, jsonOptions);
                File.WriteAllText(filePath, json);

                Console.WriteLine($"Exported {rows.Count} rows from {table} to {filePath}");
            }

            Console.WriteLine($"Export completed successfully to {outputDir}!");
        }
    }
}
