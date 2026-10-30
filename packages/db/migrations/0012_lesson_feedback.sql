CREATE TABLE `lesson_feedback` (
	`feedback_id` uuid NOT NULL,
	`lesson_id` uuid NOT NULL,
	`version` int NOT NULL,
	`category` varchar(32),
	`details` varchar(1000),
	`helpful` int,
	`clear` int,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `lesson_feedback_feedback_id` PRIMARY KEY(`feedback_id`)
);
--> statement-breakpoint
CREATE INDEX `lesson_feedback_lesson_idx` ON `lesson_feedback` (`lesson_id`,`version`,`created_at`);