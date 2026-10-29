ALTER TABLE `evidence_sources` ADD `locator_sha256` char(64) NOT NULL;--> statement-breakpoint
CREATE INDEX `evidence_sources_locator_idx` ON `evidence_sources` (`locator_sha256`);