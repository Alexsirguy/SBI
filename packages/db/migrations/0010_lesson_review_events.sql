CREATE TABLE `lesson_review_events` (
	`event_id` uuid NOT NULL,
	`lesson_id` uuid NOT NULL,
	`version` int NOT NULL,
	`from_status` varchar(32) NOT NULL,
	`to_status` varchar(32) NOT NULL,
	`reviewed_by` varchar(200) NOT NULL,
	`at` datetime(3) NOT NULL,
	`reason` varchar(2000),
	CONSTRAINT `lesson_review_events_event_id` PRIMARY KEY(`event_id`)
);
--> statement-breakpoint
CREATE INDEX `lesson_review_events_lesson_idx` ON `lesson_review_events` (`lesson_id`,`version`,`at`);