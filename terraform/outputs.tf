output "sql_server_fqdn" {
  value = azurerm_mssql_server.sql_server.fully_qualified_domain_name
  description = "The fully qualified domain name of the Azure SQL Server."
}

output "database_name" {
  value = azurerm_mssql_database.sqldb.name
  description = "The name of the Azure SQL Database."
}

output "connection_string" {
  value = "Server=tcp:${azurerm_mssql_server.sql_server.fully_qualified_domain_name},1433;Initial Catalog=${azurerm_mssql_database.sqldb.name};Persist Security Info=False;User ID=${var.admin_username};Password=${var.admin_password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  description = "Connection string for the application (store securely)."
  sensitive = true
}
