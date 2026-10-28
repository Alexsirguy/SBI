CREATE TABLE `deletion_audit_log` (
	`audit_id` uuid NOT NULL,
	`object_key` varchar(300) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`deleted_at` datetime(3) NOT NULL,
	`reason` varchar(200) NOT NULL,
	CONSTRAINT `deletion_audit_log_audit_id` PRIMARY KEY(`audit_id`)
);
--> statement-breakpoint
CREATE TABLE `media_objects` (
	`object_key` varchar(300) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`saved_by_user` boolean NOT NULL DEFAULT false,
	CONSTRAINT `media_objects_object_key` PRIMARY KEY(`object_key`)
);
--> statement-breakpoint
CREATE INDEX `media_objects_created_idx` ON `media_objects` (`created_at`);