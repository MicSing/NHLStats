using System;
using System.IO;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using System.Collections.Generic;

namespace DataImporter
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length < 2)
            {
                Console.WriteLine("Usage: DataImporter <path_to_json_dir> <connection_string>");
                return;
            }

            string jsonDir = args[0];
            string connectionString = args[1];

            // Order of insertion is important due to foreign keys. 
            // The safest way is to disable constraints, insert data, and re-enable, 
            // but we can try to order them logically.
            var tables = new[] 
            {
                "Users",
                "Teams",
                "Seasons",
                "SeasonUsers",
                "RosterPlayers",
                "SeasonRosterPlayers",
                "Matches",
                "PointReasons",
                "MoneyConfigs",
                "Expenses",
                "UserPayouts",
                "Bets",
                "BetLegs",
                "MatchOdds",
                "UserSeasonAggregatedData",
                "UserMatches",
                "UserMatchPoints",
                "UserMatchGoals",
                "UserMatchPenalties",
                "AppRoles",
                "AspNetUsers",
                "LoginRoleRelations"
            };

            using var conn = new SqlConnection(connectionString);
            int retries = 5;
            while (retries > 0)
            {
                try
                {
                    conn.Open();
                    break;
                }
                catch (SqlException) when (retries > 1)
                {
                    Console.WriteLine("Database waking up, retrying in 5 seconds...");
                    System.Threading.Thread.Sleep(5000);
                    retries--;
                }
            }

            // Disable all foreign key constraints
            foreach (var table in tables)
            {
                using var cmdDisableFK = new SqlCommand($"ALTER TABLE [{table}] NOCHECK CONSTRAINT ALL", conn);
                try { cmdDisableFK.ExecuteNonQuery(); } catch { }
            }

            foreach (var table in tables)
            {
                string filePath = Path.Combine(jsonDir, $"{table}.json");
                if (!File.Exists(filePath))
                {
                    Console.WriteLine($"Skipping {table}, file not found.");
                    continue;
                }

                Console.WriteLine($"Importing {table}...");
                string json = File.ReadAllText(filePath);
                var rows = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json);

                if (rows == null || rows.Count == 0) continue;

                // Check if table has an IDENTITY column
                bool hasIdentity = false;
                using (var cmdIdentity = new SqlCommand($"SELECT OBJECTPROPERTY(OBJECT_ID('{table}'), 'TableHasIdentity')", conn))
                {
                    var result = cmdIdentity.ExecuteScalar();
                    if (result != DBNull.Value && Convert.ToInt32(result) == 1)
                    {
                        hasIdentity = true;
                    }
                }

                if (hasIdentity)
                {
                    using var cmdOn = new SqlCommand($"SET IDENTITY_INSERT [{table}] ON", conn);
                    cmdOn.ExecuteNonQuery();
                }

                using (var cmdDel = new SqlCommand($"DELETE FROM [{table}]", conn))
                {
                    try { cmdDel.ExecuteNonQuery(); } catch { }
                }

                foreach (var row in rows)
                {
                    var columns = new List<string>();
                    var parameters = new List<string>();
                    var sqlCmd = new SqlCommand();
                    sqlCmd.Connection = conn;

                    foreach (var kvp in row)
                    {
                        columns.Add($"[{kvp.Key}]");
                        string paramName = $"@{kvp.Key}";
                        parameters.Add(paramName);

                        object val = DBNull.Value;
                        if (kvp.Value.ValueKind != JsonValueKind.Null)
                        {
                            switch(kvp.Value.ValueKind)
                            {
                                case JsonValueKind.String: 
                                    string s = kvp.Value.GetString();
                                    if (s == "Active") val = 0;
                                    else if (s == "Complete") val = 1;
                                    else val = s;
                                    break;
                                case JsonValueKind.Number: 
                                    if (kvp.Value.TryGetInt32(out int i)) val = i;
                                    else if (kvp.Value.TryGetInt64(out long l)) val = l;
                                    else if (kvp.Value.TryGetDecimal(out decimal d)) val = d;
                                    else val = kvp.Value.GetDouble();
                                    break;
                                case JsonValueKind.True: val = true; break;
                                case JsonValueKind.False: val = false; break;
                            }
                        }

                        // Provide default for NOT NULL columns that were null in SQLite
                        if (val == DBNull.Value && table == "MatchOdds" && kvp.Key == "ComputedOn")
                        {
                            val = new DateTime(2023, 1, 1);
                        }

                        sqlCmd.Parameters.AddWithValue(paramName, val);
                    }

                    sqlCmd.CommandText = $"INSERT INTO [{table}] ({string.Join(", ", columns)}) VALUES ({string.Join(", ", parameters)})";
                    
                    try
                    {
                        sqlCmd.ExecuteNonQuery();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error inserting into {table}: {ex.Message}");
                    }
                }

                if (hasIdentity)
                {
                    using var cmdOff = new SqlCommand($"SET IDENTITY_INSERT [{table}] OFF", conn);
                    cmdOff.ExecuteNonQuery();
                }

                Console.WriteLine($"Finished {table}. Imported {rows.Count} rows.");
            }

            // Re-enable all foreign key constraints
            foreach (var table in tables)
            {
                using var cmdEnableFK = new SqlCommand($"ALTER TABLE [{table}] WITH CHECK CHECK CONSTRAINT ALL", conn);
                try { cmdEnableFK.ExecuteNonQuery(); } catch { }
            }
        }
    }
}
