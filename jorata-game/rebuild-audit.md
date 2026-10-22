# JORATA rebuild infrastructure audit

Read-only inspection performed 2026-10-22. No database data, schema, storage objects, Edge Functions, project settings, or credentials were changed by this audit. No private credentials are recorded here.

## Source and deployment

- Repository: `https://github.com/Jorataa/Jorata`; application directory: `jorata-game`.
- Existing Vercel project: `j-mind` (`prj_gcx2ocyInULrQpyomxtQ7rzcqamh`), team `jovan-tioria-s-projects` (`team_ntipgViAjbHQfxs5e3HuvGGj`). Framework Vite, Node 24.x.
- Existing production aliases: `https://jorata.vercel.app`, `https://j-mind.vercel.app`.
- Last READY production deployment observed before rebuild: `dpl_mzMvc97TvzRALHg5BLehvd6NbG8H`, `https://j-mind-ms0tmah9h-jovan-tioria-s-projects.vercel.app`. Retain as a deployment rollback reference.
- The working tree already contained substantial uncommitted changes/deletions before this rebuild. A Git commit alone is not a complete backup of that starting state; retain the separate workspace archive prepared by the main implementation task.

## Obsolete application architecture identified before replacement

- `src/social`: conversations, communities, direct messages, message composer/history, reactions, membership, account/session state, bots, social styling and notifications.
- `src/guest`, `server/guest-server.ts`: guest social experience, development session endpoints, Socket.IO namespace and social action/signal handling.
- `server/game-server.ts`: multiplayer world service also contained a `chat` event, message history in welcome payloads, chat throttling, and broadcast logic. Removing only social screens would leave messaging functionality here.
- `api/ai.ts` and `server/index.ts`: `/api/ai` conversation summarization using Supabase identity/quota and an external model provider.
- Social test suites, development social JSON, shared social types/validators, and chat-specific assets must be removed from the active source tree along with their imports.
- Old dependencies included `socket.io`, `socket.io-client`, and `@supabase/supabase-js`. The guest-only rebuilt game/notes product does not require them. Retain no unused service dependency solely to preserve obsolete chat behavior.
- Historical SQL migration files document old schema; they are not active application endpoints. Preserve them in the recoverable backup rather than presenting them as a complete representation of the live database.

## Shared Supabase project: retain until a verified backup exists

The old game's local Supabase URL points to **Jorata**, ref `jedllbtlawxhimxugtcd`. A second connected project, **growtopia-modern**, ref `lckjbxjdwiukelwfywon`, also exists. Its name is not evidence that it is the active game's database. Do not pause/delete either project.

Observed public tables in Jorata, all with RLS enabled:

| Category | Tables | Observed rows |
| --- | --- | --- |
| Shared original application | `profiles`, `user_state` | 0 each |
| Unrelated portal | `pa_admins`, `pa_events`, `pa_media` | 1, 0, 0 |
| Identity and community | `jr_profiles`, `jr_communities`, `jr_community_members` | 6, 2, 4 |
| Rooms and messaging | `jr_rooms`, `jr_room_members`, `jr_messages`, `jr_reactions`, `jr_read_receipts` | 27, 39, 92, 10, 0 |
| Room work | `jr_tasks` | 13 |
| Moderation | `jr_blocks`, `jr_reports` | 0, 0 |
| Existing game state | `jr_world_tiles` | 1 |
| Bots and AI | `jr_bots`, `jr_room_ai_settings`, `jr_ai_requests`, `jr_activity` | 1, 5, 31, 1 |

Counts are an inspection snapshot, not a backup and not a promise of current counts.

The live database contains more than the checked-in migrations: `secure_ai_backend`, `ai_attribution_and_storage_sessions`, and `complete_session_revocation_policies` were applied remotely. Migration versions also differ from local filenames. The most recent remote migration, `pendalaman_alkitab_portal_mvp`, belongs to the unrelated portal. Never reset this shared database from the old local migration directory.

Other dependencies observed:

- Public/private RPCs: `jr_action`, `jr_ai_backend`, `jr_ai_quota`, `jr_mark_read`, `jr_send_message`, `jr_touch`. Private helpers include `jr_action_core`, `jr_ai_context`, `jr_community_role`, `jr_limit`, `jr_message_access`, `jr_message_guard`, `jr_on_signup`, `jr_report_guard`, `jr_require_backend`, `jr_room_access`, `jr_room_admin`, `jr_safe_name`, `jr_session_active`, and `jr_topic_access`.
- `auth.users` has `jr_auth_signup`; messaging/moderation tables have `jr_message_guard` and `jr_report_guard` triggers. Signup behavior is therefore affected by careless removal of private helpers or tables.
- `supabase_realtime` includes `jr_community_members`, `jr_rooms`, `jr_room_members`, `jr_messages`, `jr_reactions`, `jr_tasks`, `jr_world_tiles`, `jr_room_ai_settings`, `jr_activity`, and `jr_read_receipts`.
- Storage buckets: private `jr-media` (6 objects), private `jr-avatars` (1 object), unrelated public `pa-media`. Database dumps do not include the binary object payloads.
- Active Edge Function `jr-qa-bootstrap`, version 2, JWT verification enabled. Retained until its source, dependencies, and recovery artifact are verified. No Edge Functions were listed on the separate growtopia-modern project.

## Safe remote retirement procedure

The rebuilt product should issue no requests to Supabase, old social APIs, or Socket.IO. Guest game and notes persistence is local; do not claim cloud or cross-device synchronization.

Remote chat records are retained because a tested full recovery artifact has not been established. Their presence in a shared database is a documented cleanup limitation, not an active feature of the rebuilt application.

Before any permanent remote cleanup:

1. Obtain a complete logical schema/data export using an authorized database connection, including the `public` and relevant `private` definitions, auth-dependent triggers, grants, RLS policies, publication membership, and migration history. Consult the installed `supabase db dump --help` for current flags. Store restricted backups outside Git and away from frontend build output.
2. Export `jr-media` and `jr-avatars` object bytes plus metadata; archive `jr-qa-bootstrap` source and function settings. Keep auth identifiers recoverable without modifying unrelated auth accounts.
3. Record checksums and row/object counts. Restore into an isolated database/project, validate foreign keys/functions/policies, compare counts, and open sample restored attachments. A successful dump command alone is insufficient recovery verification.
4. Inventory actual foreign-key, trigger, RPC, storage-policy, and publication dependencies against the live catalog. Explicitly protect `profiles`, `user_state`, all `pa_*` resources, `pa-media`, existing auth users, and any retained game data.
5. Retire only confirmed chat-specific execution paths, then data/resources in dependency order. Avoid broad `DROP SCHEMA`, `DROP ... CASCADE`, project deletion, or auth-user deletion. Record a reviewed migration and verify unrelated portal behavior afterward.

No destructive retirement migration is included or applied in this rebuild. The current live database cannot safely be reconstructed from local historical SQL alone.

## Tools and references used

Connected Supabase tools: project/table/function/migration inventory and read-only catalog SQL. Connected Vercel tools: team/project inspection. Supabase and Postgres skills were read before audit; Supabase changelog was fetched and reviewed for relevant breaking-change headings. Vercel CLI and cloud runtime skill guidance were read for existing deployment context. No credentials were printed or placed in this document.
