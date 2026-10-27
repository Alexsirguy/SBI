CREATE TABLE `claims` (
	`claim_id` varchar(200) NOT NULL,
	`status` varchar(32) NOT NULL,
	`document` json NOT NULL,
	CONSTRAINT `claims_claim_id` PRIMARY KEY(`claim_id`)
);
--> statement-breakpoint
CREATE TABLE `evidence_sources` (
	`source_id` varchar(200) NOT NULL,
	`rights_status` varchar(32) NOT NULL,
	`last_checked_at` datetime(3) NOT NULL,
	`document` json NOT NULL,
	CONSTRAINT `evidence_sources_source_id` PRIMARY KEY(`source_id`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`lesson_id` varchar(200) NOT NULL,
	`version` int NOT NULL,
	`taxonomy_id` varchar(200) NOT NULL,
	`locale` varchar(16) NOT NULL,
	`review_status` varchar(32) NOT NULL,
	`safety_class` varchar(16) NOT NULL,
	`cache_scope` varchar(16) NOT NULL,
	`intent_signature` varchar(500) NOT NULL,
	`content_hash` char(64) NOT NULL,
	`document` json NOT NULL,
	CONSTRAINT `lessons_lesson_id_version_pk` PRIMARY KEY(`lesson_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `recognition_results` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`session_id` varchar(200) NOT NULL,
	`image_sha256` char(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`delete_by` datetime(3) NOT NULL,
	`document` json NOT NULL,
	CONSTRAINT `recognition_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutor_turns` (
	`session_id` varchar(200) NOT NULL,
	`turn_id` varchar(200) NOT NULL,
	`lesson_id` varchar(200) NOT NULL,
	`lesson_version` int NOT NULL,
	`retention_class` varchar(32) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`document` json NOT NULL,
	CONSTRAINT `tutor_turns_session_id_turn_id_pk` PRIMARY KEY(`session_id`,`turn_id`)
);
--> statement-breakpoint
CREATE TABLE `visual_assets` (
	`asset_id` varchar(200) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`commercial_use` varchar(32) NOT NULL,
	`document` json NOT NULL,
	CONSTRAINT `visual_assets_asset_id` PRIMARY KEY(`asset_id`)
);
--> statement-breakpoint
CREATE INDEX `lessons_intent_idx` ON `lessons` (`intent_signature`);--> statement-breakpoint
CREATE INDEX `lessons_content_hash_idx` ON `lessons` (`content_hash`);--> statement-breakpoint
CREATE INDEX `recognition_session_idx` ON `recognition_results` (`session_id`);--> statement-breakpoint
CREATE INDEX `recognition_delete_by_idx` ON `recognition_results` (`delete_by`);