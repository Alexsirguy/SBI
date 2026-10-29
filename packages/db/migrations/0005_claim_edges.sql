CREATE TABLE `claim_dependencies` (
	`claim_id` uuid NOT NULL,
	`depends_on` uuid NOT NULL,
	CONSTRAINT `claim_dependencies_claim_id_depends_on_pk` PRIMARY KEY(`claim_id`,`depends_on`)
);
--> statement-breakpoint
CREATE TABLE `claim_sources` (
	`claim_id` uuid NOT NULL,
	`source_id` uuid NOT NULL,
	CONSTRAINT `claim_sources_claim_id_source_id_pk` PRIMARY KEY(`claim_id`,`source_id`)
);
--> statement-breakpoint
ALTER TABLE `claim_dependencies` ADD CONSTRAINT `claim_dependencies_claim_id_claims_claim_id_fk` FOREIGN KEY (`claim_id`) REFERENCES `claims`(`claim_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `claim_sources` ADD CONSTRAINT `claim_sources_claim_id_claims_claim_id_fk` FOREIGN KEY (`claim_id`) REFERENCES `claims`(`claim_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `claim_dependencies_depends_on_idx` ON `claim_dependencies` (`depends_on`);--> statement-breakpoint
CREATE INDEX `claim_sources_source_idx` ON `claim_sources` (`source_id`);--> statement-breakpoint
INSERT IGNORE INTO `claim_dependencies` (`claim_id`, `depends_on`) SELECT `c`.`claim_id`, `j`.`depends_on` FROM `claims` `c`, JSON_TABLE(`c`.`document`, '$.dependsOn[*]' COLUMNS (`depends_on` char(36) PATH '$')) `j`;--> statement-breakpoint
INSERT IGNORE INTO `claim_sources` (`claim_id`, `source_id`) SELECT `c`.`claim_id`, `j`.`source_id` FROM `claims` `c`, JSON_TABLE(`c`.`document`, '$.sourceIds[*]' COLUMNS (`source_id` char(36) PATH '$')) `j`;
