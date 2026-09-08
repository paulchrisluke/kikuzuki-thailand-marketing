CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `activity_entries` (
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
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `activity_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "activity_entries_instants_check" CHECK((occurred_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at, '+0 days') IS occurred_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
	CONSTRAINT "activity_entries_kind_check" CHECK(kind IN ('submission', 'message', 'operation', 'assignment', 'resolution', 'notification', 'acknowledgement', 'audit')),
	CONSTRAINT "activity_entries_scope_check" CHECK((scope_kind = 'request' AND request_id IS NOT NULL AND organization_id IS NULL AND site_id IS NULL AND context_site_id IS NULL AND location_id IS NULL) OR (scope_kind = 'site' AND kind = 'audit' AND site_id IS NOT NULL AND context_site_id IS NULL AND organization_id IS NULL AND request_id IS NULL) OR (scope_kind = 'organization' AND organization_id IS NOT NULL AND site_id IS NULL AND request_id IS NULL) OR (scope_kind = 'platform' AND organization_id IS NULL AND site_id IS NULL AND context_site_id IS NULL AND request_id IS NULL)),
	CONSTRAINT "activity_entries_actor_check" CHECK(actor_kind IN ('guest', 'member', 'system', 'cloudflare')),
	CONSTRAINT "activity_entries_channel_check" CHECK(channel IS NULL OR channel IN ('web', 'email', 'whatsapp', 'system')),
	CONSTRAINT "activity_entries_payload_check" CHECK(json_valid(payload_json) AND json_type(payload_json) = 'object'),
	CONSTRAINT "activity_entries_timeline_check" CHECK((kind IN ('submission', 'message', 'operation', 'assignment', 'resolution') AND request_id IS NOT NULL AND sequence IS NOT NULL AND sequence > 0 AND scope_kind = 'request') OR (kind NOT IN ('submission', 'message', 'operation', 'assignment', 'resolution') AND sequence IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_dedupe_key_unique` ON `activity_entries` (`dedupe_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_request_sequence_unique` ON `activity_entries` (`request_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_entries_notification_source_unique` ON `activity_entries` (`parent_id`) WHERE kind = 'notification' AND parent_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `activity_entries_request_occurred_idx` ON `activity_entries` (`request_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_entries_parent_actor_idx` ON `activity_entries` (`parent_id`,`actor_user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_entries_context_site_created_idx` ON `activity_entries` (`kind`,`context_site_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_entries_site_created_idx` ON `activity_entries` (`kind`,`site_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_entries_org_created_idx` ON `activity_entries` (`kind`,`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_entries_target_created_idx` ON `activity_entries` (`kind`,`target_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`organization_id` text,
	`site_id` text NOT NULL,
	`location_id` text,
	`session_id` text,
	`visitor_id` text,
	`page_path` text,
	`duration_seconds` integer,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "analytics_events_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
	CONSTRAINT "analytics_events_kind_check" CHECK(kind IN ('pageview', 'conversion')),
	CONSTRAINT "analytics_events_payload_check" CHECK(json_valid(payload_json) AND json_type(payload_json) IS 'object'),
	CONSTRAINT "analytics_events_shape_check" CHECK((kind = 'pageview' AND page_path IS NOT NULL) OR (kind = 'conversion' AND organization_id IS NOT NULL AND session_id IS NOT NULL AND visitor_id IS NOT NULL AND duration_seconds IS NULL
    AND json_type(payload_json, '$.event_name') IS 'text' AND length(payload_json ->> '$.event_name') BETWEEN 1 AND 64
    AND (payload_json ->> '$.event_name') GLOB '[a-z]*' AND (payload_json ->> '$.event_name') NOT GLOB '*[^a-z0-9_]*'
    AND json_type(payload_json, '$.stage') IS 'text' AND (payload_json ->> '$.stage') IN ('schedule_navigation', 'external_booking_handoff', 'submitted', 'external_handoff')
    AND json_type(payload_json, '$.attribution.source') IS 'text' AND json_type(payload_json, '$.attribution.medium') IS 'text'
    AND json_type(payload_json, '$.attributed_at') IS 'text'))
);
--> statement-breakpoint
CREATE INDEX `analytics_events_site_kind_created_idx` ON `analytics_events` (`site_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_site_session_idx` ON `analytics_events` (`site_id`,`kind`,`session_id`);--> statement-breakpoint
CREATE INDEX `analytics_events_site_visitor_idx` ON `analytics_events` (`site_id`,`kind`,`visitor_id`);--> statement-breakpoint
CREATE INDEX `analytics_events_conversion_name_idx` ON `analytics_events` (`kind`,(payload_json ->> '$.event_name'),`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_conversion_entity_idx` ON `analytics_events` (`site_id`,(payload_json ->> '$.entity_type'),(payload_json ->> '$.entity_id')) WHERE kind = 'conversion';--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_events_conversion_entity_unique` ON `analytics_events` (`site_id`,(payload_json ->> '$.event_name'),(payload_json ->> '$.entity_type'),(payload_json ->> '$.entity_id')) WHERE kind = 'conversion' AND (payload_json ->> '$.entity_type') IS NOT NULL AND (payload_json ->> '$.entity_id') IS NOT NULL AND (payload_json ->> '$.event_name') IN ('contact_submit', 'reservation_submit', 'experience_booking_submit');--> statement-breakpoint
CREATE TABLE `analytics_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`date` text NOT NULL,
	`key` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "analytics_summaries_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "analytics_summaries_kind_check" CHECK(kind IN ('session', 'site_day', 'page_day', 'dimension_day')),
	CONSTRAINT "analytics_summaries_payload_check" CHECK(json_valid(payload_json) AND json_type(payload_json) IS 'object'),
	CONSTRAINT "analytics_summaries_scope_check" CHECK((kind = 'session' AND date = ''
    AND json_type(payload_json, '$.visitor_id') IS 'text' AND json_type(payload_json, '$.started_at') IS 'text'
    AND json_type(payload_json, '$.last_seen_at') IS 'text' AND json_type(payload_json, '$.landing_path') IS 'text'
    AND json_type(payload_json, '$.attribution.source') IS 'text' AND json_type(payload_json, '$.attribution.medium') IS 'text'
    AND json_type(payload_json, '$.duration_seconds') IS 'integer' AND (payload_json ->> '$.duration_seconds') >= 0)
    OR (kind != 'session' AND date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      AND json_type(payload_json, '$.page_views') IS 'integer' AND (payload_json ->> '$.page_views') >= 0)),
	CONSTRAINT "analytics_summaries_day_metrics_check" CHECK(kind != 'site_day' OR (key = ''
    AND json_type(payload_json, '$.unique_sessions') IS 'integer' AND (payload_json ->> '$.unique_sessions') >= 0
    AND json_type(payload_json, '$.unique_visitors') IS 'integer' AND (payload_json ->> '$.unique_visitors') >= 0
    AND json_type(payload_json, '$.returning_visitors') IS 'integer' AND (payload_json ->> '$.returning_visitors') >= 0
    AND json_type(payload_json, '$.avg_session_duration') IN ('integer', 'real') AND (payload_json ->> '$.avg_session_duration') >= 0
    AND json_type(payload_json, '$.pages_per_session') IN ('integer', 'real') AND (payload_json ->> '$.pages_per_session') >= 0
    AND json_type(payload_json, '$.avg_session_duration') IS NOT NULL AND json_type(payload_json, '$.pages_per_session') IS NOT NULL)),
	CONSTRAINT "analytics_summaries_dimension_key_check" CHECK(kind != 'dimension_day' OR (json_valid(key) AND json_type(key) IS 'array' AND json_array_length(key) = 3
    AND json_type(key, '$[0]') IS 'text' AND (key ->> '$[0]') IN ('country', 'city', 'device', 'referrer')
    AND json_type(key, '$[1]') IS 'text' AND json_type(key, '$[2]') IS 'text'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_summaries_grain_unique` ON `analytics_summaries` (`site_id`,`kind`,`date`,`key`);--> statement-breakpoint
CREATE INDEX `analytics_summaries_session_started_idx` ON `analytics_summaries` (`site_id`,(payload_json ->> '$.started_at')) WHERE kind = 'session';--> statement-breakpoint
CREATE INDEX `analytics_summaries_session_seen_idx` ON `analytics_summaries` (`site_id`,(payload_json ->> '$.last_seen_at')) WHERE kind = 'session';--> statement-breakpoint
CREATE INDEX `analytics_summaries_session_visitor_idx` ON `analytics_summaries` (`site_id`,(payload_json ->> '$.visitor_id'),(payload_json ->> '$.started_at')) WHERE kind = 'session';--> statement-breakpoint
CREATE TABLE `business_locations` (
	`booking_json` text DEFAULT '{}' NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`address` text,
	`city` text,
	`neighborhood` text,
	`phone` text,
	`website_url` text,
	`maps_url` text,
	`latitude` real,
	`longitude` real,
	`opening_hours` text,
	`categories` text,
	`rating` real,
	`review_count` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`last_synced_at` text,
	`description` text,
	`short_description` text,
	`description_provenance` text,
	`special_hours` text,
	`price_level` text,
	`email` text,
	`facebook_url` text,
	`instagram_url` text,
	`tiktok_url` text,
	`grab_url` text,
	`uber_eats_url` text,
	`foodpanda_url` text,
	`google_place_id` text,
	`google_review_url` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`notification_phone` text,
	`timezone` text,
	`max_capacity` integer,
	`seo_title` text,
	`seo_description` text,
	`canonical_url` text,
	`robots` text,
	`team_id` text,
	`feature_overrides` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "business_locations_instants_check" CHECK((last_synced_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', last_synced_at, '+0 days') IS last_synced_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "business_locations_booking_check" CHECK(json_valid(booking_json) AND json_type(booking_json) = 'object'),
	CONSTRAINT "business_locations_address_check" CHECK(address IS NULL OR (json_valid(address) AND json_type(address) IS 'object')),
	CONSTRAINT "business_locations_categories_check" CHECK(categories IS NULL OR (json_valid(categories) AND json_type(categories) IS 'array')),
	CONSTRAINT "business_locations_feature_overrides_check" CHECK(feature_overrides IS NULL OR (json_valid(feature_overrides) AND json_type(feature_overrides) IS 'object')),
	CONSTRAINT "business_locations_status_check" CHECK(status IN ('active', 'inactive', 'sync_error')),
	CONSTRAINT "business_locations_opening_hours_check" CHECK(opening_hours IS NULL OR (json_valid(opening_hours) AND json_type(opening_hours) IS 'object' AND json_type(opening_hours, '$.periods') IS 'array')),
	CONSTRAINT "business_locations_special_hours_check" CHECK(special_hours IS NULL OR (json_valid(special_hours) AND json_type(special_hours) IS 'array'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_locations_organization_id_site_id_slug_unique` ON `business_locations` (`organization_id`,`site_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `business_locations_organization_id_site_id_id_unique` ON `business_locations` (`organization_id`,`site_id`,`id`);--> statement-breakpoint
CREATE TABLE `content_blocks` (
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
	FOREIGN KEY (`document_id`) REFERENCES `content_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_block_id`) REFERENCES `content_blocks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`,`parent_block_id`) REFERENCES `content_blocks`(`document_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "content_blocks_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "content_blocks_source_check" CHECK(source_block_id IS NULL OR source_block_id <> id),
	CONSTRAINT "content_blocks_type_check" CHECK("content_blocks"."type" IN ('heading', 'markdown', 'image', 'gallery', 'faq', 'how_to', 'divider', 'ai_assistance', 'cta', 'callout', 'hero', 'button_group', 'feature_grid', 'testimonial_grid', 'contact_cta', 'booking_cta', 'donation_choices', 'offering_grid', 'location_grid')),
	CONSTRAINT "content_blocks_data_json_check" CHECK(json_valid("content_blocks"."data_json") AND json_type("content_blocks"."data_json") IS 'object'),
	CONSTRAINT "content_blocks_parent_check" CHECK("content_blocks"."parent_block_id" IS NULL OR "content_blocks"."parent_block_id" <> "content_blocks"."id"),
	CONSTRAINT "content_blocks_position_check" CHECK("content_blocks"."position" >= 0),
	CONSTRAINT "content_blocks_level_check" CHECK("content_blocks"."level" IS NULL OR "content_blocks"."level" BETWEEN 1 AND 6)
);
--> statement-breakpoint
CREATE INDEX `content_blocks_document_position_idx` ON `content_blocks` (`document_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_blocks_document_source_unique` ON `content_blocks` (`document_id`,`source_block_id`) WHERE source_block_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `content_blocks_parent_idx` ON `content_blocks` (`parent_block_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_blocks_document_id_unique` ON `content_blocks` (`document_id`,`id`);--> statement-breakpoint
CREATE TABLE `content_documents` (
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
	FOREIGN KEY (`organization_id`,`site_id`,`root_id`,`root_role`,`kind`) REFERENCES `content_documents`(`organization_id`,`site_id`,`id`,`row_role`,`kind`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`locale`) REFERENCES `site_locales`(`organization_id`,`site_id`,`locale`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "content_documents_instants_check" CHECK((published_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at, '+0 days') IS published_at) AND (first_published_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', first_published_at, '+0 days') IS first_published_at) AND (scheduled_for IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', scheduled_for, '+0 days') IS scheduled_for) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "content_documents_kind_check" CHECK("content_documents"."kind" IN ('page', 'article', 'platform_doc', 'social_post', 'qa')),
	CONSTRAINT "content_documents_metadata_check" CHECK(json_valid(metadata_json) AND json_type(metadata_json) IS 'object'),
	CONSTRAINT "content_documents_role_check" CHECK((row_role = 'root' AND root_id IS NULL AND root_role IS NULL AND locale = 'en') OR (row_role = 'representation' AND root_id IS NOT NULL AND root_id <> id AND root_role = 'root' AND locale IS NOT NULL AND locale <> 'en' AND location_id IS NULL AND scope_path IS NULL AND status IS NULL AND visibility IS NULL AND source IS NULL AND author_id IS NULL AND published_at IS NULL AND first_published_at IS NULL AND scheduled_for IS NULL)),
	CONSTRAINT "content_documents_path_check" CHECK(path IS NULL OR (path LIKE '/%' AND path NOT LIKE '//%')),
	CONSTRAINT "content_documents_platform_doc_scope_check" CHECK(kind <> 'platform_doc' OR (organization_id = 'platform' AND site_id = 'platform')),
	CONSTRAINT "content_documents_page_copy_check" CHECK(kind <> 'page' OR (path IS NOT NULL AND title IS NOT NULL)),
	CONSTRAINT "content_documents_page_type_check" CHECK(kind <> 'page' OR row_role <> 'root' OR ((metadata_json ->> '$.page_type') IN ('custom','recipe','legal','system')) IS 1),
	CONSTRAINT "content_documents_channel_names_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR json_type(metadata_json, '$.channels') IS NULL OR (json_type(metadata_json, '$.channels') IS 'object' AND json_remove(json_extract(metadata_json, '$.channels'), '$.facebook', '$.instagram') = '{}')),
	CONSTRAINT "content_documents_qa_scope_check" CHECK(kind <> 'qa' OR row_role <> 'root' OR ((location_id IS NULL OR scope_path IS NULL) AND (scope_path IS NULL OR scope_path LIKE '/%'))),
	CONSTRAINT "content_documents_publication_check" CHECK(row_role <> 'root' OR kind NOT IN ('article', 'social_post') OR (status IN ('draft','published','scheduled')) IS 1),
	CONSTRAINT "content_documents_social_schedule_check" CHECK(kind <> 'social_post' OR row_role <> 'root' OR ((status = 'draft' AND scheduled_for IS NULL AND published_at IS NULL) OR (status = 'scheduled' AND scheduled_for IS NOT NULL AND published_at IS NULL) OR (status = 'published' AND scheduled_for IS NULL AND published_at IS NOT NULL))),
	CONSTRAINT "content_documents_article_visibility_check" CHECK(kind NOT IN ('article','social_post') OR row_role <> 'root' OR (visibility IN ('public','unlisted')) IS 1),
	CONSTRAINT "content_documents_qa_state_check" CHECK(kind <> 'qa' OR row_role <> 'root' OR ((status IN ('published','hidden')) IS 1 AND (source IN ('manual','import','template')) IS 1)),
	CONSTRAINT "content_documents_qa_counts_check" CHECK(kind <> 'qa' OR row_role <> 'root' OR ((json_type(metadata_json, '$.is_owner_answer') = 'integer' AND json_type(metadata_json, '$.upvote_count') = 'integer') IS 1)),
	CONSTRAINT "content_documents_copy_required_check" CHECK(row_role <> 'root' OR ((kind NOT IN ('page','article','platform_doc','qa') OR title IS NOT NULL) AND (kind NOT IN ('article','platform_doc') OR slug IS NOT NULL) AND (kind <> 'social_post' OR summary IS NOT NULL))),
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
CREATE UNIQUE INDEX `content_documents_root_locale_unique` ON `content_documents` (`root_id`,`locale`) WHERE row_role = 'representation';--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_route_unique` ON `content_documents` (`site_id`,`locale`,`path`) WHERE row_role IN ('root','representation') AND path IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_slug_unique` ON `content_documents` (`site_id`,`kind`,`locale`,`slug`) WHERE row_role IN ('root','representation') AND slug IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_links_site_unique` ON `content_documents` (`site_id`) WHERE row_role = 'root' AND kind = 'page' AND json_extract(metadata_json, '$.recipe') = 'links';--> statement-breakpoint
CREATE INDEX `content_documents_site_kind_status_idx` ON `content_documents` (`site_id`,`kind`,`row_role`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `content_documents_location_kind_status_idx` ON `content_documents` (`location_id`,`kind`,`row_role`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `content_documents_schedule_idx` ON `content_documents` (`kind`,`status`,`scheduled_for`) WHERE row_role = 'root' AND status = 'scheduled';--> statement-breakpoint
CREATE INDEX `content_documents_facebook_post_idx` ON `content_documents` (`site_id`,(metadata_json ->> '$.channels.facebook.provider_post_id')) WHERE row_role = 'root' AND kind = 'social_post';--> statement-breakpoint
CREATE INDEX `content_documents_instagram_post_idx` ON `content_documents` (`site_id`,(metadata_json ->> '$.channels.instagram.provider_post_id')) WHERE row_role = 'root' AND kind = 'social_post';--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_scope_role_unique` ON `content_documents` (`organization_id`,`site_id`,`id`,`row_role`,`kind`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`user_id` text,
	`stripe_customer_id` text,
	`name` text,
	`email` text,
	`email_normalized` text,
	`email_hash` text,
	`phone` text,
	`phone_normalized` text,
	`phone_metadata_version` text,
	`source` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`review_request_opted_out_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "customers_instants_check" CHECK((review_request_opted_out_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', review_request_opted_out_at, '+0 days') IS review_request_opted_out_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "customers_source_check" CHECK(source IN ('reservation', 'experience_booking', 'review_request', 'manual', 'stripe', 'import')),
	CONSTRAINT "customers_status_check" CHECK(status IN ('active', 'merged', 'suppressed', 'deleted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customers_site_email_normalized_unique` ON `customers` (`site_id`,`email_normalized`) WHERE email_normalized IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customers_stripe_customer_id_unique` ON `customers` (`stripe_customer_id`) WHERE stripe_customer_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_customers_site_id` ON `customers` (`site_id`);--> statement-breakpoint
CREATE INDEX `idx_customers_org_site_email_hash` ON `customers` (`organization_id`,`site_id`,`email_hash`);--> statement-breakpoint
CREATE INDEX `idx_customers_user_id` ON `customers` (`user_id`);--> statement-breakpoint
CREATE TABLE `guest_thread_deliveries` (
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
	FOREIGN KEY (`entry_id`) REFERENCES `activity_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "guest_thread_deliveries_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "guest_thread_deliveries_channel_check" CHECK(channel IN ('email', 'whatsapp')),
	CONSTRAINT "guest_thread_deliveries_provider_check" CHECK((channel = 'email' AND provider IN ('resend', 'log_only')) OR (channel = 'whatsapp' AND provider IN ('meta', 'log_only'))),
	CONSTRAINT "guest_thread_deliveries_purpose_check" CHECK(purpose IN ('owner_alert', 'guest_acknowledgement', 'member_reply', 'status_update')),
	CONSTRAINT "guest_thread_deliveries_status_check" CHECK(status IN ('pending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_thread_deliveries_provider_message_unique` ON `guest_thread_deliveries` (`provider`,`provider_message_id`) WHERE provider_message_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `guest_thread_deliveries_entry_status_idx` ON `guest_thread_deliveries` (`entry_id`,`status`);--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expiresAt` integer NOT NULL,
	`inviterId` text NOT NULL,
	`teamId` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviterId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organizationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitation_org_pending_owner` ON `invitation` (`organizationId`) WHERE role = 'owner' AND status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitation_org_email_pending_unique` ON `invitation` (`organizationId`,lower("email")) WHERE status = 'pending';--> statement-breakpoint
CREATE TABLE `jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`publicKey` text NOT NULL,
	`privateKey` text NOT NULL,
	`alg` text,
	`crv` text,
	`createdAt` integer NOT NULL,
	`expiresAt` integer
);
--> statement-breakpoint
CREATE TABLE `mcp_tool_call_events` (
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
	CONSTRAINT "mcp_tool_call_events_surface_check" CHECK(mcp_surface IN ('client', 'platform', 'public_help')),
	CONSTRAINT "mcp_tool_call_events_mutating_check" CHECK(is_mutating IN (0, 1)),
	CONSTRAINT "mcp_tool_call_events_duration_check" CHECK(duration_ms >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_created_at` ON `mcp_tool_call_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_tool_status` ON `mcp_tool_call_events` (`tool_name`,`status`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_site` ON `mcp_tool_call_events` (`site_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_org` ON `mcp_tool_call_events` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_method_created` ON `mcp_tool_call_events` (`method`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_session` ON `mcp_tool_call_events` (`session_id_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tool_call_events_unknown` ON `mcp_tool_call_events` (`unknown_tool_name`,`created_at`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`kind` text NOT NULL,
	`provider` text NOT NULL,
	`source` text NOT NULL,
	`cloudflare_image_id` text,
	`r2_key` text,
	`public_url` text,
	`thumbnail_url` text,
	`mime_type` text,
	`file_name` text,
	`file_size` integer,
	`width` integer,
	`height` integer,
	`duration` integer,
	`alt_text` text,
	`generation_key` text,
	`category` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "media_assets_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "media_assets_kind_check" CHECK("media_assets"."kind" IN ('image', 'video', 'file')),
	CONSTRAINT "media_assets_category_check" CHECK(category IS NULL OR category IN ('exterior', 'interior', 'food', 'menu', 'team', 'other', 'logo', 'blog')),
	CONSTRAINT "media_assets_video_thumbnail_check" CHECK(kind <> 'video' OR (thumbnail_url IS NOT NULL AND length(trim(thumbnail_url)) > 0)),
	CONSTRAINT "media_assets_status_check" CHECK(status IN ('pending', 'active', 'deleted', 'failed')),
	CONSTRAINT "media_assets_provider_check" CHECK(provider IN ('cloudflare_images', 'cloudflare_r2')),
	CONSTRAINT "media_assets_source_check" CHECK(source IN ('uploaded', 'generated', 'external'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_org_site_id_unique` ON `media_assets` (`organization_id`,`site_id`,`id`);--> statement-breakpoint
CREATE TABLE `media_placements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`slot` text NOT NULL,
	`asset_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`asset_id`) REFERENCES `media_assets`(`organization_id`,`site_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "media_placements_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "media_placements_owner_type_check" CHECK("media_placements"."owner_type" IN ('site', 'business_location', 'product', 'content_document', 'offering', 'content_block', 'review', 'review_request')),
	CONSTRAINT "media_placements_sort_order_check" CHECK("media_placements"."sort_order" >= 0),
	CONSTRAINT "media_placements_status_check" CHECK("media_placements"."status" IN ('pending', 'active', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `media_placements_asset_idx` ON `media_placements` (`organization_id`,`site_id`,`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_placements_site_owner_slot_asset_unique` ON `media_placements` (`site_id`,`owner_type`,`owner_id`,`slot`,`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_placements_site_owner_slot_order_unique` ON `media_placements` (`site_id`,`owner_type`,`owner_id`,`slot`,`sort_order`);--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_userId_organizationId_idx` ON `member` (`userId`,`organizationId`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organizationId`);--> statement-breakpoint
CREATE TABLE `oauthAccessToken` (
	`id` text PRIMARY KEY NOT NULL,
	`clientId` text NOT NULL,
	`userId` text,
	`token` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`authorizationCodeId` text,
	`resources` text,
	`requestedUserInfoClaims` text,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`sessionId` text,
	`referenceId` text,
	`refreshId` text,
	`revoked` integer,
	`confirmation` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthAccessToken_token_unique` ON `oauthAccessToken` (`token`);--> statement-breakpoint
CREATE TABLE `oauthClient` (
	`id` text PRIMARY KEY NOT NULL,
	`clientId` text NOT NULL,
	`clientSecret` text,
	`name` text NOT NULL,
	`redirectUris` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`public` integer DEFAULT 0 NOT NULL,
	`requirePKCE` integer DEFAULT 1 NOT NULL,
	`skipConsent` integer DEFAULT 0 NOT NULL,
	`userId` text,
	`metadata` text,
	`disabled` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`enableEndSession` integer,
	`subjectType` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`softwareId` text,
	`softwareVersion` text,
	`softwareStatement` text,
	`postLogoutRedirectUris` text,
	`backchannelLogoutUri` text,
	`backchannelLogoutSessionRequired` integer DEFAULT 0 NOT NULL,
	`tokenEndpointAuthMethod` text,
	`jwks` text,
	`jwksUri` text,
	`grantTypes` text,
	`responseTypes` text,
	`type` text,
	`dpopBoundAccessTokens` integer DEFAULT 0 NOT NULL,
	`referenceId` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthClient_clientId_unique` ON `oauthClient` (`clientId`);--> statement-breakpoint
CREATE TABLE `oauthClientAssertion` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauthClientResource` (
	`id` text PRIMARY KEY NOT NULL,
	`clientId` text NOT NULL,
	`resourceId` text NOT NULL,
	`metadata` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`clientId`) REFERENCES `oauthClient`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resourceId`) REFERENCES `oauthResource`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauthConsent` (
	`id` text PRIMARY KEY NOT NULL,
	`clientId` text NOT NULL,
	`userId` text NOT NULL,
	`scopes` text DEFAULT '' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`referenceId` text,
	`resources` text,
	`requestedUserInfoClaims` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthConsent_clientId_userId_unique` ON `oauthConsent` (`clientId`,`userId`);--> statement-breakpoint
CREATE TABLE `oauthRefreshToken` (
	`id` text PRIMARY KEY NOT NULL,
	`clientId` text NOT NULL,
	`userId` text,
	`token` text NOT NULL,
	`scopes` text DEFAULT '' NOT NULL,
	`authorizationCodeId` text,
	`resources` text,
	`requestedUserInfoClaims` text,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`sessionId` text,
	`referenceId` text,
	`revoked` integer,
	`rotatedAt` integer,
	`rotationReplayResponse` text,
	`rotationReplayExpiresAt` integer,
	`authTime` integer,
	`confirmation` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthRefreshToken_token_unique` ON `oauthRefreshToken` (`token`);--> statement-breakpoint
CREATE TABLE `oauthResource` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`name` text NOT NULL,
	`accessTokenTtl` integer,
	`refreshTokenTtl` integer,
	`signingAlgorithm` text,
	`signingKeyId` text,
	`allowedScopes` text,
	`customClaims` text,
	`dpopBoundAccessTokensRequired` integer DEFAULT 0 NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`policyVersion` integer DEFAULT 1 NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthResource_identifier_unique` ON `oauthResource` (`identifier`);--> statement-breakpoint
CREATE TABLE `offerings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`location_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`label` text,
	`summary` text,
	`short_description` text,
	`body` text,
	`features` text,
	`faqs` text,
	`cta_label` text,
	`cta_url` text,
	`schema_type` text,
	`seo_title` text,
	`seo_description` text,
	`canonical_path` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "offerings_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "offerings_features_check" CHECK(features IS NULL OR (json_valid(features) AND json_type(features) IS 'array')),
	CONSTRAINT "offerings_faqs_check" CHECK(faqs IS NULL OR (json_valid(faqs) AND json_type(faqs) IS 'array'))
);
--> statement-breakpoint
CREATE INDEX `offerings_site_sort_idx` ON `offerings` (`site_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `offerings_organization_id_site_id_slug_unique` ON `offerings` (`organization_id`,`site_id`,`slug`);--> statement-breakpoint
CREATE TABLE `onboarding_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text,
	`name` text NOT NULL,
	`vertical` text NOT NULL,
	`subdomain_candidate` text,
	`source_type` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`payload_json` text NOT NULL,
	`committed_site_id` text,
	`committed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`committed_site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "onboarding_drafts_instants_check" CHECK((committed_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', committed_at, '+0 days') IS committed_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "onboarding_drafts_source_type_check" CHECK(source_type IN ('google_places', 'manual')),
	CONSTRAINT "onboarding_drafts_payload_json_check" CHECK(payload_json IS NULL OR (json_valid(payload_json) AND json_type(payload_json) IS 'object')),
	CONSTRAINT "onboarding_drafts_status_check" CHECK(status IN ('active', 'committing', 'committed', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_drafts_active_user_unique` ON `onboarding_drafts` (`user_id`) WHERE status = 'active';--> statement-breakpoint
CREATE INDEX `onboarding_drafts_user_id_idx` ON `onboarding_drafts` (`user_id`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`metadata` text,
	`stripeCustomerId` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "organization_slug_required_check" CHECK(trim("organization"."slug") <> '')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_stripeCustomerId_unique` ON `organization` (`stripeCustomerId`);--> statement-breakpoint
CREATE TABLE `organization_billing` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`payment_status` text DEFAULT 'unknown' NOT NULL,
	`paid_through` text,
	`past_due_since` text,
	`last_paid_invoice_id` text,
	`last_payment_event_created` integer,
	`last_payment_event_id` text,
	`access_plan` text DEFAULT 'free' NOT NULL,
	`access_expires_at` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "organization_billing_instants_check" CHECK((access_expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', access_expires_at, '+0 days') IS access_expires_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at) AND (paid_through IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', paid_through, '+0 days') IS paid_through) AND (past_due_since IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', past_due_since, '+0 days') IS past_due_since)),
	CONSTRAINT "organization_billing_payment_status_check" CHECK(payment_status IN ('unknown', 'paid', 'processing', 'failed', 'pending', 'trialing', 'past_due')),
	CONSTRAINT "organization_billing_access_plan_check" CHECK("organization_billing"."access_plan" IN ('free', 'growth'))
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`location_id` text NOT NULL,
	`product_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`unit` text DEFAULT 'item' NOT NULL,
	`tax_behavior` text DEFAULT 'unspecified' NOT NULL,
	`compare_at_amount_minor` integer,
	`valid_from` text NOT NULL,
	`valid_until` text,
	`provenance` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`,`product_id`) REFERENCES `products`(`organization_id`,`site_id`,`location_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "prices_instants_check" CHECK((strftime('%Y-%m-%dT%H:%M:%fZ', valid_from, '+0 days') IS valid_from) AND (valid_until IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', valid_until, '+0 days') IS valid_until) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
	CONSTRAINT "prices_amount_check" CHECK("prices"."amount_minor" >= 0),
	CONSTRAINT "prices_compare_at_check" CHECK("prices"."compare_at_amount_minor" IS NULL OR "prices"."compare_at_amount_minor" > "prices"."amount_minor"),
	CONSTRAINT "prices_currency_check" CHECK("prices"."currency" IN ('THB','USD','EUR','GBP','JPY','AUD','CAD','SGD','HKD','MYR','IDR','PHP','VND','INR')),
	CONSTRAINT "prices_unit_check" CHECK("prices"."unit" IN ('item', 'person', 'table')),
	CONSTRAINT "prices_tax_behavior_check" CHECK("prices"."tax_behavior" IN ('unspecified', 'inclusive', 'exclusive')),
	CONSTRAINT "prices_validity_check" CHECK("prices"."valid_until" IS NULL OR "prices"."valid_until" > "prices"."valid_from")
);
--> statement-breakpoint
CREATE INDEX `prices_product_validity_idx` ON `prices` (`organization_id`,`site_id`,`product_id`,`valid_from`,`valid_until`);--> statement-breakpoint
CREATE INDEX `prices_site_location_validity_idx` ON `prices` (`site_id`,`location_id`,`valid_from`,`valid_until`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`location_id` text NOT NULL,
	`product_type` text DEFAULT 'standard' NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`) REFERENCES `business_locations`(`organization_id`,`site_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_categories_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "product_categories_name_not_blank_check" CHECK(trim("product_categories"."name") <> ''),
	CONSTRAINT "product_categories_slug_check" CHECK("product_categories"."slug" <> '' AND "product_categories"."slug" = lower("product_categories"."slug") AND "product_categories"."slug" NOT GLOB '*[^a-z0-9-]*' AND "product_categories"."slug" NOT LIKE '-%' AND "product_categories"."slug" NOT LIKE '%-' AND "product_categories"."slug" NOT LIKE '%--%'),
	CONSTRAINT "product_categories_sort_order_check" CHECK("product_categories"."sort_order" >= 0),
	CONSTRAINT "product_categories_type_check" CHECK("product_categories"."product_type" IN ('standard', 'experience'))
);
--> statement-breakpoint
CREATE INDEX `product_categories_location_type_sort_idx` ON `product_categories` (`site_id`,`location_id`,`product_type`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_scope_id_unique` ON `product_categories` (`organization_id`,`site_id`,`location_id`,`product_type`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_location_type_slug_unique` ON `product_categories` (`site_id`,`location_id`,`product_type`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_location_type_name_unique` ON `product_categories` (`site_id`,`location_id`,`product_type`,`name`);--> statement-breakpoint
CREATE TABLE `products` (
	`experience_json` text,
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`location_id` text NOT NULL,
	`product_type` text DEFAULT 'standard' NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`order_url` text,
	`is_visible` integer DEFAULT 1 NOT NULL,
	`available` integer DEFAULT 1 NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`featured_sort_order` integer DEFAULT 0 NOT NULL,
	`sort_order` integer NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`details_json` text DEFAULT '[]' NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`canonical_url` text,
	`robots` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`) REFERENCES `business_locations`(`organization_id`,`site_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`,`product_type`,`category_id`) REFERENCES `product_categories`(`organization_id`,`site_id`,`location_id`,`product_type`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "products_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "products_name_not_blank_check" CHECK(trim("products"."name") <> ''),
	CONSTRAINT "products_slug_check" CHECK("products"."slug" <> '' AND "products"."slug" = lower("products"."slug") AND "products"."slug" NOT GLOB '*[^a-z0-9-]*' AND "products"."slug" NOT LIKE '-%' AND "products"."slug" NOT LIKE '%-' AND "products"."slug" NOT LIKE '%--%'),
	CONSTRAINT "products_sort_order_check" CHECK("products"."sort_order" >= 0),
	CONSTRAINT "products_featured_sort_order_check" CHECK("products"."featured_sort_order" >= 0),
	CONSTRAINT "products_boolean_check" CHECK("products"."is_visible" IN (0, 1) AND "products"."available" IN (0, 1) AND "products"."featured" IN (0, 1)),
	CONSTRAINT "products_experience_check" CHECK((product_type = 'experience' AND experience_json IS NOT NULL AND json_valid(experience_json) AND json_type(experience_json) = 'object') OR (product_type = 'standard' AND experience_json IS NULL)),
	CONSTRAINT "products_experience_fields_check" CHECK(experience_json IS NULL OR ((json_type(experience_json, '$.recurring_slots') IS NULL OR json_type(experience_json, '$.recurring_slots') IN ('null', 'object')) AND (json_type(experience_json, '$.included_items') IS NULL OR json_type(experience_json, '$.included_items') IN ('null', 'array')) AND (json_type(experience_json, '$.what_to_bring') IS NULL OR json_type(experience_json, '$.what_to_bring') IN ('null', 'array')))),
	CONSTRAINT "products_type_check" CHECK("products"."product_type" IN ('standard', 'experience')),
	CONSTRAINT "products_tags_json_check" CHECK(json_valid("products"."tags_json") AND json_type("products"."tags_json") = 'array'),
	CONSTRAINT "products_details_json_check" CHECK(json_valid("products"."details_json") AND json_type("products"."details_json") = 'array'),
	CONSTRAINT "products_source_check" CHECK("products"."source" IN ('manual', 'template', 'ai', 'import', 'copy')),
	CONSTRAINT "products_order_url_check" CHECK("products"."order_url" IS NULL OR ("products"."order_url" LIKE 'https://_%' AND instr("products"."order_url", '@') = 0 AND instr("products"."order_url", char(10)) = 0 AND instr("products"."order_url", char(13)) = 0)),
	CONSTRAINT "products_robots_check" CHECK("products"."robots" IS NULL OR "products"."robots" IN ('index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow'))
);
--> statement-breakpoint
CREATE INDEX `products_category_sort_order_idx` ON `products` (`category_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `products_site_location_type_sort_order_idx` ON `products` (`site_id`,`location_id`,`product_type`,`sort_order`);--> statement-breakpoint
CREATE INDEX `products_site_location_visible_sort_idx` ON `products` (`site_id`,`location_id`,`is_visible`,`sort_order`);--> statement-breakpoint
CREATE INDEX `products_site_location_featured_sort_idx` ON `products` (`site_id`,`location_id`,`featured`,`featured_sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_scope_id_unique` ON `products` (`organization_id`,`site_id`,`location_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_org_site_id_unique` ON `products` (`organization_id`,`site_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_site_location_slug_unique` ON `products` (`site_id`,`location_id`,`slug`);--> statement-breakpoint
CREATE TABLE `public_resource_cache_invalidations` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`claimed_at` text,
	`processed_at` text,
	`last_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "public_resource_cache_invalidations_instants_check" CHECK((claimed_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', claimed_at, '+0 days') IS claimed_at) AND (processed_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', processed_at, '+0 days') IS processed_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
	CONSTRAINT "public_resource_cache_invalidations_status_check" CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
	CONSTRAINT "public_resource_cache_invalidations_attempt_count_check" CHECK(attempt_count >= 0)
);
--> statement-breakpoint
CREATE INDEX `public_resource_cache_invalidations_status_idx` ON `public_resource_cache_invalidations` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `public_resource_cache_invalidations_site_idx` ON `public_resource_cache_invalidations` (`site_id`,`status`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`expires_at` text,
	CONSTRAINT "rate_limits_instants_check" CHECK((updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at) AND (expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', expires_at, '+0 days') IS expires_at))
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expires` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `requests` (
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
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`) REFERENCES `business_locations`(`organization_id`,`site_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`site_id`,`product_id`) REFERENCES `products`(`organization_id`,`site_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`site_id`,`location_id`,`product_id`) REFERENCES `products`(`organization_id`,`site_id`,`location_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "requests_instants_check" CHECK((resolved_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', resolved_at, '+0 days') IS resolved_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "requests_kind_check" CHECK(kind IN ('contact', 'reservation', 'experience_booking', 'platform_contact', 'work')),
	CONSTRAINT "requests_payload_check" CHECK(json_valid(payload_json) AND json_type(payload_json) = 'object'),
	CONSTRAINT "requests_guest_payload_check" CHECK(kind = 'work' OR (json_type(payload_json, '$.guest.name') IS 'text' AND json_type(payload_json, '$.guest.email') IS 'text' AND (json_type(payload_json, '$.guest.phone') IS 'text' OR json_type(payload_json, '$.guest.phone') IS 'null'))),
	CONSTRAINT "requests_booking_payload_check" CHECK(kind NOT IN ('reservation', 'experience_booking') OR (json_type(payload_json, '$.party_size_is_minimum') IN ('true', 'false') AND json_type(payload_json, '$.cancellation') IS 'object' AND json_type(payload_json, '$.completion') IS 'object' AND json_type(payload_json, '$.review') IS 'object' AND (kind != 'reservation' OR json_type(payload_json, '$.guest.phone') IS 'text')) IS TRUE),
	CONSTRAINT "requests_work_payload_check" CHECK(kind != 'work' OR (json_type(payload_json, '$.title') IS 'text' AND (payload_json ->> '$.type') IN ('content_update', 'product_update', 'seo', 'google_places', 'seasonal', 'photo_update', 'social_media', 'technical', 'other') AND (payload_json ->> '$.source') IN ('dashboard', 'whatsapp')) IS TRUE),
	CONSTRAINT "requests_message_payload_check" CHECK(kind NOT IN ('contact', 'platform_contact') OR json_type(payload_json, '$.message') IS 'text'),
	CONSTRAINT "requests_scope_check" CHECK((kind = 'platform_contact' AND organization_id IS NULL AND site_id IS NULL AND location_id IS NULL AND product_id IS NULL AND customer_id IS NULL) OR (kind = 'work' AND organization_id IS NOT NULL AND location_id IS NULL AND product_id IS NULL AND customer_id IS NULL) OR (kind IN ('contact', 'reservation', 'experience_booking') AND organization_id IS NOT NULL AND site_id IS NOT NULL)),
	CONSTRAINT "requests_booking_check" CHECK((kind IN ('reservation', 'experience_booking') AND location_id IS NOT NULL AND booking_date IS NOT NULL AND date(booking_date, '+0 days') IS booking_date AND time_slot IS NOT NULL AND time_slot GLOB '[0-2][0-9]:[0-5][0-9]' AND time_slot < '24:00' AND party_size IS NOT NULL AND party_size > 0 AND status IS NOT NULL AND status IN ('pending', 'confirmed', 'cancelled', 'completed') AND (kind != 'experience_booking' OR product_id IS NOT NULL) AND (kind != 'reservation' OR product_id IS NULL)) OR (kind NOT IN ('reservation', 'experience_booking') AND booking_date IS NULL AND time_slot IS NULL AND party_size IS NULL)),
	CONSTRAINT "requests_state_check" CHECK((kind = 'work' AND status IS NOT NULL AND status IN ('pending', 'in_progress', 'done', 'cancelled') AND priority IS NOT NULL AND priority IN ('low', 'normal', 'high', 'urgent') AND conversation_state IS NULL) OR (kind IN ('contact', 'reservation', 'experience_booking') AND conversation_state IS NOT NULL AND conversation_state IN ('needs_attention', 'waiting_on_guest', 'resolved') AND priority IS NULL AND assigned_to IS NULL AND (kind != 'contact' OR status IS NULL)) OR (kind = 'platform_contact' AND status IS NULL AND priority IS NULL AND conversation_state IS NULL AND assigned_to IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_review_owner_unique` ON `requests` (`organization_id`,`site_id`,`id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `requests_scope_id_unique` ON `requests` (`organization_id`,`site_id`,`id`);--> statement-breakpoint
CREATE INDEX `requests_site_activity_idx` ON `requests` (`site_id`,`conversation_state`,`updated_at`);--> statement-breakpoint
CREATE INDEX `requests_booking_slot_idx` ON `requests` (`site_id`,`kind`,`location_id`,`product_id`,`booking_date`,`time_slot`,`status`);--> statement-breakpoint
CREATE INDEX `requests_customer_idx` ON `requests` (`customer_id`);--> statement-breakpoint
CREATE INDEX `requests_work_queue_idx` ON `requests` (`kind`,`status`,`priority`,`created_at`);--> statement-breakpoint
CREATE INDEX `requests_org_created_idx` ON `requests` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `resource_localizations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`locale` text NOT NULL,
	`values_json` text NOT NULL,
	`route_path` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_by_user_id` text NOT NULL,
	FOREIGN KEY (`organization_id`,`site_id`,`locale`) REFERENCES `site_locales`(`organization_id`,`site_id`,`locale`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "resource_localizations_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "resource_localizations_resource_type_check" CHECK("resource_localizations"."resource_type" IN ('site', 'business_location', 'product', 'product_category', 'offering', 'media_asset')),
	CONSTRAINT "resource_localizations_values_json_check" CHECK(json_valid("resource_localizations"."values_json") AND json_type("resource_localizations"."values_json") = 'object'),
	CONSTRAINT "resource_localizations_non_english_check" CHECK("resource_localizations"."locale" <> 'en'),
	CONSTRAINT "resource_localizations_route_path_check" CHECK("resource_localizations"."route_path" IS NULL OR ("resource_localizations"."route_path" LIKE '/' || "resource_localizations"."locale" || '/%' AND "resource_localizations"."route_path" NOT LIKE '%?%' AND "resource_localizations"."route_path" NOT LIKE '%#%' AND "resource_localizations"."route_path" NOT LIKE '%//%'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_localizations_site_locale_route_unique` ON `resource_localizations` (`site_id`,`locale`,`route_path`) WHERE route_path IS NOT NULL;--> statement-breakpoint
CREATE INDEX `resource_localizations_site_locale_type_idx` ON `resource_localizations` (`site_id`,`locale`,`resource_type`);--> statement-breakpoint
CREATE INDEX `resource_localizations_resource_idx` ON `resource_localizations` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `resource_localizations_org_site_resource_locale_unique` ON `resource_localizations` (`organization_id`,`site_id`,`resource_type`,`resource_id`,`locale`);--> statement-breakpoint
CREATE TABLE `review_requests` (
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
	FOREIGN KEY (`organization_id`,`site_id`,`booking_id`,`booking_type`) REFERENCES `requests`(`organization_id`,`site_id`,`id`,`kind`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_requests_instants_check" CHECK((expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', expires_at, '+0 days') IS expires_at) AND (first_sent_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', first_sent_at, '+0 days') IS first_sent_at) AND (reminder_sent_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', reminder_sent_at, '+0 days') IS reminder_sent_at) AND (submitted_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', submitted_at, '+0 days') IS submitted_at) AND (clicked_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', clicked_at, '+0 days') IS clicked_at) AND (revoked_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', revoked_at, '+0 days') IS revoked_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "review_requests_booking_type_check" CHECK(booking_type IN ('reservation', 'experience_booking'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_requests_token_hash_unique` ON `review_requests` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_review_requests_active_booking_unique` ON `review_requests` (`site_id`,`booking_type`,`booking_id`) WHERE revoked_at IS NULL AND submitted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_review_requests_send_due` ON `review_requests` (`site_id`,`first_sent_at`,`reminder_sent_at`,`submitted_at`,`expires_at`);--> statement-breakpoint
CREATE INDEX `review_requests_organization_id_idx` ON `review_requests` (`organization_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
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
	FOREIGN KEY (`review_request_id`) REFERENCES `review_requests`(`id`) ON UPDATE no action ON DELETE set null,
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
CREATE UNIQUE INDEX `reviews_google_review_scope_unique` ON `reviews` (`organization_id`,`site_id`,`location_id`,`google_review_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_request_id` ON `reviews` (`review_request_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_customer_id` ON `reviews` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_reviews_location_status` ON `reviews` (`location_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_reviews_site_status` ON `reviews` (`site_id`,`status`,`created_at`) WHERE location_id IS NULL;--> statement-breakpoint
CREATE INDEX `idx_reviews_product_status_created` ON `reviews` (`product_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_organization_id_idx` ON `reviews` (`organization_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`activeOrganizationId` text,
	`activeTeamId` text,
	`impersonatedBy` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `site_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`site_id` text,
	`former_site_id` text,
	`successor_domain` text,
	`retired_at` text,
	`reconciliation_token` text,
	`reconciliation_expires_at` text,
	`desired_state` text DEFAULT 'active' NOT NULL,
	`domain` text NOT NULL,
	`type` text NOT NULL,
	`role` text DEFAULT 'secondary' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`cloudflare_hostname_id` text,
	`cloudflare_hostname_status` text,
	`cloudflare_ssl_status` text,
	`ownership_validation_name` text,
	`ownership_validation_type` text,
	`ownership_validation_value` text,
	`ssl_validation_name` text,
	`ssl_validation_type` text,
	`ssl_validation_value` text,
	`ssl_validation_name_2` text,
	`ssl_validation_type_2` text,
	`ssl_validation_value_2` text,
	`validation_strategy` text DEFAULT 'http_auto' NOT NULL,
	`dcv_delegation_name` text,
	`dcv_delegation_type` text,
	`dcv_delegation_value` text,
	`dns_target` text,
	`dns_status` text DEFAULT 'pending' NOT NULL,
	`dns_last_resolved_at` text,
	`dns_resolved_target` text,
	`last_synced_at` text,
	`next_check_at` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`activated_at` text,
	`certificate_last_active_at` text,
	`renewal_issue_started_at` text,
	`renewal_notification_sent_at` text,
	`certificate_expires_at` text,
	`error_message` text,
	`metadata` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "site_domains_instants_check" CHECK((retired_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', retired_at, '+0 days') IS retired_at) AND (reconciliation_expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', reconciliation_expires_at, '+0 days') IS reconciliation_expires_at) AND (dns_last_resolved_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', dns_last_resolved_at, '+0 days') IS dns_last_resolved_at) AND (last_synced_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', last_synced_at, '+0 days') IS last_synced_at) AND (next_check_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', next_check_at, '+0 days') IS next_check_at) AND (activated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', activated_at, '+0 days') IS activated_at) AND (certificate_last_active_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', certificate_last_active_at, '+0 days') IS certificate_last_active_at) AND (renewal_issue_started_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', renewal_issue_started_at, '+0 days') IS renewal_issue_started_at) AND (renewal_notification_sent_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', renewal_notification_sent_at, '+0 days') IS renewal_notification_sent_at) AND (certificate_expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', certificate_expires_at, '+0 days') IS certificate_expires_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "site_domains_owner_check" CHECK((status = 'retired' AND type = 'subdomain' AND role = 'secondary' AND organization_id IS NULL AND site_id IS NULL AND former_site_id IS NOT NULL AND retired_at IS NOT NULL) OR (status <> 'retired' AND organization_id IS NOT NULL AND site_id IS NOT NULL AND former_site_id IS NULL AND retired_at IS NULL AND successor_domain IS NULL)),
	CONSTRAINT "site_domains_desired_state_check" CHECK(desired_state IN ('active', 'deleted') AND (desired_state <> 'deleted' OR type = 'custom')),
	CONSTRAINT "site_domains_lease_check" CHECK((reconciliation_token IS NULL) = (reconciliation_expires_at IS NULL)),
	CONSTRAINT "site_domains_metadata_check" CHECK(metadata IS NULL OR (json_valid(metadata))),
	CONSTRAINT "site_domains_type_check" CHECK(type IN ('subdomain', 'custom')),
	CONSTRAINT "site_domains_role_check" CHECK(role IN ('canonical', 'secondary')),
	CONSTRAINT "site_domains_status_check" CHECK(status IN ('pending', 'verifying', 'active', 'blocked', 'failed', 'disabled', 'deleted', 'retired')),
	CONSTRAINT "site_domains_validation_strategy_check" CHECK(validation_strategy IN ('http_auto', 'txt_manual', 'delegated_dcv')),
	CONSTRAINT "site_domains_dns_status_check" CHECK(dns_status IN ('pending', 'valid', 'invalid', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_domains_domain_unique` ON `site_domains` (`domain`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_domains_cloudflare_hostname_id_unique` ON `site_domains` (`cloudflare_hostname_id`);--> statement-breakpoint
CREATE INDEX `site_domains_org_site_idx` ON `site_domains` (`organization_id`,`site_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_site_domains_one_canonical` ON `site_domains` (`site_id`) WHERE role = 'canonical' AND status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `site_domains_one_active_subdomain` ON `site_domains` (`site_id`) WHERE type = 'subdomain' AND status = 'active';--> statement-breakpoint
CREATE INDEX `idx_site_domains_reconcile` ON `site_domains` (`status`,`next_check_at`);--> statement-breakpoint
CREATE TABLE `site_locales` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`locale` text NOT NULL,
	`label` text,
	`is_source` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'disabled' NOT NULL,
	`activated_at` text,
	`disabled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "site_locales_instants_check" CHECK((activated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', activated_at, '+0 days') IS activated_at) AND (disabled_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', disabled_at, '+0 days') IS disabled_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "site_locales_source_boolean_check" CHECK(is_source IN (0, 1)),
	CONSTRAINT "site_locales_status_check" CHECK(status IN ('published', 'disabled') AND (is_source = 0 OR status = 'published')),
	CONSTRAINT "site_locales_english_source_check" CHECK(locale <> 'en' OR (is_source = 1 AND status = 'published'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_locales_secondary_published_unique` ON `site_locales` (`organization_id`,`site_id`) WHERE is_source = 0 AND status = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_site_locales_one_source_per_site` ON `site_locales` (`organization_id`,`site_id`) WHERE is_source = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `site_locales_organization_id_site_id_locale_unique` ON `site_locales` (`organization_id`,`site_id`,`locale`);--> statement-breakpoint
CREATE TABLE `site_redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`locale` text NOT NULL,
	`owner_type` text,
	`owner_id` text,
	`from_path` text NOT NULL,
	`to_path` text,
	`status_code` integer DEFAULT 301 NOT NULL,
	`behavior` text DEFAULT 'redirect' NOT NULL,
	`reason` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "site_redirects_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "site_redirects_from_path_check" CHECK(from_path LIKE '/%'),
	CONSTRAINT "site_redirects_behavior_check" CHECK(behavior IN ('redirect', 'gone', 'noindex')),
	CONSTRAINT "site_redirects_redirect_to_path_check" CHECK(behavior != 'redirect' OR to_path IS NOT NULL),
	CONSTRAINT "site_redirects_owner_check" CHECK((owner_type IS NULL AND owner_id IS NULL) OR (owner_type IS NOT NULL AND owner_id IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `site_redirects_organization_id_idx` ON `site_redirects` (`organization_id`);--> statement-breakpoint
CREATE INDEX `site_redirects_owner_idx` ON `site_redirects` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_redirects_site_locale_from_path_unique` ON `site_redirects` (`site_id`,`locale`,`from_path`);--> statement-breakpoint
CREATE TABLE `site_transfer_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`from_organization_id` text NOT NULL,
	`to_email` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`initiated_by_user_id` text NOT NULL,
	`accepted_by_user_id` text,
	`claiming_user_id` text,
	`claiming_organization_id` text,
	`message` text,
	`invited_plan` text,
	`invited_coupon` text,
	`invited_domain` text,
	`requires_payment` integer DEFAULT 0 NOT NULL,
	`stripe_checkout_session_id` text,
	`payment_completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`completed_at` text,
	`last_reminder_at` text,
	`reminder_count` integer DEFAULT 0 NOT NULL,
	`invited_interval` text DEFAULT 'month' NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`initiated_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`claiming_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "site_transfer_requests_instants_check" CHECK((payment_completed_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', payment_completed_at, '+0 days') IS payment_completed_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (completed_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', completed_at, '+0 days') IS completed_at) AND (last_reminder_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', last_reminder_at, '+0 days') IS last_reminder_at)),
	CONSTRAINT "site_transfer_requests_status_check" CHECK(status IN ('pending', 'accepted', 'cancelled')),
	CONSTRAINT "site_transfer_requests_invited_plan_check" CHECK(invited_plan IN ('growth')),
	CONSTRAINT "site_transfer_requests_invited_interval_check" CHECK(invited_interval IN ('month', 'year'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_site_transfer_pending` ON `site_transfer_requests` (`site_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `idx_site_transfer_reminders` ON `site_transfer_requests` (`status`,`requires_payment`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_site_transfer_site` ON `site_transfer_requests` (`site_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_site_transfer_token` ON `site_transfer_requests` (`token`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`settings_json` text DEFAULT '{"config":{"default_timezone":"UTC"}}' NOT NULL,
	`integrations_json` text DEFAULT '{}' NOT NULL,
	`organization_id` text NOT NULL,
	`theme_id` text DEFAULT 'saya-theme-v1' NOT NULL,
	`slug` text NOT NULL,
	`subdomain` text,
	`brand_name` text,
	`brand_description` text,
	`contact_email` text,
	`contact_phone` text,
	`default_currency` text DEFAULT 'THB' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`onboarding_status` text DEFAULT 'pending' NOT NULL,
	`url_structure` text DEFAULT 'location_subdirectories' NOT NULL,
	`vertical` text DEFAULT 'restaurant' NOT NULL,
	`last_published_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_by` text,
	`seo_title` text,
	`seo_description` text,
	`canonical_url` text,
	`robots` text,
	`social_facebook_url` text,
	`social_instagram_url` text,
	`social_tiktok_url` text,
	`team_id` text,
	`feature_overrides` text,
	`analytics_data_start_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sites_instants_check" CHECK((last_published_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', last_published_at, '+0 days') IS last_published_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at) AND (analytics_data_start_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', analytics_data_start_at, '+0 days') IS analytics_data_start_at)),
	CONSTRAINT "sites_settings_json_check" CHECK(json_valid(settings_json) AND json_type(settings_json) IS 'object'),
	CONSTRAINT "sites_integrations_json_check" CHECK(json_valid(integrations_json) AND json_type(integrations_json) IS 'object'),
	CONSTRAINT "sites_config_brand_color_check" CHECK(json_type(settings_json, '$.config.brand_color') IS NULL OR json_type(settings_json, '$.config.brand_color') IS 'text'),
	CONSTRAINT "sites_config_press_email_check" CHECK(json_type(settings_json, '$.config.press_email') IS NULL OR json_type(settings_json, '$.config.press_email') IS 'text'),
	CONSTRAINT "sites_config_partnerships_email_check" CHECK(json_type(settings_json, '$.config.partnerships_email') IS NULL OR json_type(settings_json, '$.config.partnerships_email') IS 'text'),
	CONSTRAINT "sites_config_catering_email_check" CHECK(json_type(settings_json, '$.config.catering_email') IS NULL OR json_type(settings_json, '$.config.catering_email') IS 'text'),
	CONSTRAINT "sites_config_careers_email_check" CHECK(json_type(settings_json, '$.config.careers_email') IS NULL OR json_type(settings_json, '$.config.careers_email') IS 'text'),
	CONSTRAINT "sites_config_google_site_verification_check" CHECK(json_type(settings_json, '$.config.google_site_verification') IS NULL OR json_type(settings_json, '$.config.google_site_verification') IS 'text'),
	CONSTRAINT "sites_config_default_timezone_check" CHECK(json_type(settings_json, '$.config.default_timezone') IS 'text' AND length(json_extract(settings_json, '$.config.default_timezone')) > 0),
	CONSTRAINT "sites_config_whatsapp_phone_check" CHECK(json_type(settings_json, '$.config.whatsapp_phone') IS NULL OR json_type(settings_json, '$.config.whatsapp_phone') IS 'text'),
	CONSTRAINT "sites_config_notifications_check" CHECK(json_type(settings_json, '$.config.owner_notification_channels') IS NULL OR json_type(settings_json, '$.config.owner_notification_channels') IS 'array'),
	CONSTRAINT "sites_config_resource_generation_check" CHECK(json_type(settings_json, '$.config.resource_team_generation') IS NULL OR (json_type(settings_json, '$.config.resource_team_generation') IS 'object' AND json_type(settings_json, '$.config.resource_team_generation.transfer_id') IS 'text' AND json_type(settings_json, '$.config.resource_team_generation.generation') IS 'text')),
	CONSTRAINT "sites_consultation_metadata_check" CHECK(json_type(settings_json, '$.consultation.metadata_json') IS NULL OR json_type(settings_json, '$.consultation.metadata_json') IN ('null', 'object')),
	CONSTRAINT "sites_compliance_metadata_check" CHECK(json_type(settings_json, '$.compliance.metadata_json') IS NULL OR json_type(settings_json, '$.compliance.metadata_json') IN ('null', 'object')),
	CONSTRAINT "sites_theme_saya_check" CHECK(json_type(settings_json, '$.theme_by_template.saya') IS NULL OR (json_type(settings_json, '$.theme_by_template.saya') IS 'object' AND json_type(settings_json, '$.theme_by_template.saya.tokens') IS 'object' AND json_extract(settings_json, '$.theme_by_template.saya.status') IN ('active', 'disabled')) IS TRUE),
	CONSTRAINT "sites_theme_blawby_check" CHECK(json_type(settings_json, '$.theme_by_template.blawby') IS NULL OR (json_type(settings_json, '$.theme_by_template.blawby') IS 'object' AND json_type(settings_json, '$.theme_by_template.blawby.tokens') IS 'object' AND json_extract(settings_json, '$.theme_by_template.blawby.status') IN ('active', 'disabled')) IS TRUE),
	CONSTRAINT "sites_config_object_check" CHECK(json_type(settings_json, '$.config') IS NULL OR json_type(settings_json, '$.config') IS 'object'),
	CONSTRAINT "sites_theme_by_template_object_check" CHECK(json_type(settings_json, '$.theme_by_template') IS NULL OR json_type(settings_json, '$.theme_by_template') IS 'object'),
	CONSTRAINT "sites_consultation_object_check" CHECK(json_type(settings_json, '$.consultation') IS NULL OR json_type(settings_json, '$.consultation') IS 'object'),
	CONSTRAINT "sites_compliance_object_check" CHECK(json_type(settings_json, '$.compliance') IS NULL OR json_type(settings_json, '$.compliance') IS 'object'),
	CONSTRAINT "sites_consultation_check" CHECK(json_type(settings_json, '$.consultation') IS NULL OR (json_extract(settings_json, '$.consultation.mode') IN ('external_url', 'native_disabled') AND json_type(settings_json, '$.consultation.cta_label') IS 'text' AND json_extract(settings_json, '$.consultation.schedule_path') LIKE '/%' AND json_extract(settings_json, '$.consultation.confirmation_path') LIKE '/%' AND json_type(settings_json, '$.consultation.tracking_enabled') IN ('true', 'false')) IS TRUE),
	CONSTRAINT "sites_compliance_check" CHECK(json_type(settings_json, '$.compliance') IS NULL OR (json_extract(settings_json, '$.compliance.address_visibility') IN ('visible', 'hidden') AND (json_extract(settings_json, '$.compliance.service_area_type') IS NULL OR json_extract(settings_json, '$.compliance.service_area_type') IN ('AdministrativeArea', 'City', 'Country', 'Place', 'State')) AND json_type(settings_json, '$.compliance.same_as') IN ('array', 'null') AND json_type(settings_json, '$.compliance.contact_points') IN ('array', 'null')) IS TRUE),
	CONSTRAINT "sites_compliance_nonprofit_check" CHECK(json_extract(settings_json, '$.compliance.nonprofit_status') IS NULL OR json_extract(settings_json, '$.compliance.nonprofit_status') IN ('https://schema.org/Nonprofit501c1', 'https://schema.org/Nonprofit501c2', 'https://schema.org/Nonprofit501c3', 'https://schema.org/Nonprofit501c4', 'https://schema.org/Nonprofit501c5', 'https://schema.org/Nonprofit501c6', 'https://schema.org/Nonprofit501c7', 'https://schema.org/Nonprofit501c8', 'https://schema.org/Nonprofit501c9', 'https://schema.org/Nonprofit501c10', 'https://schema.org/Nonprofit501c11', 'https://schema.org/Nonprofit501c12', 'https://schema.org/Nonprofit501c13', 'https://schema.org/Nonprofit501c14', 'https://schema.org/Nonprofit501c15', 'https://schema.org/Nonprofit501c16', 'https://schema.org/Nonprofit501c17', 'https://schema.org/Nonprofit501c18', 'https://schema.org/Nonprofit501c19', 'https://schema.org/Nonprofit501c20', 'https://schema.org/Nonprofit501c21', 'https://schema.org/Nonprofit501c22', 'https://schema.org/Nonprofit501c23', 'https://schema.org/Nonprofit501c24', 'https://schema.org/Nonprofit501c25', 'https://schema.org/Nonprofit501c26', 'https://schema.org/Nonprofit501c27', 'https://schema.org/Nonprofit501c28', 'https://schema.org/NonprofitANBI', 'https://schema.org/NonprofitSBBI')),
	CONSTRAINT "sites_facebook_integration_check" CHECK(json_type(integrations_json, '$.facebook') IS NULL OR (json_type(integrations_json, '$.facebook') IS 'object' AND json_type(integrations_json, '$.facebook.revision') IS 'text' AND json_extract(integrations_json, '$.facebook.kind') IN ('oauth') AND json_extract(integrations_json, '$.facebook.status') IN ('active', 'disabled', 'error')) IS TRUE),
	CONSTRAINT "sites_google_integration_check" CHECK(json_type(integrations_json, '$.google') IS NULL OR (json_type(integrations_json, '$.google') IS 'object' AND json_type(integrations_json, '$.google.revision') IS 'text' AND json_extract(integrations_json, '$.google.kind') IN ('oauth', 'manual') AND json_extract(integrations_json, '$.google.status') IN ('active', 'disabled', 'error')) IS TRUE),
	CONSTRAINT "sites_google_credentials_check" CHECK(json_type(integrations_json, '$.google') IS NULL OR (CASE json_extract(integrations_json, '$.google.kind') WHEN 'oauth' THEN json_type(integrations_json, '$.google.encrypted_access_token') IS 'text' AND json_type(integrations_json, '$.google.encrypted_refresh_token') IS 'text' WHEN 'manual' THEN json_type(integrations_json, '$.google.encrypted_access_token') IS NULL AND json_type(integrations_json, '$.google.encrypted_refresh_token') IS NULL END) IS TRUE),
	CONSTRAINT "sites_facebook_credentials_check" CHECK(json_type(integrations_json, '$.facebook') IS NULL OR json_type(integrations_json, '$.facebook.encrypted_user_token') IS 'text'),
	CONSTRAINT "sites_feature_overrides_check" CHECK(feature_overrides IS NULL OR (json_valid(feature_overrides) AND json_type(feature_overrides) IS 'object')),
	CONSTRAINT "sites_theme_id_check" CHECK("sites"."theme_id" IN ('saya-theme-v1', 'blawby-theme-v1')),
	CONSTRAINT "sites_status_check" CHECK("sites"."status" IN ('active', 'inactive', 'suspended')),
	CONSTRAINT "sites_onboarding_status_check" CHECK("sites"."onboarding_status" IN ('pending', 'active', 'failed')),
	CONSTRAINT "sites_url_structure_check" CHECK("sites"."url_structure" IN ('location_subdirectories', 'brand_pages')),
	CONSTRAINT "sites_vertical_check" CHECK("sites"."vertical" IN ('restaurant', 'experience', 'retail', 'wellness', 'service')),
	CONSTRAINT "sites_default_currency_check" CHECK("sites"."default_currency" IN ('THB','USD','EUR','GBP','JPY','AUD','CAD','SGD','HKD','MYR','IDR','PHP','VND','INR'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sites_slug_unique` ON `sites` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `sites_subdomain_unique` ON `sites` (`subdomain`);--> statement-breakpoint
CREATE INDEX `sites_created_at_idx` ON `sites` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sites_organization_id_id_unique` ON `sites` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `stripe_ga4_subscription_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`stripe_subscription_id` text,
	`action` text NOT NULL,
	`site_id` text,
	`client_id` text,
	`session_id` text,
	`session_captured_at` integer,
	`previous_price_id` text,
	`new_price_id` text,
	`effective_timing` text DEFAULT 'immediate' NOT NULL,
	`source` text DEFAULT 'browser' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`lifecycle_sent_at` text,
	`consumed_at` text,
	`consumed_event_id` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "stripe_ga4_subscription_intents_instants_check" CHECK((lifecycle_sent_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', lifecycle_sent_at, '+0 days') IS lifecycle_sent_at) AND (consumed_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', consumed_at, '+0 days') IS consumed_at) AND (expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', expires_at, '+0 days') IS expires_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at)),
	CONSTRAINT "stripe_ga4_subscription_intents_action_check" CHECK("stripe_ga4_subscription_intents"."action" IN ('initial_subscription', 'upgrade', 'downgrade')),
	CONSTRAINT "stripe_ga4_subscription_intents_status_check" CHECK("stripe_ga4_subscription_intents"."status" IN ('pending', 'consumed', 'expired')),
	CONSTRAINT "stripe_ga4_subscription_intents_timing_check" CHECK("stripe_ga4_subscription_intents"."effective_timing" IN ('immediate', 'period_end'))
);
--> statement-breakpoint
CREATE INDEX `stripe_ga4_subscription_intents_subscription_idx` ON `stripe_ga4_subscription_intents` (`stripe_subscription_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `stripe_ga4_subscription_intents_organization_idx` ON `stripe_ga4_subscription_intents` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `stripe_ga4_subscription_intents_expiry_idx` ON `stripe_ga4_subscription_intents` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `stripe_invoice_payments` (
	`stripe_invoice_id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`base_plan_price_id` text,
	`status` text NOT NULL,
	`period_start` text,
	`period_end` text,
	`past_due_since` text,
	`last_event_created` integer NOT NULL,
	`last_event_id` text NOT NULL,
	`ga4_purchase_status` text DEFAULT 'pending' NOT NULL,
	`ga4_purchase_event_id` text,
	`ga4_purchase_attempt_count` integer DEFAULT 0 NOT NULL,
	`ga4_purchase_claimed_at` text,
	`ga4_purchase_sent_at` text,
	`ga4_purchase_error` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "stripe_invoice_payments_instants_check" CHECK((ga4_purchase_claimed_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', ga4_purchase_claimed_at, '+0 days') IS ga4_purchase_claimed_at) AND (ga4_purchase_sent_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', ga4_purchase_sent_at, '+0 days') IS ga4_purchase_sent_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at) AND (period_start IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', period_start, '+0 days') IS period_start) AND (period_end IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', period_end, '+0 days') IS period_end) AND (past_due_since IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', past_due_since, '+0 days') IS past_due_since)),
	CONSTRAINT "stripe_invoice_payments_status_check" CHECK(status IN ('paid', 'processing', 'failed')),
	CONSTRAINT "stripe_invoice_payments_ga4_purchase_status_check" CHECK(ga4_purchase_status IN ('pending', 'sending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `stripe_invoice_payments_organization_idx` ON `stripe_invoice_payments` (`organization_id`,`period_end`);--> statement-breakpoint
CREATE INDEX `stripe_invoice_payments_subscription_idx` ON `stripe_invoice_payments` (`stripe_subscription_id`,`period_end`);--> statement-breakpoint
CREATE TABLE `stripe_subscription_versions` (
	`stripe_subscription_id` text PRIMARY KEY NOT NULL,
	`last_event_created` integer NOT NULL,
	`last_event_id` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "stripe_subscription_versions_instants_check" CHECK((updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at))
);
--> statement-breakpoint
CREATE TABLE `stripe_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`stripe_event_id` text NOT NULL,
	`event_type` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text,
	`error` text,
	`claimed_at` text,
	`lease_expires_at` text,
	`claim_token` text,
	`next_attempt_at` text,
	`dead_lettered_at` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "stripe_webhook_events_instants_check" CHECK((claimed_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', claimed_at, '+0 days') IS claimed_at) AND (lease_expires_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', lease_expires_at, '+0 days') IS lease_expires_at) AND (next_attempt_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', next_attempt_at, '+0 days') IS next_attempt_at) AND (dead_lettered_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', dead_lettered_at, '+0 days') IS dead_lettered_at) AND (created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
	CONSTRAINT "stripe_webhook_events_status_check" CHECK(status IN ('pending', 'processed', 'failed', 'dead_letter')),
	CONSTRAINT "stripe_webhook_events_payload_check" CHECK(payload IS NULL OR (json_valid(payload)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_webhook_events_stripe_event_id_unique` ON `stripe_webhook_events` (`stripe_event_id`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_events_retry_idx` ON `stripe_webhook_events` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`referenceId` text NOT NULL,
	`stripeCustomerId` text,
	`stripeSubscriptionId` text,
	`status` text DEFAULT 'incomplete' NOT NULL,
	`periodStart` integer,
	`periodEnd` integer,
	`trialStart` integer,
	`trialEnd` integer,
	`cancelAtPeriodEnd` integer DEFAULT 0 NOT NULL,
	`cancelAt` integer,
	`canceledAt` integer,
	`endedAt` integer,
	`seats` integer,
	`billingInterval` text,
	`stripeScheduleId` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_stripeSubscriptionId_unique` ON `subscription` (`stripeSubscriptionId`);--> statement-breakpoint
CREATE INDEX `subscription_referenceId_idx` ON `subscription` (`referenceId`);--> statement-breakpoint
CREATE INDEX `subscription_status_idx` ON `subscription` (`status`);--> statement-breakpoint
CREATE TABLE `team` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`memberCount` integer DEFAULT 0 NOT NULL,
	`organizationId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`organizationId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_organizationId_idx` ON `team` (`organizationId`);--> statement-breakpoint
CREATE TABLE `teamMember` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`userId` text NOT NULL,
	`membershipKey` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teamMember_membershipKey_unique` ON `teamMember` (`membershipKey`);--> statement-breakpoint
CREATE INDEX `teamMember_teamId_idx` ON `teamMember` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamMember_userId_idx` ON `teamMember` (`userId`);--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text,
	`resource` text NOT NULL,
	`source` text NOT NULL,
	`provider` text,
	`channel` text,
	`session_id` text,
	`quantity` integer NOT NULL,
	`unit` text NOT NULL,
	`metadata_json` text,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "usage_events_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at)),
	CONSTRAINT "usage_events_metadata_json_check" CHECK(metadata_json IS NULL OR (json_valid(metadata_json)))
);
--> statement-breakpoint
CREATE INDEX `usage_events_organization_resource_created_idx` ON `usage_events` (`organization_id`,`resource`,`created_at`);--> statement-breakpoint
CREATE INDEX `usage_events_site_created_idx` ON `usage_events` (`site_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `usage_events_organization_id_idempotency_key_unique` ON `usage_events` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT 0 NOT NULL,
	`image` text,
	`phoneNumber` text,
	`phoneNumberVerified` integer DEFAULT 0 NOT NULL,
	`role` text DEFAULT 'user',
	`banned` integer DEFAULT 0,
	`banReason` text,
	`banExpires` integer,
	`isAnonymous` integer DEFAULT 0 NOT NULL,
	`stripeCustomerId` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_phoneNumber_unique` ON `user` (`phoneNumber`);--> statement-breakpoint
CREATE TABLE `user_workspace_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`site_id` text,
	`location_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`whatsapp_pending_confirmation` text,
	`whatsapp_last_inbound_id` text,
	`whatsapp_updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`location_id`) REFERENCES `business_locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`site_id`) REFERENCES `sites`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "user_workspace_state_instants_check" CHECK((created_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 days') IS created_at) AND (updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 days') IS updated_at) AND (whatsapp_updated_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', whatsapp_updated_at, '+0 days') IS whatsapp_updated_at)),
	CONSTRAINT "user_workspace_state_whatsapp_pending_check" CHECK(whatsapp_pending_confirmation IS NULL OR (json_valid(whatsapp_pending_confirmation) AND json_type(whatsapp_pending_confirmation) IS 'object'))
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
