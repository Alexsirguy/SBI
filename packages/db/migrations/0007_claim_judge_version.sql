ALTER TABLE `claims` ADD `judge_version` varchar(200);--> statement-breakpoint
CREATE INDEX `claims_judge_idx` ON `claims` (`judge_version`);--> statement-breakpoint
UPDATE `claims` SET `judge_version` = JSON_VALUE(`document`, '$.verification.judge') WHERE `judge_version` IS NULL;
