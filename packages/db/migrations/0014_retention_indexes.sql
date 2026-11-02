CREATE INDEX `catalog_gaps_last_seen_idx` ON `catalog_gaps` (`last_seen`);--> statement-breakpoint
CREATE INDEX `evidence_packs_created_idx` ON `evidence_packs` (`created_at`);--> statement-breakpoint
CREATE INDEX `tutor_turns_retention_idx` ON `tutor_turns` (`retention_class`,`created_at`);