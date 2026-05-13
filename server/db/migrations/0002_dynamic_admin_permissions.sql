CREATE TABLE IF NOT EXISTS `ta_admin_permission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_id` int NOT NULL DEFAULT 0,
  `type` varchar(20) NOT NULL DEFAULT 'button',
  `code` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) NOT NULL DEFAULT '',
  `module` varchar(50) NOT NULL DEFAULT '',
  `route_path` varchar(255) NOT NULL DEFAULT '',
  `api_method` varchar(10) NOT NULL DEFAULT '',
  `api_path` varchar(255) NOT NULL DEFAULT '',
  `api_match_type` varchar(20) NOT NULL DEFAULT '',
  `component_key` varchar(255) NOT NULL DEFAULT '',
  `active_menu` varchar(255) NOT NULL DEFAULT '',
  `keepalive` tinyint NOT NULL DEFAULT 0,
  `icon` varchar(100) NOT NULL DEFAULT '',
  `sort` int NOT NULL DEFAULT 0,
  `status` tinyint NOT NULL DEFAULT 1,
  `visible` tinyint NOT NULL DEFAULT 1,
  `is_system` tinyint NOT NULL DEFAULT 0,
  `is_high_risk` tinyint NOT NULL DEFAULT 0,
  `data_scope_supported` tinyint NOT NULL DEFAULT 0,
  `meta_json` text,
  `created_by` int NOT NULL DEFAULT 0,
  `updated_by` int NOT NULL DEFAULT 0,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ta_admin_permission_uk_code` (`code`),
  KEY `ta_admin_permission_idx_parent` (`parent_id`),
  KEY `ta_admin_permission_idx_module` (`module`),
  KEY `ta_admin_permission_idx_type` (`type`),
  KEY `ta_admin_permission_idx_api` (`api_method`, `api_path`),
  KEY `ta_admin_permission_idx_status_sort` (`status`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ta_admin_permission_sync_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source` varchar(30) NOT NULL DEFAULT 'scanner',
  `action` varchar(30) NOT NULL DEFAULT '',
  `permission_code` varchar(100) NOT NULL DEFAULT '',
  `before_data` text,
  `after_data` text,
  `message` varchar(500) NOT NULL DEFAULT '',
  `created_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ta_admin_permission_sync_log_idx_code` (`permission_code`),
  KEY `ta_admin_permission_sync_log_idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ta_admin_role_data_scope` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `scope_type` varchar(30) NOT NULL DEFAULT 'all',
  `department_ids_json` text,
  `created_at` int NOT NULL DEFAULT 0,
  `updated_at` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ta_admin_role_data_scope_uk_role` (`role_id`),
  KEY `ta_admin_role_data_scope_idx_scope` (`scope_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `ta_admin_role_permission`
  ADD COLUMN `permission_id` int NOT NULL DEFAULT 0 AFTER `role_id`,
  ADD KEY `ta_admin_role_permission_idx_permission` (`permission_id`);
