CREATE TABLE IF NOT EXISTS `ta_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `group` varchar(30) NOT NULL DEFAULT '',
  `title` varchar(100) NOT NULL DEFAULT '',
  `tip` varchar(100) NOT NULL DEFAULT '',
  `type` varchar(30) NOT NULL DEFAULT 'string',
  `value` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ta_config_uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ta_admin_operation_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trace_id` varchar(64) NOT NULL DEFAULT '',
  `operator_type` varchar(30) NOT NULL DEFAULT 'admin',
  `operator_id` varchar(64) NOT NULL DEFAULT '',
  `operator_name` varchar(100) NOT NULL DEFAULT '',
  `event_type` varchar(64) NOT NULL DEFAULT '',
  `event_category` varchar(30) NOT NULL DEFAULT '',
  `target_type` varchar(50) NOT NULL DEFAULT '',
  `target_id` varchar(64) NOT NULL DEFAULT '',
  `target_name` varchar(255) NOT NULL DEFAULT '',
  `detail` text,
  `request_method` varchar(10) NOT NULL DEFAULT '',
  `request_path` varchar(255) NOT NULL DEFAULT '',
  `request_query` json DEFAULT NULL,
  `request_body` json DEFAULT NULL,
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `change_items` json DEFAULT NULL,
  `result` tinyint NOT NULL DEFAULT 1,
  `status_code` int NOT NULL DEFAULT 200,
  `duration_ms` int NOT NULL DEFAULT 0,
  `error_message` varchar(500) NOT NULL DEFAULT '',
  `ip` varchar(45) NOT NULL DEFAULT '',
  `user_agent` varchar(255) NOT NULL DEFAULT '',
  `created_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ta_admin_user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL DEFAULT '',
  `password_hash` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT 1,
  `is_super_admin` tinyint NOT NULL DEFAULT 0,
  `token_version` int NOT NULL DEFAULT 1,
  `last_login_at` int NOT NULL DEFAULT 0,
  `last_login_ip` varchar(45) NOT NULL DEFAULT '',
  `password_changed_at` int NOT NULL DEFAULT 0,
  `created_by` int NOT NULL DEFAULT 0,
  `updated_by` int NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ta_admin_user_uk_username` (`username`),
  KEY `ta_admin_user_idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ta_admin_role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) NOT NULL DEFAULT '',
  `status` tinyint NOT NULL DEFAULT 1,
  `is_system` tinyint NOT NULL DEFAULT 0,
  `sort` int NOT NULL DEFAULT 0,
  `created_by` int NOT NULL DEFAULT 0,
  `updated_by` int NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ta_admin_role_uk_code` (`code`),
  KEY `ta_admin_role_idx_status` (`status`),
  KEY `ta_admin_role_idx_sort` (`sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ta_admin_user_role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  `created_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ta_admin_user_role_uk_user_role` (`user_id`, `role_id`),
  KEY `ta_admin_user_role_idx_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ta_admin_role_permission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_code` varchar(100) NOT NULL,
  `created_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ta_admin_role_permission_uk_role_code` (`role_id`, `permission_code`),
  KEY `ta_admin_role_permission_idx_code` (`permission_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
