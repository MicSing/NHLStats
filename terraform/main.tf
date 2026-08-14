resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

# Generate a random suffix for the SQL Server name to ensure uniqueness
resource "random_integer" "suffix" {
  min = 1000
  max = 9999
}

resource "azurerm_mssql_server" "sql_server" {
  name                         = "${var.sql_server_name}-${random_integer.suffix.result}"
  resource_group_name          = azurerm_resource_group.rg.name
  location                     = azurerm_resource_group.rg.location
  version                      = "12.0"
  administrator_login          = var.admin_username
  administrator_login_password = var.admin_password

  minimum_tls_version = "1.2"
}

# Add a firewall rule to allow all Azure services and local IPs
resource "azurerm_mssql_firewall_rule" "allow_all" {
  name             = "AllowAllIps"
  server_id        = azurerm_mssql_server.sql_server.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "255.255.255.255"
}

resource "azurerm_mssql_database" "sqldb" {
  name      = var.sql_db_name
  server_id = azurerm_mssql_server.sql_server.id

  # Serverless Gen5 1 vCore is required to be eligible for Free limit or AutoPause easily
  sku_name = "GP_S_Gen5_1"
  
  max_size_gb    = 32
  zone_redundant = false

  # Auto-pause after 1 hour (60 minutes) to save costs if Free Limit runs out
  auto_pause_delay_in_minutes = 60
  min_capacity                = 0.5

  # Explicitly request the Free limit (requires azurerm >= 3.something, added in GH-23438)
  # If this fails during apply, the user can remove these 2 lines and click "Apply free offer" in the portal.
  # use_free_limit = true
  # free_limit_exhaustion_behavior = "AutoPause"
}
