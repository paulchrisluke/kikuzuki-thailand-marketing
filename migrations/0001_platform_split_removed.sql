-- Removes the platform split from the schema and data (#870, #873).
--
-- SQLite cannot alter a CHECK constraint, so the four constrained tables are
-- rebuilt. Drizzle's generated order drops each table while its children still
-- reference it; D1 enforces foreign keys unconditionally and would cascade those
-- drops into the children. This file keeps drizzle's definitions (see
-- meta/0001_snapshot.json) but builds the new tables beside the old ones,
-- recreates every dependent table against them, drops the old tables leaf-first
-- (their cascades only reach other old tables), and renames the new tables last.
PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `requests_new` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`organization_id` text,
	`site_id` text,
	`location_id` text,
	`product_id` text,
	`customer_id` text,
	`assigned_to` text,
	`review_id` text,
	`status` text,
	`priority` text,
	`booking_date` text,
	`time_slot` text,
	`party_size` integer,
	`conversation_state` text,
	`resolved_at` text,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_to`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`review_id`) REFERENCES `reviews_new`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`) REFERENCES `business_locations`(`organization_id`,`site_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`site_id`,`product_id`) REFERENCES `products`(`organization_id`,`site_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`,`product_id`) REFERENCES `products`(`organization_id`,`site_id`,`location_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "requests_instants_check" CHECK((resolved_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', resolved_at, '+0 days') IS resolved_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "requests_kind_check" CHECK(kind IN ('contact', 'reservation', 'experience_booking', 'work')),
	CONSTRAINT "requests_payload_check" CHECK(json_valid(payload_json) AND json_type(payload_json) = 'object'),
	CONSTRAINT "requests_guest_payload_check" CHECK(kind = 'work' OR (json_type(payload_json, '$.guest.name') IS 'text' AND json_type(payload_json, '$.guest.email') IS 'text' AND (json_type(payload_json, '$.guest.phone') IS 'text' OR json_type(payload_json, '$.guest.phone') IS 'null'))),
	CONSTRAINT "requests_booking_payload_check" CHECK(kind NOT IN ('reservation', 'experience_booking') OR (json_type(payload_json, '$.party_size_is_minimum') IN ('true', 'false') AND json_type(payload_json, '$.cancellation') IS 'object' AND json_type(payload_json, '$.completion') IS 'object' AND json_type(payload_json, '$.review') IS 'object' AND (kind != 'reservation' OR json_type(payload_json, '$.guest.phone') IS 'text')) IS TRUE),
	CONSTRAINT "requests_work_payload_check" CHECK(kind != 'work' OR (json_type(payload_json, '$.title') IS 'text' AND (payload_json ->> '$.type') IN ('content_update', 'product_update', 'seo', 'google_places', 'seasonal', 'photo_update', 'social_media', 'technical', 'other') AND (payload_json ->> '$.source') IN ('dashboard', 'whatsapp')) IS TRUE),
	CONSTRAINT "requests_message_payload_check" CHECK(kind <> 'contact' OR json_type(payload_json, '$.message') IS 'text'),
	CONSTRAINT "requests_scope_check" CHECK((kind = 'work' AND organization_id IS NOT NULL AND location_id IS NULL AND product_id IS NULL AND customer_id IS NULL) OR (kind IN ('contact', 'reservation', 'experience_booking') AND organization_id IS NOT NULL AND site_id IS NOT NULL)),
	CONSTRAINT "requests_booking_check" CHECK((kind IN ('reservation', 'experience_booking') AND location_id IS NOT NULL AND booking_date IS NOT NULL AND date(booking_date, '+0 days') IS booking_date AND time_slot IS NOT NULL AND time_slot GLOB '[0-2][0-9]:[0-5][0-9]' AND time_slot < '24:00' AND party_size IS NOT NULL AND party_size > 0 AND status IS NOT NULL AND status IN ('pending', 'confirmed', 'cancelled', 'completed') AND (kind != 'experience_booking' OR product_id IS NOT NULL) AND (kind != 'reservation' OR product_id IS NULL)) OR (kind NOT IN ('reservation', 'experience_booking') AND booking_date IS NULL AND time_slot IS NULL AND party_size IS NULL)),
	CONSTRAINT "requests_state_check" CHECK((kind = 'work' AND status IS NOT NULL AND status IN ('pending', 'in_progress', 'done', 'cancelled') AND priority IS NOT NULL AND priority IN ('low', 'normal', 'high', 'urgent') AND conversation_state IS NULL) OR (kind IN ('contact', 'reservation', 'experience_booking') AND conversation_state IS NOT NULL AND conversation_state IN ('needs_attention', 'waiting_on_guest', 'resolved') AND priority IS NULL AND assigned_to IS NULL AND (kind != 'contact' OR status IS NULL)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_review_owner_unique_new` ON `requests_new` (`organization_id`,`site_id`,`id`,`kind`);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_scope_id_unique_new` ON `requests_new` (`organization_id`,`site_id`,`id`);
--> statement-breakpoint
CREATE INDEX `requests_site_activity_idx_new` ON `requests_new` (`site_id`,`conversation_state`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `requests_booking_slot_idx_new` ON `requests_new` (`site_id`,`kind`,`location_id`,`product_id`,`booking_date`,`time_slot`,`status`);
--> statement-breakpoint
CREATE INDEX `requests_customer_idx_new` ON `requests_new` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `requests_work_queue_idx_new` ON `requests_new` (`kind`,`status`,`priority`,`created_at`);
--> statement-breakpoint
CREATE INDEX `requests_org_created_idx_new` ON `requests_new` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `activity_entries_new` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`scope_kind` text NOT NULL,
	`organization_id` text,
	`site_id` text,
	`context_site_id` text,
	`location_id` text,
	`request_id` text,
	`parent_id` text,
	`actor_kind` text NOT NULL,
	`actor_user_id` text,
	`target_user_id` text,
	`channel` text,
	`body` text,
	`event_name` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`dedupe_key` text NOT NULL,
	`sequence` integer,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`context_site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`request_id`) REFERENCES `requests_new`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `activity_entries_new`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "activity_entries_instants_check" CHECK((occurred_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at, '+0 days') IS occurred_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
	CONSTRAINT "activity_entries_kind_check" CHECK(kind IN ('submission', 'message', 'operation', 'assignment', 'resolution', 'notification', 'acknowledgement', 'audit')),
	CONSTRAINT "activity_entries_scope_check" CHECK((scope_kind = 'request' AND request_id IS NOT NULL AND organization_id IS NULL AND site_id IS NULL AND context_site_id IS NULL AND location_id IS NULL) OR (scope_kind = 'site' AND kind = 'audit' AND site_id IS NOT NULL AND context_site_id IS NULL AND organization_id IS NULL AND request_id IS NULL) OR (scope_kind = 'organization' AND organization_id IS NOT NULL AND site_id IS NULL AND request_id IS NULL) OR (scope_kind = 'global' AND organization_id IS NULL AND site_id IS NULL AND context_site_id IS NULL AND request_id IS NULL)),
	CONSTRAINT "activity_entries_actor_check" CHECK(actor_kind IN ('guest', 'member', 'system', 'cloudflare')),
	CONSTRAINT "activity_entries_channel_check" CHECK(channel IS NULL OR channel IN ('web', 'email', 'whatsapp', 'system')),
	CONSTRAINT "activity_entries_payload_check" CHECK(json_valid(payload_json) AND json_type(payload_json) = 'object'),
	CONSTRAINT "activity_entries_timeline_check" CHECK((kind IN ('submission', 'message', 'operation', 'assignment', 'resolution') AND request_id IS NOT NULL AND sequence IS NOT NULL AND sequence > 0 AND scope_kind = 'request') OR (kind NOT IN ('submission', 'message', 'operation', 'assignment', 'resolution') AND sequence IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_dedupe_key_unique_new` ON `activity_entries_new` (`dedupe_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_request_sequence_unique_new` ON `activity_entries_new` (`request_id`,`sequence`);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_notification_source_unique_new` ON `activity_entries_new` (`parent_id`) WHERE kind = 'notification' AND parent_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `activity_entries_request_occurred_idx_new` ON `activity_entries_new` (`request_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_parent_actor_idx_new` ON `activity_entries_new` (`parent_id`,`actor_user_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_context_site_created_idx_new` ON `activity_entries_new` (`kind`,`context_site_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_site_created_idx_new` ON `activity_entries_new` (`kind`,`site_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_org_created_idx_new` ON `activity_entries_new` (`kind`,`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_target_created_idx_new` ON `activity_entries_new` (`kind`,`target_user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `guest_thread_deliveries_new` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`channel` text NOT NULL,
	`provider` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_message_id` text,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `activity_entries_new`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "guest_thread_deliveries_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "guest_thread_deliveries_channel_check" CHECK(channel IN ('email', 'whatsapp')),
	CONSTRAINT "guest_thread_deliveries_provider_check" CHECK((channel = 'email' AND provider IN ('resend', 'log_only')) OR (channel = 'whatsapp' AND provider IN ('meta', 'log_only'))),
	CONSTRAINT "guest_thread_deliveries_purpose_check" CHECK(purpose IN ('owner_alert', 'guest_acknowledgement', 'member_reply', 'status_update')),
	CONSTRAINT "guest_thread_deliveries_status_check" CHECK(status IN ('pending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_thread_deliveries_provider_message_unique_new` ON `guest_thread_deliveries_new` (`provider`,`provider_message_id`) WHERE provider_message_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `guest_thread_deliveries_entry_status_idx_new` ON `guest_thread_deliveries_new` (`entry_id`,`status`);
--> statement-breakpoint
CREATE TABLE `review_requests_new` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`location_id` text,
	`customer_id` text NOT NULL,
	`booking_type` text NOT NULL,
	`booking_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`first_sent_at` text,
	`reminder_sent_at` text,
	`submitted_at` text,
	`clicked_at` text,
	`revoked_at` text,
	`send_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`anonymous_user_id` text,
	`user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`anonymous_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`,`booking_id`,`booking_type`) REFERENCES `requests_new`(`organization_id`,`site_id`,`id`,`kind`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_requests_instants_check" CHECK((expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', expires_at, '+0 days') IS expires_at) AND (first_sent_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', first_sent_at, '+0 days') IS first_sent_at) AND (reminder_sent_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', reminder_sent_at, '+0 days') IS reminder_sent_at) AND (submitted_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', submitted_at, '+0 days') IS submitted_at) AND (clicked_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', clicked_at, '+0 days') IS clicked_at) AND (revoked_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', revoked_at, '+0 days') IS revoked_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "review_requests_booking_type_check" CHECK(booking_type IN ('reservation', 'experience_booking'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_requests_token_hash_unique_new` ON `review_requests_new` (`token_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_review_requests_active_booking_unique_new` ON `review_requests_new` (`site_id`,`booking_type`,`booking_id`) WHERE revoked_at IS NULL AND submitted_at IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_review_requests_send_due_new` ON `review_requests_new` (`site_id`,`first_sent_at`,`reminder_sent_at`,`submitted_at`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `review_requests_organization_id_idx_new` ON `review_requests_new` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `reviews_new` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`site_id` text,
	`location_id` text,
	`customer_id` text,
	`booking_id` text,
	`booking_type` text,
	`review_request_id` text,
	`user_id` text,
	`product_id` text,
	`author_name` text,
	`rating` integer NOT NULL,
	`title` text,
	`content` text,
	`google_review_id` text,
	`google_review_metadata` text,
	`owner_reply` text,
	`owner_reply_at` text,
	`helpful_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`entered_by_user_id` text,
	`collection_method` text,
	`original_review_date` text,
	`original_reference` text,
	`publication_authorized` integer DEFAULT 0 NOT NULL,
	`ip_hash` text,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`review_request_id`) REFERENCES `review_requests_new`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`entered_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`,`product_id`) REFERENCES `products`(`organization_id`,`site_id`,`location_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "reviews_instants_check" CHECK((owner_reply_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', owner_reply_at, '+0 days') IS owner_reply_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "reviews_status_check" CHECK(status IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "reviews_google_review_metadata_check" CHECK(google_review_metadata IS NULL OR (json_valid(google_review_metadata) AND json_type(google_review_metadata) IS 'object')),
	CONSTRAINT "reviews_booking_type_check" CHECK(booking_type IS NULL OR booking_type IN ('reservation', 'experience_booking')),
	CONSTRAINT "reviews_rating_check" CHECK(rating BETWEEN 1 AND 5),
	CONSTRAINT "reviews_publication_authorized_check" CHECK(publication_authorized IN (0, 1)),
	CONSTRAINT "reviews_collection_method_check" CHECK(collection_method IS NULL OR collection_method IN ('in_person', 'email', 'phone', 'migration', 'other')),
	CONSTRAINT "reviews_product_scope_check" CHECK(product_id IS NULL OR (organization_id IS NOT NULL AND site_id IS NOT NULL AND location_id IS NOT NULL)),
	CONSTRAINT "reviews_owner_entered_provenance_check" CHECK(source != 'owner_entered' OR (organization_id IS NOT NULL AND site_id IS NOT NULL AND location_id IS NULL AND entered_by_user_id IS NOT NULL AND collection_method IS NOT NULL AND publication_authorized = 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_google_review_scope_unique_new` ON `reviews_new` (`organization_id`,`site_id`,`location_id`,`google_review_id`);
--> statement-breakpoint
CREATE INDEX `idx_reviews_request_id_new` ON `reviews_new` (`review_request_id`);
--> statement-breakpoint
CREATE INDEX `idx_reviews_customer_id_new` ON `reviews_new` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `idx_reviews_location_status_new` ON `reviews_new` (`location_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_reviews_site_status_new` ON `reviews_new` (`site_id`,`status`,`created_at`) WHERE location_id IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_reviews_product_status_created_new` ON `reviews_new` (`product_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `reviews_organization_id_idx_new` ON `reviews_new` (`organization_id`);
--> statement-breakpoint
INSERT INTO `requests_new` ("id", "kind", "organization_id", "site_id", "location_id", "product_id", "customer_id", "assigned_to", "review_id", "status", "priority", "booking_date", "time_slot", "party_size", "conversation_state", "resolved_at", "payload_json", "created_at", "updated_at") SELECT "id", "kind", "organization_id", "site_id", "location_id", "product_id", "customer_id", "assigned_to", "review_id", "status", "priority", "booking_date", "time_slot", "party_size", "conversation_state", "resolved_at", "payload_json", "created_at", "updated_at" FROM `requests` WHERE kind <> 'platform_contact';
--> statement-breakpoint
INSERT INTO `activity_entries_new` ("id", "kind", "scope_kind", "organization_id", "site_id", "context_site_id", "location_id", "request_id", "parent_id", "actor_kind", "actor_user_id", "target_user_id", "channel", "body", "event_name", "payload_json", "dedupe_key", "sequence", "occurred_at", "created_at") SELECT "id", "kind", CASE scope_kind WHEN 'platform' THEN 'global' ELSE scope_kind END, "organization_id", "site_id", "context_site_id", "location_id", "request_id", "parent_id", "actor_kind", "actor_user_id", "target_user_id", "channel", "body", "event_name", "payload_json", "dedupe_key", "sequence", "occurred_at", "created_at" FROM `activity_entries`;
--> statement-breakpoint
INSERT INTO `guest_thread_deliveries_new` ("id", "entry_id", "channel", "provider", "purpose", "status", "provider_message_id", "error", "created_at", "updated_at") SELECT "id", "entry_id", "channel", "provider", "purpose", "status", "provider_message_id", "error", "created_at", "updated_at" FROM `guest_thread_deliveries`;
--> statement-breakpoint
INSERT INTO `review_requests_new` ("id", "organization_id", "site_id", "location_id", "customer_id", "booking_type", "booking_id", "token_hash", "expires_at", "first_sent_at", "reminder_sent_at", "submitted_at", "clicked_at", "revoked_at", "send_count", "last_error", "anonymous_user_id", "user_id", "created_at", "updated_at") SELECT "id", "organization_id", "site_id", "location_id", "customer_id", "booking_type", "booking_id", "token_hash", "expires_at", "first_sent_at", "reminder_sent_at", "submitted_at", "clicked_at", "revoked_at", "send_count", "last_error", "anonymous_user_id", "user_id", "created_at", "updated_at" FROM `review_requests`;
--> statement-breakpoint
INSERT INTO `reviews_new` ("id", "organization_id", "site_id", "location_id", "customer_id", "booking_id", "booking_type", "review_request_id", "user_id", "product_id", "author_name", "rating", "title", "content", "google_review_id", "google_review_metadata", "owner_reply", "owner_reply_at", "helpful_count", "status", "source", "entered_by_user_id", "collection_method", "original_review_date", "original_reference", "publication_authorized", "ip_hash", "user_agent", "created_at", "updated_at") SELECT "id", "organization_id", "site_id", "location_id", "customer_id", "booking_id", "booking_type", "review_request_id", "user_id", "product_id", "author_name", "rating", "title", "content", "google_review_id", "google_review_metadata", "owner_reply", "owner_reply_at", "helpful_count", "status", "source", "entered_by_user_id", "collection_method", "original_review_date", "original_reference", "publication_authorized", "ip_hash", "user_agent", "created_at", "updated_at" FROM `reviews`;
--> statement-breakpoint
DROP TABLE `reviews`;
--> statement-breakpoint
DROP TABLE `review_requests`;
--> statement-breakpoint
DROP TABLE `guest_thread_deliveries`;
--> statement-breakpoint
DROP TABLE `activity_entries`;
--> statement-breakpoint
DROP TABLE `requests`;
--> statement-breakpoint
DROP INDEX `requests_review_owner_unique_new`;
--> statement-breakpoint
DROP INDEX `requests_scope_id_unique_new`;
--> statement-breakpoint
DROP INDEX `requests_site_activity_idx_new`;
--> statement-breakpoint
DROP INDEX `requests_booking_slot_idx_new`;
--> statement-breakpoint
DROP INDEX `requests_customer_idx_new`;
--> statement-breakpoint
DROP INDEX `requests_work_queue_idx_new`;
--> statement-breakpoint
DROP INDEX `requests_org_created_idx_new`;
--> statement-breakpoint
ALTER TABLE `requests_new` RENAME TO `requests`;
--> statement-breakpoint
DROP INDEX `activity_entries_dedupe_key_unique_new`;
--> statement-breakpoint
DROP INDEX `activity_entries_request_sequence_unique_new`;
--> statement-breakpoint
DROP INDEX `activity_entries_notification_source_unique_new`;
--> statement-breakpoint
DROP INDEX `activity_entries_request_occurred_idx_new`;
--> statement-breakpoint
DROP INDEX `activity_entries_parent_actor_idx_new`;
--> statement-breakpoint
DROP INDEX `activity_entries_context_site_created_idx_new`;
--> statement-breakpoint
DROP INDEX `activity_entries_site_created_idx_new`;
--> statement-breakpoint
DROP INDEX `activity_entries_org_created_idx_new`;
--> statement-breakpoint
DROP INDEX `activity_entries_target_created_idx_new`;
--> statement-breakpoint
ALTER TABLE `activity_entries_new` RENAME TO `activity_entries`;
--> statement-breakpoint
DROP INDEX `guest_thread_deliveries_provider_message_unique_new`;
--> statement-breakpoint
DROP INDEX `guest_thread_deliveries_entry_status_idx_new`;
--> statement-breakpoint
ALTER TABLE `guest_thread_deliveries_new` RENAME TO `guest_thread_deliveries`;
--> statement-breakpoint
DROP INDEX `review_requests_token_hash_unique_new`;
--> statement-breakpoint
DROP INDEX `idx_review_requests_active_booking_unique_new`;
--> statement-breakpoint
DROP INDEX `idx_review_requests_send_due_new`;
--> statement-breakpoint
DROP INDEX `review_requests_organization_id_idx_new`;
--> statement-breakpoint
ALTER TABLE `review_requests_new` RENAME TO `review_requests`;
--> statement-breakpoint
DROP INDEX `reviews_google_review_scope_unique_new`;
--> statement-breakpoint
DROP INDEX `idx_reviews_request_id_new`;
--> statement-breakpoint
DROP INDEX `idx_reviews_customer_id_new`;
--> statement-breakpoint
DROP INDEX `idx_reviews_location_status_new`;
--> statement-breakpoint
DROP INDEX `idx_reviews_site_status_new`;
--> statement-breakpoint
DROP INDEX `idx_reviews_product_status_created_new`;
--> statement-breakpoint
DROP INDEX `reviews_organization_id_idx_new`;
--> statement-breakpoint
ALTER TABLE `reviews_new` RENAME TO `reviews`;
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_review_owner_unique` ON `requests` (`organization_id`,`site_id`,`id`,`kind`);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_scope_id_unique` ON `requests` (`organization_id`,`site_id`,`id`);
--> statement-breakpoint
CREATE INDEX `requests_site_activity_idx` ON `requests` (`site_id`,`conversation_state`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `requests_booking_slot_idx` ON `requests` (`site_id`,`kind`,`location_id`,`product_id`,`booking_date`,`time_slot`,`status`);
--> statement-breakpoint
CREATE INDEX `requests_customer_idx` ON `requests` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `requests_work_queue_idx` ON `requests` (`kind`,`status`,`priority`,`created_at`);
--> statement-breakpoint
CREATE INDEX `requests_org_created_idx` ON `requests` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_dedupe_key_unique` ON `activity_entries` (`dedupe_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_request_sequence_unique` ON `activity_entries` (`request_id`,`sequence`);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_notification_source_unique` ON `activity_entries` (`parent_id`) WHERE kind = 'notification' AND parent_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `activity_entries_request_occurred_idx` ON `activity_entries` (`request_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_parent_actor_idx` ON `activity_entries` (`parent_id`,`actor_user_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_context_site_created_idx` ON `activity_entries` (`kind`,`context_site_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_site_created_idx` ON `activity_entries` (`kind`,`site_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_org_created_idx` ON `activity_entries` (`kind`,`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `activity_entries_target_created_idx` ON `activity_entries` (`kind`,`target_user_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_thread_deliveries_provider_message_unique` ON `guest_thread_deliveries` (`provider`,`provider_message_id`) WHERE provider_message_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `guest_thread_deliveries_entry_status_idx` ON `guest_thread_deliveries` (`entry_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_requests_token_hash_unique` ON `review_requests` (`token_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_review_requests_active_booking_unique` ON `review_requests` (`site_id`,`booking_type`,`booking_id`) WHERE revoked_at IS NULL AND submitted_at IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_review_requests_send_due` ON `review_requests` (`site_id`,`first_sent_at`,`reminder_sent_at`,`submitted_at`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `review_requests_organization_id_idx` ON `review_requests` (`organization_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_google_review_scope_unique` ON `reviews` (`organization_id`,`site_id`,`location_id`,`google_review_id`);
--> statement-breakpoint
CREATE INDEX `idx_reviews_request_id` ON `reviews` (`review_request_id`);
--> statement-breakpoint
CREATE INDEX `idx_reviews_customer_id` ON `reviews` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `idx_reviews_location_status` ON `reviews` (`location_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_reviews_site_status` ON `reviews` (`site_id`,`status`,`created_at`) WHERE location_id IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_reviews_product_status_created` ON `reviews` (`product_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `reviews_organization_id_idx` ON `reviews` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `content_documents_new` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`kind` text NOT NULL,
	`row_role` text NOT NULL,
	`root_id` text,
	`root_role` text,
	`locale` text,
	`location_id` text,
	`scope_path` text,
	`title` text,
	`slug` text,
	`path` text,
	`summary` text,
	`status` text,
	`visibility` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`source` text,
	`author_id` text,
	`created_by` text,
	`updated_by` text,
	`published_at` text,
	`first_published_at` text,
	`scheduled_for` text,
	`seo_title` text,
	`seo_description` text,
	`seo_keywords` text,
	`canonical_url` text,
	`robots` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`) REFERENCES `business_locations`(`organization_id`,`site_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`root_id`,`root_role`,`kind`) REFERENCES `content_documents_new`(`organization_id`,`site_id`,`id`,`row_role`,`kind`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`locale`) REFERENCES `site_locales`(`organization_id`,`site_id`,`locale`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "content_documents_instants_check" CHECK((published_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at, '+0 days') IS published_at) AND (first_published_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', first_published_at, '+0 days') IS first_published_at) AND (scheduled_for IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', scheduled_for, '+0 days') IS scheduled_for) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "content_documents_kind_check" CHECK(kind IN ('page', 'article', 'social_post', 'qa')),
	CONSTRAINT "content_documents_metadata_check" CHECK(json_valid(metadata_json) AND json_type(metadata_json) IS 'object'),
	CONSTRAINT "content_documents_role_check" CHECK((row_role = 'root' AND root_id IS NULL AND root_role IS NULL AND locale = 'en') OR (row_role = 'representation' AND root_id IS NOT NULL AND root_id <> id AND root_role = 'root' AND locale IS NOT NULL AND locale <> 'en' AND location_id IS NULL AND scope_path IS NULL AND status IS NULL AND visibility IS NULL AND source IS NULL AND author_id IS NULL AND published_at IS NULL AND first_published_at IS NULL AND scheduled_for IS NULL)),
	CONSTRAINT "content_documents_path_check" CHECK(path IS NULL OR (path LIKE '/%' AND path NOT LIKE '//%')),
	CONSTRAINT "content_documents_page_copy_check" CHECK(kind <> 'page' OR (path IS NOT NULL AND title IS NOT NULL)),
	CONSTRAINT "content_documents_page_type_check" CHECK(kind <> 'page' OR row_role <> 'root' OR ((metadata_json ->> '$.page_type') IN ('custom','recipe','legal','system')) IS 1),
	CONSTRAINT "content_documents_channel_names_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR json_type(metadata_json, '$.channels') IS NULL OR (json_type(metadata_json, '$.channels') IS 'object' AND json_remove(json_extract(metadata_json, '$.channels'), '$.facebook', '$.instagram') = '{}')),
	CONSTRAINT "content_documents_qa_scope_check" CHECK(kind <> 'qa' OR row_role <> 'root' OR ((location_id IS NULL OR scope_path IS NULL) AND (scope_path IS NULL OR scope_path LIKE '/%'))),
	CONSTRAINT "content_documents_publication_check" CHECK(row_role <> 'root' OR kind NOT IN ('article', 'social_post') OR (status IN ('draft','published','scheduled')) IS 1),
	CONSTRAINT "content_documents_social_schedule_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR ((status = 'draft' AND scheduled_for IS NULL AND published_at IS NULL) OR (status = 'scheduled' AND scheduled_for IS NOT NULL AND published_at IS NULL) OR (status = 'published' AND scheduled_for IS NULL AND published_at IS NOT NULL))),
	CONSTRAINT "content_documents_article_visibility_check" CHECK(kind NOT IN ('article','social_post') OR row_role <> 'root' OR (visibility IN ('public','unlisted')) IS 1),
	CONSTRAINT "content_documents_qa_state_check" CHECK(kind <> 'qa' OR row_role <> 'root' OR ((status IN ('published','hidden')) IS 1 AND (source IN ('manual','import','template')) IS 1)),
	CONSTRAINT "content_documents_qa_counts_check" CHECK(kind <> 'qa' OR row_role <> 'root' OR ((json_type(metadata_json, '$.is_owner_answer') = 'integer' AND json_type(metadata_json, '$.upvote_count') = 'integer') IS 1)),
	CONSTRAINT "content_documents_copy_required_check" CHECK(row_role <> 'root' OR ((kind NOT IN ('page','article','qa') OR title IS NOT NULL) AND (kind <> 'article' OR slug IS NOT NULL) AND (kind <> 'social_post' OR summary IS NOT NULL))),
	CONSTRAINT "content_documents_article_tags_check" CHECK(kind <> 'article' OR json_type(metadata_json, '$.tags') IS NULL OR json_type(metadata_json, '$.tags') IN ('array','null')),
	CONSTRAINT "content_documents_social_source_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR (source IN ('manual','template')) IS 1),
	CONSTRAINT "content_documents_social_post_type_check" CHECK((kind <> 'social_post' OR row_role <> 'root' OR ((metadata_json ->> '$.post_type') IN ('standard', 'offer', 'event', 'alert'))) IS 1),
	CONSTRAINT "content_documents_social_event_json_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR ((metadata_json ->> '$.event') IS NULL OR (json_valid((metadata_json ->> '$.event')) AND json_type((metadata_json ->> '$.event')) IS 'object' AND json_type((metadata_json ->> '$.event'), '$.title') IS 'text' AND length(trim(json_extract((metadata_json ->> '$.event'), '$.title'))) > 0 AND json_type((metadata_json ->> '$.event'), '$.schedule') IS 'object' AND json_type((metadata_json ->> '$.event'), '$.schedule.start_date') IS 'text' AND json_type((metadata_json ->> '$.event'), '$.schedule.start_time') IS 'text' AND json_type((metadata_json ->> '$.event'), '$.schedule.end_date') IS 'text' AND json_type((metadata_json ->> '$.event'), '$.schedule.end_time') IS 'text'))),
	CONSTRAINT "content_documents_social_offer_json_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR ((metadata_json ->> '$.offer') IS NULL OR (json_valid((metadata_json ->> '$.offer')) AND json_type((metadata_json ->> '$.offer')) IS 'object'))),
	CONSTRAINT "content_documents_social_call_to_action_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR ((metadata_json ->> '$.call_to_action') IS NULL OR (json_valid((metadata_json ->> '$.call_to_action')) AND json_type((metadata_json ->> '$.call_to_action')) IS 'object' AND (json_extract((metadata_json ->> '$.call_to_action'), '$.action_type') IN ('book', 'order', 'shop', 'learn_more', 'sign_up', 'call')) IS 1 AND ((json_extract((metadata_json ->> '$.call_to_action'), '$.action_type') = 'call' AND json_type((metadata_json ->> '$.call_to_action'), '$.url') IS NULL) OR (json_extract((metadata_json ->> '$.call_to_action'), '$.action_type') <> 'call' AND json_type((metadata_json ->> '$.call_to_action'), '$.url') IS 'text' AND length(trim(json_extract((metadata_json ->> '$.call_to_action'), '$.url'))) > 0))))),
	CONSTRAINT "content_documents_social_topic_shape_check" CHECK((kind <> 'social_post' OR row_role <> 'root' OR (((metadata_json ->> '$.post_type') = 'standard' AND (metadata_json ->> '$.event') IS NULL AND (metadata_json ->> '$.offer') IS NULL AND (metadata_json ->> '$.alert_type') IS NULL) OR ((metadata_json ->> '$.post_type') = 'event' AND (metadata_json ->> '$.event') IS NOT NULL AND (metadata_json ->> '$.offer') IS NULL AND (metadata_json ->> '$.alert_type') IS NULL) OR ((metadata_json ->> '$.post_type') = 'offer' AND (metadata_json ->> '$.event') IS NOT NULL AND (metadata_json ->> '$.offer') IS NOT NULL AND (metadata_json ->> '$.call_to_action') IS NULL AND (metadata_json ->> '$.alert_type') IS NULL) OR ((metadata_json ->> '$.post_type') = 'alert' AND (metadata_json ->> '$.event') IS NULL AND (metadata_json ->> '$.offer') IS NULL AND (metadata_json ->> '$.alert_type') IS 'covid_19'))) IS 1),
	CONSTRAINT "content_documents_channel_facebook_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR (json_type(metadata_json, '$.channels.facebook') IS NULL OR (json_type(metadata_json, '$.channels.facebook') IS 'object' AND json_type(metadata_json, '$.channels.facebook.created_at') IS 'text' AND (((metadata_json ->> '$.channels.facebook.status') = 'pending' AND (metadata_json ->> '$.channels.facebook.provider_post_id') IS NULL AND (metadata_json ->> '$.channels.facebook.published_at') IS NULL AND (metadata_json ->> '$.channels.facebook.error_message') IS NULL) OR ((metadata_json ->> '$.channels.facebook.status') = 'published' AND (metadata_json ->> '$.channels.facebook.provider_post_id') IS NOT NULL AND (metadata_json ->> '$.channels.facebook.published_at') IS NOT NULL AND (metadata_json ->> '$.channels.facebook.error_message') IS NULL) OR ((metadata_json ->> '$.channels.facebook.status') IN ('failed','skipped') AND (metadata_json ->> '$.channels.facebook.provider_post_id') IS NULL AND (metadata_json ->> '$.channels.facebook.published_at') IS NULL AND (metadata_json ->> '$.channels.facebook.error_message') IS NOT NULL))) IS 1)),
	CONSTRAINT "content_documents_channel_instagram_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR (json_type(metadata_json, '$.channels.instagram') IS NULL OR (json_type(metadata_json, '$.channels.instagram') IS 'object' AND json_type(metadata_json, '$.channels.instagram.created_at') IS 'text' AND (((metadata_json ->> '$.channels.instagram.status') = 'pending' AND (metadata_json ->> '$.channels.instagram.provider_post_id') IS NULL AND (metadata_json ->> '$.channels.instagram.published_at') IS NULL AND (metadata_json ->> '$.channels.instagram.error_message') IS NULL) OR ((metadata_json ->> '$.channels.instagram.status') = 'published' AND (metadata_json ->> '$.channels.instagram.provider_post_id') IS NOT NULL AND (metadata_json ->> '$.channels.instagram.published_at') IS NOT NULL AND (metadata_json ->> '$.channels.instagram.error_message') IS NULL) OR ((metadata_json ->> '$.channels.instagram.status') IN ('failed','skipped') AND (metadata_json ->> '$.channels.instagram.provider_post_id') IS NULL AND (metadata_json ->> '$.channels.instagram.published_at') IS NULL AND (metadata_json ->> '$.channels.instagram.error_message') IS NOT NULL))) IS 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_root_locale_unique_new` ON `content_documents_new` (`root_id`,`locale`) WHERE row_role = 'representation';
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_route_unique_new` ON `content_documents_new` (`site_id`,`locale`,`path`) WHERE row_role IN ('root','representation') AND path IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_slug_unique_new` ON `content_documents_new` (`site_id`,`kind`,`locale`,`slug`) WHERE row_role IN ('root','representation') AND slug IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_links_site_unique_new` ON `content_documents_new` (`site_id`) WHERE row_role = 'root' AND kind = 'page' AND json_extract(metadata_json, '$.recipe') = 'links';
--> statement-breakpoint
CREATE INDEX `content_documents_site_kind_status_idx_new` ON `content_documents_new` (`site_id`,`kind`,`row_role`,`status`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `content_documents_location_kind_status_idx_new` ON `content_documents_new` (`location_id`,`kind`,`row_role`,`status`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `content_documents_schedule_idx_new` ON `content_documents_new` (`kind`,`status`,`scheduled_for`) WHERE row_role = 'root' AND status = 'scheduled';
--> statement-breakpoint
CREATE INDEX `content_documents_facebook_post_idx_new` ON `content_documents_new` (`site_id`,(metadata_json ->> '$.channels.facebook.provider_post_id')) WHERE row_role = 'root' AND kind = 'social_post';
--> statement-breakpoint
CREATE INDEX `content_documents_instagram_post_idx_new` ON `content_documents_new` (`site_id`,(metadata_json ->> '$.channels.instagram.provider_post_id')) WHERE row_role = 'root' AND kind = 'social_post';
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_scope_role_unique_new` ON `content_documents_new` (`organization_id`,`site_id`,`id`,`row_role`,`kind`);
--> statement-breakpoint
CREATE TABLE `content_blocks_new` (
	`id` text PRIMARY KEY NOT NULL,
	`source_block_id` text,
	`document_id` text NOT NULL,
	`parent_block_id` text,
	`type` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`level` integer,
	`data_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `content_documents_new`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_block_id`) REFERENCES `content_blocks_new`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`,`parent_block_id`) REFERENCES `content_blocks_new`(`document_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "content_blocks_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "content_blocks_source_check" CHECK(source_block_id IS NULL OR source_block_id <> id),
	CONSTRAINT "content_blocks_type_check" CHECK(type IN ('heading', 'markdown', 'image', 'gallery', 'faq', 'how_to', 'divider', 'ai_assistance', 'cta', 'callout', 'hero', 'button_group', 'feature_grid', 'testimonial_grid', 'contact_cta', 'booking_cta', 'donation_choices', 'offering_grid', 'location_grid')),
	CONSTRAINT "content_blocks_data_json_check" CHECK(json_valid(data_json) AND json_type(data_json) IS 'object'),
	CONSTRAINT "content_blocks_parent_check" CHECK(parent_block_id IS NULL OR parent_block_id <> id),
	CONSTRAINT "content_blocks_position_check" CHECK(position >= 0),
	CONSTRAINT "content_blocks_level_check" CHECK(level IS NULL OR level BETWEEN 1 AND 6)
);
--> statement-breakpoint
CREATE INDEX `content_blocks_document_position_idx_new` ON `content_blocks_new` (`document_id`,`position`);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_blocks_document_source_unique_new` ON `content_blocks_new` (`document_id`,`source_block_id`) WHERE source_block_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `content_blocks_parent_idx_new` ON `content_blocks_new` (`parent_block_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_blocks_document_id_unique_new` ON `content_blocks_new` (`document_id`,`id`);
--> statement-breakpoint
INSERT INTO `content_documents_new` ("id", "organization_id", "site_id", "kind", "row_role", "root_id", "root_role", "locale", "location_id", "scope_path", "title", "slug", "path", "summary", "status", "visibility", "sort_order", "source", "author_id", "created_by", "updated_by", "published_at", "first_published_at", "scheduled_for", "seo_title", "seo_description", "seo_keywords", "canonical_url", "robots", "metadata_json", "created_at", "updated_at") SELECT "id", "organization_id", "site_id", CASE kind WHEN 'platform_doc' THEN 'page' ELSE kind END, "row_role", "root_id", "root_role", "locale", "location_id", "scope_path", "title", CASE kind WHEN 'platform_doc' THEN NULL ELSE slug END, CASE kind WHEN 'platform_doc' THEN '/docs/' || (CASE (metadata_json ->> '$.category')
      WHEN 'Getting Started' THEN 'getting-started' WHEN 'Menu Management' THEN 'menu-management'
      WHEN 'Theme Customization' THEN 'theme-customization' WHEN 'SEO & Marketing' THEN 'seo-marketing'
      WHEN 'Integrations' THEN 'integrations' WHEN 'Advanced' THEN 'advanced' END) || CASE WHEN slug = (CASE (metadata_json ->> '$.category')
      WHEN 'Getting Started' THEN 'getting-started' WHEN 'Menu Management' THEN 'menu-management'
      WHEN 'Theme Customization' THEN 'theme-customization' WHEN 'SEO & Marketing' THEN 'seo-marketing'
      WHEN 'Integrations' THEN 'integrations' WHEN 'Advanced' THEN 'advanced' END) THEN '' ELSE '/' || slug END ELSE path END, "summary", "status", "visibility", "sort_order", "source", "author_id", "created_by", "updated_by", "published_at", "first_published_at", "scheduled_for", "seo_title", "seo_description", "seo_keywords", "canonical_url", "robots", CASE kind WHEN 'platform_doc' THEN json_object('page_type', 'system') WHEN 'article' THEN json_remove(metadata_json, '$.nav_section', '$.nav_title', '$.nav_order', '$.nav_section_order', '$.nav_group', '$.nav_group_order', '$.hide_from_nav', '$.featured_order') ELSE metadata_json END, "created_at", "updated_at" FROM `content_documents`;
--> statement-breakpoint
INSERT INTO `content_blocks_new` ("id", "source_block_id", "document_id", "parent_block_id", "type", "position", "level", "data_json", "created_at", "updated_at") SELECT "id", "source_block_id", "document_id", "parent_block_id", "type", "position", "level", "data_json", "created_at", "updated_at" FROM `content_blocks`;
--> statement-breakpoint
DROP TABLE `content_blocks`;
--> statement-breakpoint
DROP TABLE `content_documents`;
--> statement-breakpoint
DROP INDEX `content_documents_root_locale_unique_new`;
--> statement-breakpoint
DROP INDEX `content_documents_route_unique_new`;
--> statement-breakpoint
DROP INDEX `content_documents_slug_unique_new`;
--> statement-breakpoint
DROP INDEX `content_documents_links_site_unique_new`;
--> statement-breakpoint
DROP INDEX `content_documents_site_kind_status_idx_new`;
--> statement-breakpoint
DROP INDEX `content_documents_location_kind_status_idx_new`;
--> statement-breakpoint
DROP INDEX `content_documents_schedule_idx_new`;
--> statement-breakpoint
DROP INDEX `content_documents_facebook_post_idx_new`;
--> statement-breakpoint
DROP INDEX `content_documents_instagram_post_idx_new`;
--> statement-breakpoint
DROP INDEX `content_documents_scope_role_unique_new`;
--> statement-breakpoint
ALTER TABLE `content_documents_new` RENAME TO `content_documents`;
--> statement-breakpoint
DROP INDEX `content_blocks_document_position_idx_new`;
--> statement-breakpoint
DROP INDEX `content_blocks_document_source_unique_new`;
--> statement-breakpoint
DROP INDEX `content_blocks_parent_idx_new`;
--> statement-breakpoint
DROP INDEX `content_blocks_document_id_unique_new`;
--> statement-breakpoint
ALTER TABLE `content_blocks_new` RENAME TO `content_blocks`;
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_root_locale_unique` ON `content_documents` (`root_id`,`locale`) WHERE row_role = 'representation';
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_route_unique` ON `content_documents` (`site_id`,`locale`,`path`) WHERE row_role IN ('root','representation') AND path IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_slug_unique` ON `content_documents` (`site_id`,`kind`,`locale`,`slug`) WHERE row_role IN ('root','representation') AND slug IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_links_site_unique` ON `content_documents` (`site_id`) WHERE row_role = 'root' AND kind = 'page' AND json_extract(metadata_json, '$.recipe') = 'links';
--> statement-breakpoint
CREATE INDEX `content_documents_site_kind_status_idx` ON `content_documents` (`site_id`,`kind`,`row_role`,`status`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `content_documents_location_kind_status_idx` ON `content_documents` (`location_id`,`kind`,`row_role`,`status`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `content_documents_schedule_idx` ON `content_documents` (`kind`,`status`,`scheduled_for`) WHERE row_role = 'root' AND status = 'scheduled';
--> statement-breakpoint
CREATE INDEX `content_documents_facebook_post_idx` ON `content_documents` (`site_id`,(metadata_json ->> '$.channels.facebook.provider_post_id')) WHERE row_role = 'root' AND kind = 'social_post';
--> statement-breakpoint
CREATE INDEX `content_documents_instagram_post_idx` ON `content_documents` (`site_id`,(metadata_json ->> '$.channels.instagram.provider_post_id')) WHERE row_role = 'root' AND kind = 'social_post';
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_scope_role_unique` ON `content_documents` (`organization_id`,`site_id`,`id`,`row_role`,`kind`);
--> statement-breakpoint
CREATE INDEX `content_blocks_document_position_idx` ON `content_blocks` (`document_id`,`position`);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_blocks_document_source_unique` ON `content_blocks` (`document_id`,`source_block_id`) WHERE source_block_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `content_blocks_parent_idx` ON `content_blocks` (`parent_block_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_blocks_document_id_unique` ON `content_blocks` (`document_id`,`id`);
--> statement-breakpoint
CREATE TABLE `mcp_tool_call_events_new` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`site_id` text,
	`location_id` text,
	`user_id` text,
	`mcp_surface` text DEFAULT 'client' NOT NULL,
	`request_id` text,
	`method` text NOT NULL,
	`tool_name` text,
	`tool_domain` text,
	`is_mutating` integer,
	`arguments_summary_json` text,
	`result_summary_json` text,
	`status` text NOT NULL,
	`error_code` text,
	`error_message` text,
	`http_status` integer,
	`jsonrpc_error_code` integer,
	`jsonrpc_error_message` text,
	`protocol_version` text,
	`session_id_hash` text,
	`oauth_client_id_hash` text,
	`user_agent` text,
	`cf_ray_id` text,
	`catalog_fingerprint` text,
	`unknown_tool_name` text,
	`duration_ms` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "mcp_tool_call_events_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
	CONSTRAINT "mcp_tool_call_events_arguments_summary_json_check" CHECK(arguments_summary_json IS NULL OR (json_valid(arguments_summary_json))),
	CONSTRAINT "mcp_tool_call_events_result_summary_json_check" CHECK(result_summary_json IS NULL OR (json_valid(result_summary_json))),
	CONSTRAINT "mcp_tool_call_events_status_check" CHECK(status IN ('success', 'error', 'auth_required', 'blocked')),
	CONSTRAINT "mcp_tool_call_events_surface_check" CHECK(mcp_surface IN ('client', 'public_help')),
	CONSTRAINT "mcp_tool_call_events_mutating_check" CHECK(is_mutating IN (0, 1)),
	CONSTRAINT "mcp_tool_call_events_duration_check" CHECK(duration_ms >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_created_at_new` ON `mcp_tool_call_events_new` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_tool_status_new` ON `mcp_tool_call_events_new` (`tool_name`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_site_new` ON `mcp_tool_call_events_new` (`site_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_org_new` ON `mcp_tool_call_events_new` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_method_created_new` ON `mcp_tool_call_events_new` (`method`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_session_new` ON `mcp_tool_call_events_new` (`session_id_hash`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_unknown_new` ON `mcp_tool_call_events_new` (`unknown_tool_name`,`created_at`);
--> statement-breakpoint
INSERT INTO `mcp_tool_call_events_new` ("id", "organization_id", "site_id", "location_id", "user_id", "mcp_surface", "request_id", "method", "tool_name", "tool_domain", "is_mutating", "arguments_summary_json", "result_summary_json", "status", "error_code", "error_message", "http_status", "jsonrpc_error_code", "jsonrpc_error_message", "protocol_version", "session_id_hash", "oauth_client_id_hash", "user_agent", "cf_ray_id", "catalog_fingerprint", "unknown_tool_name", "duration_ms", "created_at") SELECT "id", "organization_id", "site_id", "location_id", "user_id", "mcp_surface", "request_id", "method", "tool_name", "tool_domain", "is_mutating", "arguments_summary_json", "result_summary_json", "status", "error_code", "error_message", "http_status", "jsonrpc_error_code", "jsonrpc_error_message", "protocol_version", "session_id_hash", "oauth_client_id_hash", "user_agent", "cf_ray_id", "catalog_fingerprint", "unknown_tool_name", "duration_ms", "created_at" FROM `mcp_tool_call_events` WHERE mcp_surface <> 'platform';
--> statement-breakpoint
DROP TABLE `mcp_tool_call_events`;
--> statement-breakpoint
DROP INDEX `idx_mcp_tool_call_events_created_at_new`;
--> statement-breakpoint
DROP INDEX `idx_mcp_tool_call_events_tool_status_new`;
--> statement-breakpoint
DROP INDEX `idx_mcp_tool_call_events_site_new`;
--> statement-breakpoint
DROP INDEX `idx_mcp_tool_call_events_org_new`;
--> statement-breakpoint
DROP INDEX `idx_mcp_tool_call_events_method_created_new`;
--> statement-breakpoint
DROP INDEX `idx_mcp_tool_call_events_session_new`;
--> statement-breakpoint
DROP INDEX `idx_mcp_tool_call_events_unknown_new`;
--> statement-breakpoint
ALTER TABLE `mcp_tool_call_events_new` RENAME TO `mcp_tool_call_events`;
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_created_at` ON `mcp_tool_call_events` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_tool_status` ON `mcp_tool_call_events` (`tool_name`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_site` ON `mcp_tool_call_events` (`site_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_org` ON `mcp_tool_call_events` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_method_created` ON `mcp_tool_call_events` (`method`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_session` ON `mcp_tool_call_events` (`session_id_hash`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_unknown` ON `mcp_tool_call_events` (`unknown_tool_name`,`created_at`);
--> statement-breakpoint
UPDATE content_blocks SET position = position + 1
 WHERE parent_block_id IS NULL AND document_id IN (
   SELECT mp.owner_id FROM media_placements mp WHERE mp.owner_type = 'content_document' AND mp.slot = 'featured' AND NOT EXISTS (
    SELECT 1 FROM content_blocks cb JOIN media_placements bp
      ON bp.owner_type = 'content_block' AND bp.owner_id = cb.id AND bp.slot = 'media' AND bp.sort_order = 0
     WHERE cb.document_id = mp.owner_id AND cb.parent_block_id IS NULL AND cb.position = 0 AND cb.type = 'image' AND bp.asset_id = mp.asset_id));
--> statement-breakpoint
INSERT INTO content_blocks (id, document_id, parent_block_id, type, position, level, data_json)
 SELECT 'cover-' || mp.owner_id, mp.owner_id, NULL, 'image', 0, NULL, '{"caption":""}'
   FROM media_placements mp WHERE mp.owner_type = 'content_document' AND mp.slot = 'featured' AND NOT EXISTS (
    SELECT 1 FROM content_blocks cb JOIN media_placements bp
      ON bp.owner_type = 'content_block' AND bp.owner_id = cb.id AND bp.slot = 'media' AND bp.sort_order = 0
     WHERE cb.document_id = mp.owner_id AND cb.parent_block_id IS NULL AND cb.position = 0 AND cb.type = 'image' AND bp.asset_id = mp.asset_id);
--> statement-breakpoint
INSERT INTO media_placements (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
 SELECT 'cover-placement-' || mp.owner_id, mp.organization_id, mp.site_id, 'content_block', 'cover-' || mp.owner_id, 'media', mp.asset_id, 0, 'active'
   FROM media_placements mp WHERE mp.owner_type = 'content_document' AND mp.slot = 'featured' AND EXISTS (SELECT 1 FROM content_blocks cb WHERE cb.id = 'cover-' || mp.owner_id);
--> statement-breakpoint
DELETE FROM media_placements WHERE owner_type = 'content_document' AND slot = 'featured';
--> statement-breakpoint
INSERT INTO content_documents (id, organization_id, site_id, kind, row_role, locale, scope_path, title, summary, status, source, sort_order, metadata_json)
 SELECT 'qa-' || cb.id || '-' || j.key, d.organization_id, d.site_id, 'qa', 'root', 'en',
        CASE WHEN d.kind = 'page' THEN d.path WHEN s.vertical = 'service' THEN '/article/' || d.slug ELSE '/blog/' || d.slug END,
        j.value ->> '$.question', j.value ->> '$.answer', 'published', 'manual', j.key,
        json_object('is_owner_answer', 1, 'upvote_count', 0)
   FROM content_blocks cb
   JOIN content_documents d ON d.id = cb.document_id AND d.row_role = 'root'
   JOIN sites s ON s.id = d.site_id, json_each(cb.data_json, '$.items') j
  WHERE cb.type = 'faq' AND COALESCE(cb.data_json ->> '$.source', '') <> 'page_qa'
    AND json_type(j.value, '$.question') = 'text' AND trim(j.value ->> '$.question') <> '';
--> statement-breakpoint
UPDATE content_blocks SET data_json = json_object('source', 'page_qa')
 WHERE type = 'faq' AND COALESCE(data_json ->> '$.source', '') <> 'page_qa';
