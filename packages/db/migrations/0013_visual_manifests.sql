CREATE TABLE `visual_manifests` (
	`visual_id` uuid NOT NULL,
	`kind` varchar(32) NOT NULL,
	`sha256` char(64) NOT NULL,
	`document` json NOT NULL,
	CONSTRAINT `visual_manifests_visual_id` PRIMARY KEY(`visual_id`)
);
