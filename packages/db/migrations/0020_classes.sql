CREATE TABLE `class_lessons` (
	`class_id` uuid NOT NULL,
	`lesson_id` uuid NOT NULL,
	`lesson_version` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`added_at` datetime(3) NOT NULL,
	CONSTRAINT `class_lessons_class_id_lesson_id_pk` PRIMARY KEY(`class_id`,`lesson_id`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`class_id` uuid NOT NULL,
	`owner_account_id` uuid NOT NULL,
	`name` varchar(60) NOT NULL,
	`join_code_hash` char(64) NOT NULL,
	`join_code_hint` varchar(4) NOT NULL,
	`curriculum` varchar(4),
	`level` varchar(8),
	`audience_lock` varchar(8),
	`blocked_categories` json NOT NULL,
	`tutor_enabled` boolean NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`archived_at` datetime(3),
	CONSTRAINT `classes_class_id` PRIMARY KEY(`class_id`),
	CONSTRAINT `classes_join_code_idx` UNIQUE(`join_code_hash`)
);
--> statement-breakpoint
CREATE TABLE `educators` (
	`account_id` uuid NOT NULL,
	`enabled_at` datetime(3) NOT NULL,
	CONSTRAINT `educators_account_id` PRIMARY KEY(`account_id`)
);
--> statement-breakpoint
CREATE INDEX `class_lessons_added_idx` ON `class_lessons` (`class_id`,`added_at`);--> statement-breakpoint
CREATE INDEX `classes_owner_idx` ON `classes` (`owner_account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `classes_archived_idx` ON `classes` (`archived_at`);