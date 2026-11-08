CREATE TABLE `class_activity` (
	`class_id` uuid NOT NULL,
	`week` char(8) NOT NULL,
	`metric` varchar(24) NOT NULL,
	`count` int NOT NULL,
	CONSTRAINT `class_activity_class_id_week_metric_pk` PRIMARY KEY(`class_id`,`week`,`metric`)
);
--> statement-breakpoint
CREATE INDEX `class_activity_week_idx` ON `class_activity` (`week`);