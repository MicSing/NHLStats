variable "resource_group_name" {
  description = "Name of the resource group."
  type        = string
  default     = "rg-nhlstats"
}

variable "location" {
  description = "Azure region."
  type        = string
  default     = "westeurope"
}

variable "sql_server_name" {
  description = "Name of the SQL Server."
  type        = string
  default     = "sql-nhlstats-db"
}

variable "sql_db_name" {
  description = "Name of the SQL Database."
  type        = string
  default     = "sqldb-nhlstats"
}

variable "admin_username" {
  description = "Administrator username for SQL Server."
  type        = string
  default     = "nhladmin"
}

variable "admin_password" {
  description = "Administrator password for SQL Server."
  type        = string
  sensitive   = true
}
