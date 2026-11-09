CREATE TABLE `curricula` (
	`curriculum_id` varchar(8) NOT NULL,
	`label` varchar(80) NOT NULL,
	`levels` json NOT NULL,
	`frameworks` json NOT NULL,
	`synced_at` datetime(3) NOT NULL,
	CONSTRAINT `curricula_curriculum_id` PRIMARY KEY(`curriculum_id`)
);
--> statement-breakpoint
CREATE TABLE `curriculum_subjects` (
	`subject_id` varchar(40) NOT NULL,
	`curriculum_id` varchar(8) NOT NULL,
	`framework_id` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`levels` json NOT NULL,
	`position` int NOT NULL,
	CONSTRAINT `curriculum_subjects_subject_id` PRIMARY KEY(`subject_id`)
);
--> statement-breakpoint
CREATE TABLE `curriculum_topics` (
	`topic_code` varchar(60) NOT NULL,
	`curriculum_id` varchar(8) NOT NULL,
	`subject_id` varchar(40) NOT NULL,
	`framework_id` varchar(40) NOT NULL,
	`level` varchar(8) NOT NULL,
	`theme` varchar(120),
	`title` varchar(300) NOT NULL,
	`goals` json NOT NULL,
	`concepts` json NOT NULL,
	`source_url` varchar(500),
	`position` int NOT NULL,
	`retired_at` datetime(3),
	CONSTRAINT `curriculum_topics_topic_code` PRIMARY KEY(`topic_code`)
);
--> statement-breakpoint
CREATE TABLE `lesson_topics` (
	`lesson_id` uuid NOT NULL,
	`topic_code` varchar(60) NOT NULL,
	`link` varchar(8) NOT NULL,
	`linked_at` datetime(3) NOT NULL,
	CONSTRAINT `lesson_topics_lesson_id_topic_code_pk` PRIMARY KEY(`lesson_id`,`topic_code`)
);
--> statement-breakpoint
CREATE INDEX `curriculum_subjects_curriculum_idx` ON `curriculum_subjects` (`curriculum_id`,`position`);--> statement-breakpoint
CREATE INDEX `curriculum_topics_subject_idx` ON `curriculum_topics` (`subject_id`,`level`,`position`);--> statement-breakpoint
CREATE INDEX `lesson_topics_topic_idx` ON `lesson_topics` (`topic_code`);