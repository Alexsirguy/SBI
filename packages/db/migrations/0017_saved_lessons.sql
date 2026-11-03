CREATE TABLE `saved_lessons` (
	`account_id` uuid NOT NULL,
	`lesson_id` uuid NOT NULL,
	`lesson_version` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`saved_at` datetime(3) NOT NULL,
	CONSTRAINT `saved_lessons_account_id_lesson_id_pk` PRIMARY KEY(`account_id`,`lesson_id`)
);
--> statement-breakpoint
CREATE INDEX `saved_lessons_saved_idx` ON `saved_lessons` (`account_id`,`saved_at`);