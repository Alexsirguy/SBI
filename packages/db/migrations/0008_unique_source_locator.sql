UPDATE `evidence_sources` SET `locator_sha256` = SHA2(`source_id`, 256) WHERE `locator_sha256` = '';--> statement-breakpoint
DROP INDEX `evidence_sources_locator_idx` ON `evidence_sources`;--> statement-breakpoint
ALTER TABLE `evidence_sources` ADD CONSTRAINT `evidence_sources_locator_idx` UNIQUE(`locator_sha256`);