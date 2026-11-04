ALTER TABLE `tutor_turns` ADD `account_id` uuid;--> statement-breakpoint
CREATE INDEX `tutor_turns_account_idx` ON `tutor_turns` (`account_id`,`lesson_id`);