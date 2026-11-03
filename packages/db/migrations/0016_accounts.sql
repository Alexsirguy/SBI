CREATE TABLE `account_tokens` (
	`token_hash` char(64) NOT NULL,
	`account_id` uuid NOT NULL,
	`purpose` varchar(16) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `account_tokens_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`account_id` uuid NOT NULL,
	`email` varchar(254) NOT NULL,
	`email_verified_at` datetime(3),
	`password_hash` varchar(200),
	`google_sub` varchar(255),
	`first_name` varchar(80) NOT NULL,
	`last_name` varchar(80) NOT NULL,
	`age_at_signup` int NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`linked_at` datetime(3),
	`consent_version` varchar(40),
	CONSTRAINT `accounts_account_id` PRIMARY KEY(`account_id`),
	CONSTRAINT `accounts_email_idx` UNIQUE(`email`),
	CONSTRAINT `accounts_google_sub_idx` UNIQUE(`google_sub`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_hash` char(64) NOT NULL,
	`account_id` uuid NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `sessions_session_hash` PRIMARY KEY(`session_hash`)
);
--> statement-breakpoint
ALTER TABLE `media_objects` ADD `owner_account_id` uuid;--> statement-breakpoint
CREATE INDEX `account_tokens_account_idx` ON `account_tokens` (`account_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `account_tokens_expires_idx` ON `account_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `sessions_account_idx` ON `sessions` (`account_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `media_objects_owner_idx` ON `media_objects` (`owner_account_id`);