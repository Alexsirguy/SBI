CREATE TABLE `accounts` (
	`account_id` uuid NOT NULL,
	`issuer` varchar(300) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`linked_at` datetime(3),
	`consent_version` varchar(40),
	CONSTRAINT `accounts_account_id` PRIMARY KEY(`account_id`),
	CONSTRAINT `accounts_issuer_subject_idx` UNIQUE(`issuer`,`subject`)
);
--> statement-breakpoint
ALTER TABLE `media_objects` ADD `owner_account_id` uuid;--> statement-breakpoint
CREATE INDEX `media_objects_owner_idx` ON `media_objects` (`owner_account_id`);