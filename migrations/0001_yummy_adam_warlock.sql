CREATE TABLE `legal_intake_references` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`original_actor_id` text NOT NULL,
	`original_actor_kind` text NOT NULL,
	`current_authorized_user_id` text,
	`payload_digest` text NOT NULL,
	`digest_key_id` text NOT NULL,
	`digest_version` integer NOT NULL,
	`blawby_intake_id` text,
	`checkout_session_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`original_actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`current_authorized_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "legal_intake_references_actor_kind_check" CHECK(original_actor_kind IN ('human', 'anonymous'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_intake_references_blawby_intake_id_unique` ON `legal_intake_references` (`blawby_intake_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `legal_intake_references_checkout_session_id_unique` ON `legal_intake_references` (`checkout_session_id`);--> statement-breakpoint
CREATE INDEX `idx_legal_intake_references_site_actor` ON `legal_intake_references` (`site_id`,`original_actor_id`);--> statement-breakpoint
CREATE INDEX `legal_intake_references_organization_id_idx` ON `legal_intake_references` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_legal_intake_references_actor` ON `legal_intake_references` (`original_actor_id`);