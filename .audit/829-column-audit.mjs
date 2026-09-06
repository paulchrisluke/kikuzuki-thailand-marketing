import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const Database=createRequire(import.meta.url)('better-sqlite3');
const targetDb=new Database(':memory:');
targetDb.exec(fs.readFileSync('migrations/0000_epoch_5_baseline.sql','utf8'));
const targetTables=targetDb.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t=>({...t,columns:targetDb.pragma('table_info('+JSON.stringify(t.name)+')'),foreign_keys:targetDb.pragma('foreign_key_list('+JSON.stringify(t.name)+')'),indexes:targetDb.pragma('index_list('+JSON.stringify(t.name)+')').map(i=>({...i,columns:targetDb.pragma('index_info('+JSON.stringify(i.name)+')'),sql:targetDb.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(i.name)?.sql??null}))}));
fs.writeFileSync('.audit/829-target-schema.json',JSON.stringify(targetTables,null,2));
const census=JSON.parse(fs.readFileSync('.audit/production-census.json','utf8'));
const staging=JSON.parse(fs.readFileSync('.audit/staging-census.json','utf8'));
const schema=fs.readFileSync('server/db/schema.ts','utf8');
const blocks=new Map([...schema.matchAll(/export const (\w+) = sqliteTable\("([^"]+)", \{([\s\S]*?)(?=\nexport const |$)/g)].map(m=>[m[2],m[3]]));
const paths=execFileSync('rg',['--files','server','shared','utils','scripts','seed-definitions'],{encoding:'utf8'}).split(/\r?\n/).filter(p=>/\.(?:ts|mjs|js)$/.test(p)&&!/(?:schema\.ts|generated|mcp-catalog-snapshots)/.test(p));
const files=paths.map(path=>({path:path.replaceAll('\\','/'),lines:fs.readFileSync(path,'utf8').split(/\r?\n/)}));
const evidence={};
for(const t of census.tables){const re=new RegExp('\\b'+t.name+'\\b');evidence[t.name]=files.flatMap(f=>{const lines=f.lines.flatMap((line,i)=>re.test(line)?[{line:i+1,text:line.trim()}]:[]);return lines.length?[{path:f.path,lines}]:[]});}
fs.writeFileSync('.audit/829-table-evidence.json',JSON.stringify(evidence,null,2));
console.log(census.tables.map(t=>`${t.name}: ${evidence[t.name].filter(e=>e.path.startsWith('server/')).map(e=>e.path.replace(/^server\/(utils\/|domain\/)?/,'')).slice(0,8).join(', ')}`).join('\n'));
const absent=[];const nullableDefaults=[];const unconstrained=[];
for(const t of census.tables){const b=blocks.get(t.name);for(const c of t.columns){const line=b?.split(/\r?\n/).find(l=>new RegExp('^\\s*'+c.name+':').test(l));if(!line)absent.push(t.name+'.'+c.name);else if(c.dflt_value!==null&&!line.includes('.notNull()')&&!c.pk)nullableDefaults.push(t.name+'.'+c.name);if(line&&/boolean/.test(line)&&!b.includes('check('))unconstrained.push(t.name+'.'+c.name)}}
console.log('ABSENT',absent);console.log('DEFAULT_NULLABLE',nullableDefaults);console.log('BOOLEAN_TABLE_NO_CHECK',unconstrained);

const authTables = new Set(['account','invitation','jwks','member','oauthAccessToken','oauthClient','oauthClientAssertion','oauthClientResource','oauthConsent','oauthRefreshToken','oauthResource','organization','session','subscription','team','teamMember','user','verification']);
const decisions = new Map(`
availability_overrides|Booking availability|availability.ts|Explicit owner/date/slot exception and capacity; not another recurring schedule
blog_posts|Publishing|platform-content.ts,blog-publishing.ts|Article metadata/publication; rich body belongs to content_documents
booking_policies|Booking policy|booking-policies.ts|Explicit site/location/experience notice/cancellation/deposit/accessibility policy
business_locations|Location|location-management.ts,google-places.ts|Tenant contact/provider facts, timezone, machine hours and team scope
canary_runs|Operations qualification|scripts/canary-prod.mjs,scripts/canary-provider-status.mjs,scripts/canary-notifications.mjs|Script-written pass/failure evidence; no runtime SQL reader required
chowbot_channel_state|WhatsApp interaction|chowbot-conversations.ts,api/whatsapp/webhook.post.ts|Pending confirmation and last inbound ID; three unused selections retire
chowbot_conversations|Historical ChowBot transcript|scripts/epoch5-data.mjs|13 retained historical conversation headers; no active reader/writer after cleanup
chowbot_messages|Historical ChowBot transcript|scripts/epoch5-data.mjs|42 retained messages including errors/tool calls; obsolete dedupe reader retires
contact_submissions|Guest contact|api/public/sites/[siteId]/contact.post.ts,domain/guest-threads/adapters/contact.ts|Durable submitted contact/consent/association facts
content_blocks|Structured content|content-documents.ts|Ordered typed tree; parent in same document, no cycles
content_documents|Structured content|content-documents.ts,localization.ts|Canonical rich owner token; add exact site FK from actual owner
customers|CRM identity|customers.ts,review-requests.ts|Tenant customer identity/contact/review preferences; distinct from Better Auth identity
dashboard_preferences|Retired UI preference|site-transfer.ts|No read/create consumer; obsolete selected-location preference
domain_reconciliation_jobs|Domain lifecycle|domains.ts|One domain retry schedule independent of raw provider status
experience_bookings|Guest booking|experiences.ts,availability.ts,domain/guest-threads/booking-changes.ts|Experience/date/slot/party commitment and cancellation/review facts
experiences|Product subtype|experiences.ts,availability.ts|Product-linked schedule/duration/capacity/instructions; retire flat schedule
facebook_pages_connections|Meta integration|facebook-pages.ts|Encrypted credentials and selected provider page per site
google_analytics_connections|Google integration|google-analytics.ts,zaraz-analytics.ts|Encrypted OAuth and selected GA4/Search Console properties
guest_thread_deliveries|Guest delivery ledger|domain/guest-threads/deliveries.ts|Per-entry provider/channel/purpose delivery outcomes
guest_thread_entries|Guest inbox ledger|domain/guest-threads/entries.ts,domain/guest-threads/repository.ts|Append-only submission/message/operation/assignment/resolution with sequence/dedupe
guest_threads|Guest inbox|domain/guest-threads/repository.ts,domain/guest-threads/operations.ts|One source thread with independent conversation attention state
location_qa|Location content|location-qa.ts,professional-services.ts|Question/answer scoped to location or page; provenance and publication
mcp_tool_call_events|MCP observability|mcp-telemetry.ts,api/admin/mcp-usage.get.ts|Bounded redacted invocation/error/protocol facts; hashed session/client IDs
mcp_workspace_preferences|MCP user context|mcp-context.ts|Explicit user scope selection; not authority or tenant content
media_assets|Tenant media|media-asset-manager.ts,cloudflare-images.ts|Canonical first-party object identity/dimensions/source/lifecycle
media_placements|Content media|media-placement.ts|Polymorphic owner/slot/asset assignments including generated cards
notification_reads|Notification acknowledgement|notification-acknowledgement.ts|Per-user acknowledgement; empty source is still a live feature
notifications|Dashboard notification|notifications.ts,api/dashboard/notifications/index.get.ts|Scoped notification projection optionally linked to guest entry
offerings|Professional services|professional-services.ts,professional-services-editor.ts|Client service content/FAQ/features/CTA/route and provenance
onboarding_drafts|Onboarding|onboarding-drafts.ts,api/dashboard/onboarding/drafts/[draftId]/commit.post.ts|Resumable versioned source/preview payload with commit lifecycle
organization_billing|Payment/access projection|organization-billing.ts,better-auth-stripe.ts|Payment/order evidence and access grant; remove auth identity mirrors
organization_events|Organization audit history|organization-events.ts,dashboard-events.ts|Append-only domain facts; retired menu event vocabulary stays historical
platform_contact_submissions|Platform support intake|api/contact.post.ts|Durable support request/source/route/optional agent summary
platform_docs|Platform documentation|platform-content.ts,platform-llm.ts|Document metadata/navigation; rich body in content_documents
platform_locale_catalogs|Translation release|localization.ts,site-language-billing.ts|Locale availability and source manifest publication identity
platform_locale_messages|Platform translation|localization.ts|Locale/message-key translated dictionary
post_channel_jobs|Social publication|post-management.ts,facebook-pages.ts|Independent channel attempt outcome/provider identity; no Google publisher
posts|Local business post|post-management.ts,shared/posts.ts|Discriminated standard/event/offer/alert and structured CTA
prices|Product price ledger|product-management.ts,experiences.ts|Integer minor-unit currency price intervals/provenance; history retained
product_categories|Product taxonomy|product-management.ts|Scoped ordered standard/experience category
products|Product catalog|product-management.ts,experiences.ts|Shared sellable identity/category/visibility/SEO; experience subtype linked
public_resource_cache_invalidations|Public cache outbox|public-resource-cache.ts|Durable invalidation processing/attempts/errors
rate_limits|Request throttling|hourly-rate-limit.ts,api/contact.post.ts,api/analytics/track.post.ts|Atomic public ingress key/window counters
reservation_submissions|Guest reservation|api/public/sites/[siteId]/reservations.post.ts,domain/guest-threads/booking-changes.ts,availability.ts|Date/time/party commitment and cancellation/completion/review facts
resource_localizations|Tenant translation|localization.ts,localization-registry.ts|Explicit resource/locale values/route/optional rich document
review_requests|Guest review capability|review-requests.ts,tasks/review-request-automation.ts|Hashed expiring booking/customer token and send/claim/revocation facts
reviews|Customer review|review-management.ts,google-places.ts|Content/attribution/provenance/reply/moderation and publication authorization
site_analytics_daily|Analytics aggregate|site-analytics-report.ts|Local-date page/session/visitor/duration counts
site_analytics_dimension_daily|Analytics aggregate|site-analytics-report.ts|Local-date country/city/device/referrer dimension counts
site_analytics_page_daily|Analytics aggregate|site-analytics-report.ts|Local-date page-path counts
site_analytics_sessions|Analytics session|pageview-tracking.ts,site-conversions.ts,site-analytics-report.ts|Pseudonymous session and captured last-touch campaign attribution
site_config|Site configuration|platform-content.ts,availability.ts,site-analytics-report.ts|Keyed settings including explicit default_timezone
site_consultation_settings|Consultation|professional-services.ts,professional-services-editor.ts|Explicit external CTA/disabled-native mode/tracking configuration
site_conversion_events|Conversion ledger|site-conversions.ts,site-analytics-report.ts|Captured CTA/submission/handoff event and original attribution strings
site_domain_events|Domain audit history|domains.ts,domain-read-model.ts|Before/after provider/DNS lifecycle facts
site_domains|Domain lifecycle|domains.ts,domain-read-model.ts|Canonical assignment/role/DNS/SSL verification and provider status
site_language_licenses|Language billing|site-language-billing.ts|Paid locale lifecycle/provider item/quantity/idempotency; English not billed
site_link_items|Professional links|site-links.ts|Ordered explicit client destinations under links page
site_link_pages|Professional links|site-links.ts|Named public links page and SEO route
site_locales|Tenant languages|localization.ts,public-locale-representations.ts|Published/disabled locales and immutable English source relation
site_pageview_events|Raw analytics|pageview-tracking.ts,analytics.ts|Page view with pseudonymous visitor/session and captured dimensions
site_redirects|Public route history|tenant-pages.ts,localization.ts,middleware/zz-redirects.ts|Explicit redirect/gone/noindex history and optional content owner
site_theme_tokens|Template styling|professional-services.ts,professional-services-editor.ts|Validated client template-specific design overrides
site_transfer_requests|Ownership transfer|site-transfer.ts,billing-webhook-app-events.ts|Claim/payment/invitation/completion history; restoration snapshot retires
sites|Tenant site|platform-content.ts,utils/template-registry.ts|Brand identity/contact/template identifier/tenant and feature scope
spent_subdomains|Hostname tombstone|domains.ts,middleware/tenant-resolution.ts|Retired hostname reassignment protection; site_id deliberately has no FK
stripe_ga4_subscription_intents|Billing attribution|stripe-ga4-intents.ts|Expiring consume-once subscription-change attribution intent
stripe_invoice_payments|Payment ledger|better-auth-stripe.ts,stripe-processed-invoice-replay.ts|Invoice payment/event order evidence and GA4 delivery claim
stripe_subscription_versions|Provider ordering|better-auth-stripe.ts,organization-subscription-reconciliation.ts|Exact last event time/ID per subscription to reject stale delivery
stripe_webhook_events|Webhook inbox|better-auth-stripe.ts,tasks/stripe-reconciliation.ts|Event payload/processing lease/retry/dead-letter outcome
tenant_compliance|Client legal identity|professional-services.ts,professional-services-editor.ts|Actual entity/disclaimer/contact/schema facts and policy references
tenant_page_variants|Localized page|tenant-pages.ts,content-documents.ts,public-tenant-pages.ts|Locale-specific route/metadata/canonical rich document
tenant_pages|Page identity|tenant-pages.ts|Stable identity/type/source/order independent of locale body
themes|Retired registry duplicate|scripts/generate-demo-seed.ts,utils/template-registry.ts|Seed-only metadata; actual template registry constrains sites.theme_id
usage_events|Usage ledger|usage-metering.ts,ai-credits.ts|Append-only quantity/unit/provider/idempotency provenance
usage_quota_grants|Quota entitlement ledger|usage-metering.ts,quota-adjustment.ts|Explicit grant/reset period and consume-once identity
work_requests|Managed service|work-request-management.ts,api/admin/work-requests/[id].patch.ts|Submitted work/type/priority/assignment/completion
zaraz_sync_lock|Provider synchronization|zaraz-analytics.ts|Singleton lease; NULL locked_at intentionally means unheld
`.trim().split('\n').map(l=>{const [table,owner,owners,responsibility]=l.split('|');return [table,{owner,owners:owners.split(','),responsibility}]}));
for(const table of authTables)decisions.set(table,{owner:'Better Auth',owners:['auth.ts','better-auth-stripe.ts','member-access.ts'],responsibility:`Supported provider-owned ${table} schema/adapter contract; full pinned 18-table census proves indirect consumers`});
const removedTables=new Set(['dashboard_preferences','themes']);
const removed=new Map([
['contact_submissions.status','Guest-thread state is canonical; retired write-once source status'],['platform_contact_submissions.status','Guest-thread state is canonical; retired write-once source status'],
['business_locations.attributes','Unused provider-invented shape; all source values NULL; no supported current Places contract'],
['business_locations.facebook_page_id','Write-only obsolete location cache; publishing reads Facebook connection directly'],['business_locations.facebook_connection_id','Write-only obsolete location cache; entire uncalled synchronization writer deleted'],
['customers.marketing_opted_out_at','No consumers or writers outside schema; all production values NULL, staging empty'],['customers.loyalty_points_balance','No consumers or writers outside schema; all production values zero, staging empty'],
['sites.public_url','Redundant canonical active site_domains URL cache; production six populated values match; site-demo NULL cache is stale'],['sites.custom_domain','Redundant custom domain cache; every populated value matches actual same-site custom domain'],['sites.custom_domain_status','Redundant custom domain cache; current status derives from actual site_domains lifecycle'],
['account.expiresAt','Unsupported obsolete provider field; all values NULL'],
['business_locations.is_primary','Retired implicit-location discriminator'],['sites.primary_location_id','Retired implicit-location pointer'],['sites.theme','Duplicate of canonical theme_id registry selector'],
...['selected_site_id','active_conversation_id','pending_message_id'].map(c=>['chowbot_channel_state.'+c,'Unused option; all production/staging values NULL']),
['experiences.time_slots','Project flat-only to recurring_slots; explicit recurring wins dual rows; record conversion evidence'],
['oauthClient.scopesJson','Move exact grants to supported scopes'],['oauthClient.requirePkce','Move exact value to case-correct requirePKCE'],['oauthRefreshToken.accessTokenId','Unsupported provider field; all values NULL'],
['organization_billing.stripe_customer_id','Verified mirror of organization.stripeCustomerId'],['organization_billing.stripe_subscription_id','Verified mirror of subscription.stripeSubscriptionId'],
...['custom_domains_snapshot','custom_domains_removed_at'].map(c=>['site_transfer_requests.'+c,'Unused restoration snapshot; all source values NULL']),
['subscription.limits','Unsupported extension; all values NULL'],...['createdAt','updatedAt'].map(c=>['subscription.'+c,'Unsupported extension; preserve discard hash/source export; actual invoice/event history stays']),
...['cta_type','cta_url','event_title','event_start','event_end','offer_coupon','offer_terms'].map(c=>['posts.'+c,'Explicit structured CTA/event/offer projection; reject partial invalid facts']),
]);
const conversions=new Map([
['business_locations.timezone','Preserve authored IANA timezone; materialize proven existing site timezone or authoritative provider evidence only; unresolved remains NULL and unavailable'],
['business_locations.opening_hours','Proven minute-set equivalent structured weekly periods; NULL remains unknown'],['business_locations.special_hours','Validate tagged dated hours/closure array; preserve NULL'],['experiences.recurring_slots','Validate weekday HH:MM[] map; explicitly convert flat-only source'],['posts.post_type','update becomes standard; preserve supported topics'],['oauthClient.scopes','Replace stale contents with exact canonical scopesJson grants'],['reviews.status','Proven published public rows become approved'],['canary_runs.details_json','Recover 13 proven SQL double-backslash defects without semantic payload loss'],['mcp_tool_call_events.result_summary_json','Wrap 118 truncated strings preserving every original byte'],['onboarding_drafts.payload_json','Project nested source/preview hours through same explicit conversion'],['resource_localizations.values_json','Preserve translated content; remove only proven derived hours presentation'],['site_config.value','Preserve existing settings; materialize proven former effective analytics timezone once'],
]);
for(const [t,cs] of [['platform_locale_catalogs',['available_at','created_at','updated_at']],['platform_locale_messages',['updated_at']],['resource_localizations',['created_at','updated_at']]])for(const c of cs)conversions.set(t+'.'+c,'Numeric-text Unix seconds to identical ISO UTC instant; preserve valid ISO/NULL');
const retention=(t)=>{
 if(removedTables.has(t))return 'Explicit obsolete-data discard with source row/field hashes; no replacement';
 if(authTables.has(t))return 'Preserve supported provider state/issued credentials exactly; provider expiry/revocation and existing FK lifecycle remain authoritative';
 if(t.startsWith('chowbot_')&&t!=='chowbot_channel_state')return 'Preserve immutable historical rows exactly; no new active consumers/history model; existing owner/user deletion cascades';
 if(t==='site_pageview_events')return 'Existing raw retention 90 days (site-analytics-report.ts:327); preserve all still-present source facts';
 if(t.startsWith('site_analytics_'))return 'Existing session/aggregate retention 740 days (site-analytics-report.ts:328-346); preserve all still-present source facts';
 if(t==='stripe_ga4_subscription_intents')return 'Existing terminal retention 90 days (stripe-ga4-intents.ts:337); preserve pending consume-once identity';
 if(t==='stripe_webhook_events')return 'Existing payload retention 90 days (tasks/stripe-reconciliation.ts:26); preserve event/dead-letter outcomes even when provider payload unavailable';
 if(t==='public_resource_cache_invalidations')return 'Existing terminal retention seven days (public-resource-cache.ts:22); preserve pending work/claims/errors';
 if(t==='media_placements')return 'Retain valid owner/slot assignments; discard exactly 30 proven synthetic Markdown owner relationships with row/parent/asset hashes; preserve all 339 assets and 679 content blocks byte-exact';
 if(t==='spent_subdomains')return 'Indefinite hostname tombstone deliberately survives deleted tenant';
 if(t==='rate_limits')return 'Expiry resets on next atomic claim (hourly-rate-limit.ts); preserve current counters/window';
 if(['usage_events','usage_quota_grants','prices','organization_events','site_domain_events','stripe_invoice_payments','stripe_subscription_versions','canary_runs','mcp_tool_call_events'].includes(t))return 'Preserve ledger/history exactly, including historical provider/source/event vocabulary; no new age purge';
 return 'Preserve current domain records and existing FK deletion lifecycle; no new age purge; explicit polymorphic owner cleanup where applicable';
};
const escape=s=>String(s??'').replace(/[\t\r\n]/g,' ');
const tableRows=[],columnRows=[],followups=[];
for(const t of census.tables){
 const d=decisions.get(t.name);if(!d)throw Error('Missing table decision '+t.name);
 const st=staging.tables.find(s=>s.name===t.name);const b=blocks.get(t.name);const target=targetTables.find(x=>x.name===t.name);const checks=[...(target?.sql??'').matchAll(/CONSTRAINT [^\n]+ CHECK\([\s\S]*?(?=,\n\t(?:CONSTRAINT|FOREIGN)|\n\)$)/g)].map(m=>m[0]);
 const sourceSql=census.schema.find(s=>s.type==='table'&&s.name===t.name)?.sql??'';
 const sourceChecks=sourceSql.split('\n').filter(l=>/\bCHECK\s*\(/i.test(l));
 const targetIndexes=b?.split(/\r?\n/).filter(l=>/\b(?:index|uniqueIndex|unique|primaryKey)\(/.test(l)).map(l=>l.trim())??[];
 const refs=evidence[t.name];const sqlrefs=refs.flatMap(f=>f.lines.filter(l=>new RegExp('(?:FROM|JOIN|INTO|UPDATE|TABLE)\\s+[\x60"\']?'+t.name+'\\b','i').test(l.text)).map(l=>f.path+':'+l.line));
 const scoped=files.filter(f=>refs.some(r=>r.path===f.path)||d.owners.some(o=>f.path===o||f.path.endsWith('/'+o)));
 const disposition=removedTables.has(t.name)?'remove obsolete table':d.owner==='Historical ChowBot transcript'?'retain immutable historical table':'retain domain table';
 tableRows.push([t.name,t.row_count,st.row_count,t.columns.length,disposition,d.owner,d.responsibility,d.owners.join('; '),sqlrefs.join('; '),checks.join('; '),retention(t.name)]);
 for(const c of t.columns){
  const key=t.name+'.'+c.name;const sc=st.columns.find(x=>x.name===c.name);const line=b?.split(/\r?\n/).find(l=>new RegExp('^\\s*'+c.name+':').test(l));const re=new RegExp('\\b'+c.name+'\\b');
  const syms=scoped.flatMap(f=>f.lines.flatMap((l,i)=>re.test(l)?[f.path+':'+(i+1)]:[])).slice(0,24);
  const remove=removedTables.has(t.name)||removed.has(key);const conversion=conversions.get(key)??(t.name==='media_placements'?'Copy exact field for retained rows; remove exactly 30 synthetic Markdown relationships proven redundant with retained parent Markdown asset URLs; preserve evidence hashes':undefined);
  const columnEvidence=authTables.has(t.name)?'Pinned Better Auth 18-table schema census and supported adapter/plugin contract':syms.length?syms.join('; '):d.owner==='Historical ChowBot transcript'?'Retained historical payload; no active runtime consumer intended':'Whole-row/table boundary: '+sqlrefs.slice(0,6).join('; ');
  if(!remove&&!line)followups.push('MISSING TARGET '+key);
  if(!remove&&!authTables.has(t.name)&&!syms.length&&d.owner!=='Historical ChowBot transcript')followups.push('WHOLE-ROW/INDIRECT CONSUMER '+key+' '+columnEvidence);
  const fks=t.foreign_keys.filter(f=>f.from===c.name).map(f=>f.table+'.'+f.to+' ON DELETE '+f.on_delete);
  const idx=t.indexes.filter(i=>i.columns.some(x=>x.key&&x.name===c.name)).map(i=>i.name+(i.unique?' UNIQUE':'')+(i.partial?' PARTIAL':'')+'('+i.columns.filter(x=>x.key).map(x=>x.name??'[expression]').join(',')+')');
  columnRows.push([t.name,c.name,remove?'remove/project obsolete field':conversion?'retain with explicit conversion':'retain exact typed value',d.owner,d.responsibility,c.type,c.notnull,c.dflt_value,c.pk,c.null_count+'/'+t.row_count,sc.null_count+'/'+st.row_count,c.storage_types.map(s=>s.type+':'+s.count).join(','),remove?'[removed]':line?.trim()??'[MISSING]',sourceChecks.filter(l=>re.test(l)).join('; '),checks.filter(l=>re.test(l)).join('; '),fks.join('; '),(target?.foreign_keys.filter(f=>f.from===c.name).map(f=>'group '+f.id+' '+f.from+' -> '+f.table+'.'+f.to+' ON DELETE '+f.on_delete)??[]).join('; '),idx.join('; '),targetIndexes.filter(l=>re.test(l)).join('; '),columnEvidence,d.owners.join('; '),retention(t.name),remove?removed.get(key)??retention(t.name):conversion??'Copy exact typed source value; typed logical hash parity required']);
 }
}
const tsv=(file,header,rows)=>fs.writeFileSync(file,[header,...rows].map(r=>r.map(escape).join('\t')).join('\n')+'\n');
tsv('.audit/829-columns.tsv',['table','column','final_disposition','owner','responsibility','source_type','source_not_null','source_default','source_pk','production_nulls_rows','staging_nulls_rows','production_storage_types','target_declaration','source_checks','target_checks','source_foreign_keys','target_foreign_keys','source_indexes','target_index_declarations','column_consumer_evidence','canonical_readers_writers','retention','transfer'],columnRows);
tsv('.audit/829-tables.tsv',['table','production_rows','staging_rows','source_columns','final_disposition','owner','responsibility','canonical_readers_writers','direct_sql_boundaries','target_checks','retention'],tableRows);
fs.writeFileSync('.audit/829-column-followups.txt',followups.join('\n')+'\n');
fs.writeFileSync('.audit/829-column-audit.md',`# Epoch 5 table and column disposition\n\nThe inventory accounts for ${columnRows.length} source columns across all ${tableRows.length} production tables, including staging null counts. The generated Epoch 5 baseline contains ${targetTables.length} tables; [target columns](829-target-columns.tsv) includes every retained and newly added field, and [target schema](829-target-schema.json) records full generated constraints, composite FK groups, and index SQL. [Columns](829-columns.tsv) records source SQLite storage classes, defaults, keys/index participation, target declarations/CHECKs, consumer evidence, retention and exact conversion/discard decisions. [Tables](829-tables.tsv) records curated domain ownership and canonical runtime/script boundaries. [Indexes](829-indexes.tsv) accounts for all 328 source indexes: 311 retained names, nine redundant prefixes removed, four retired-table indexes and four retired-field indexes removed. The source census contains complete CHECK/index SQL and typed row hashes. The report reads the generated Epoch 5 baseline directly and must be regenerated if that baseline changes.\n\nColumn references are reproducible searches within table consumers and curated owner modules. They are review locations, not a liveness oracle. Better Auth is proven through the pinned package's complete 18-table schema census, not direct application SQL. Empty tables can implement live features; historical ChowBot transcripts intentionally remain with no active consumers, preserving customer records without a second model.\n\nHistorical event/source vocabulary and raw external provider states remain open strings. Restricting history to today's writer union would reject valid retained facts. Generated owned current status/type unions and JSON object/array invariants are listed in the per-column target checks. Better Auth optional role/banned defaults and provider-owned emailVerified encoding remain the pinned provider contract. Existing retention is recorded; no new purge policy is introduced.\n\nThe production-source transfer candidate passed strict declared source/destination coverage, typed hash parity and nine ownership/content invariants: 94 target tables and 42,244 rows. The [sanitized transfer summary](829-transfer-summary.json) retains the actual schema and table hashes, with 30 explicit synthetic relationship removals and all 339 assets / 679 blocks preserved. Browser, ingress and remote release qualification remain separate gates; source references and inventory counts do not prove them. Inventory evidence follow-ups: ${followups.length}; see [follow-ups](829-column-followups.txt). This count does not assert that SQL consumers compile or behavior is correct. Scheduled-task billing projections were missed by the initial inventory despite a zero count; the separate [SQL consumer review](829-sql-consumer-review.md) records the subsequent full-surface preparation pass and its limits.\n`);
console.log(JSON.stringify({tables:tableRows.length,columns:columnRows.length,followups:followups.length}));

const addedTransfers=new Map([['content_documents.site_id','Derive from exact existing polymorphic owner; platform owners use platform; reject missing or cross-tenant owners'],['oauthClient.requirePKCE','Copy exact case-corrected source requirePkce'],['posts.call_to_action','Project source action and URL; CALL requires explicit location phone; reject unsupported/partial values'],['posts.event','NULL after proving every source event field NULL; source has no event topic'],['posts.offer','NULL after proving every source offer field NULL; source has no offer topic'],['posts.alert_type','NULL for proven existing standard/update topics'],['reviews.google_review_metadata','NULL: source has no structured Google review metadata; preserve original retained provider ID and review facts']]);
const targetRows=targetTables.flatMap(t=>t.columns.map(c=>{const source=census.tables.find(x=>x.name===t.name)?.columns.find(x=>x.name===c.name);const d=decisions.get(t.name);return [t.name,c.name,source?'existing source field':'added canonical field',c.type,c.notnull,c.dflt_value,c.pk,d.owner,d.responsibility,source?(conversions.get(t.name+'.'+c.name)??(t.name==='media_placements'?'Exact retained rows after 30 proven synthetic Markdown relationships discarded with hashes':'Copy exact typed retained value')):addedTransfers.get(t.name+'.'+c.name),(t.indexes.filter(i=>i.columns.some(x=>x.name===c.name)).map(i=>i.sql??i.name)).join('; '),(t.foreign_keys.filter(f=>f.from===c.name).map(f=>'group '+f.id+' '+f.from+' -> '+f.table+'.'+f.to+' ON DELETE '+f.on_delete)).join('; ')];}));
tsv('.audit/829-target-columns.tsv',['table','column','source_relationship','type','not_null','default','primary_key','owner','responsibility','transfer','indexes','foreign_keys'],targetRows);
console.log(JSON.stringify({targetTables:targetTables.length,targetColumns:targetRows.length,added:targetRows.filter(r=>r[2]==='added canonical field').map(r=>r[0]+'.'+r[1])}));

const indexRows=[];
for(const sourceTable of census.tables){const target=targetTables.find(t=>t.name===sourceTable.name);for(const idx of sourceTable.indexes){const sourceCols=idx.columns.filter(c=>c.key).map(c=>c.name);const same=target?.indexes.find(i=>i.name===idx.name);const equivalent=target?.indexes.find(i=>Boolean(i.unique)===Boolean(idx.unique)&&Boolean(i.partial)===Boolean(idx.partial)&&i.columns.length===sourceCols.length&&i.columns.every((c,n)=>c.name===sourceCols[n]));const prefix=!idx.unique&&!idx.partial?target?.indexes.find(i=>!i.partial&&i.columns.length>=sourceCols.length&&sourceCols.every((c,n)=>c===i.columns[n].name)):null;const gone=sourceCols.filter(c=>c&&!target?.columns.some(tc=>tc.name===c));const disposition=!target?'remove with retired table':same?'retain named index':equivalent?'replace with equivalent target key':gone.length?'remove retired-field index':prefix?'remove redundant prefix index':'removed; inspect source SQL against target indexes';indexRows.push([sourceTable.name,idx.name,sourceCols.join(','),idx.unique,idx.partial,disposition,same?.sql??equivalent?.sql??prefix?.sql??gone.join(',')]);}}
tsv('.audit/829-indexes.tsv',['table','source_index','columns','unique','partial','disposition','target_evidence'],indexRows);
console.log(JSON.stringify({indexRows:indexRows.length,indexReview:indexRows.filter(r=>r[5].startsWith('removed;')).map(r=>r[1])}));
