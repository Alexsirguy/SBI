CREATE TABLE `catalog_gaps` (
	`term` varchar(60) NOT NULL,
	`source` varchar(32) NOT NULL,
	`count` int NOT NULL,
	`first_seen` datetime(3) NOT NULL,
	`last_seen` datetime(3) NOT NULL,
	CONSTRAINT `catalog_gaps_term_source_pk` PRIMARY KEY(`term`,`source`)
);
--> statement-breakpoint
CREATE INDEX `catalog_gaps_count_idx` ON `catalog_gaps` (`count`);