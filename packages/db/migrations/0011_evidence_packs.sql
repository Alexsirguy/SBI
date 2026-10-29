CREATE TABLE `evidence_packs` (
	`pack_key` char(64) NOT NULL,
	`taxonomy_id` varchar(200) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`document` json NOT NULL,
	CONSTRAINT `evidence_packs_pack_key` PRIMARY KEY(`pack_key`)
);
--> statement-breakpoint
CREATE INDEX `evidence_packs_taxonomy_idx` ON `evidence_packs` (`taxonomy_id`);