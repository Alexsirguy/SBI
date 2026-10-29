CREATE TABLE `lesson_claims` (
	`lesson_id` uuid NOT NULL,
	`version` int NOT NULL,
	`claim_id` uuid NOT NULL,
	CONSTRAINT `lesson_claims_lesson_id_version_claim_id_pk` PRIMARY KEY(`lesson_id`,`version`,`claim_id`)
);
--> statement-breakpoint
CREATE INDEX `lesson_claims_claim_idx` ON `lesson_claims` (`claim_id`);--> statement-breakpoint
CREATE INDEX `evidence_sources_checked_idx` ON `evidence_sources` (`last_checked_at`);--> statement-breakpoint
INSERT IGNORE INTO `lesson_claims` (`lesson_id`, `version`, `claim_id`) SELECT `l`.`lesson_id`, `l`.`version`, `j`.`claim_id` FROM `lessons` `l`, JSON_TABLE(`l`.`document`, '$.claims[*]' COLUMNS (`claim_id` char(36) PATH '$.claimId')) `j`;
