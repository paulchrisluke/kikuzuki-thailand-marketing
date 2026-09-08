# Preview replacement during expanded route verification

## Scope

This record explains why the expanded preview sweep cannot qualify the full route inventory for PR 864 candidate `64d5ab164455...`. The expected preview carried Nuxt build `f469ae00-15cb-4747-b194-9dd5c066c07e`.

## Timeline

All times are UTC on 2026-09-08.

| Time | Evidence |
| --- | --- |
| 04:11:22 | GitHub Actions run `34186102585` started for branch `feat/u9-krabiclaw-bff` at SHA `259d40fe7ddfff31b6c479d9259dce0fafeba6cf`. |
| 04:15:39 to 04:15:54 | That run reset and migrated the shared preview database. |
| 04:15:45.294 | The first interrupted-sweep request began. Ray `a37b2245ab25054e-OMA` returned HTTP 500 for Kikuzuki `/experiences`. The matching private Worker record at 04:15:45.778 reports `no such table: sites`; the failed data operation read and wrote zero rows. |
| 04:15:50.775 | Ray `a37b2268fe32089c-OMA` returned HTTP 404 for the Kikuzuki location route. The Worker completed normally, but the reset database contained no matching site, so the application rendered `Site Not Found`. |
| 04:15:54 to 04:16:17 | Run `34186102585` deployed its preview Worker. |
| 04:16:32.388 | The last request in the interruption window began. Ray `a37b236d39a56e35-OMA` returned HTTP 404 for the Kikuzuki menu item route, again with a normal Worker outcome and no matching site. |
| 04:16:17 to 04:17:20 | The competing run seeded, provisioned, and verified its own preview fixtures before starting its browser coverage. |

The database reset and Worker deployment intervals from run `34186102585` overlap the observed transition. A later direct fetch of every preview alias returned Nuxt build `687e0f9d-a020-432e-bff1-04188f1d8a36`, rather than the candidate's expected build. Together, the run identity, deployment timing, database errors, and build identifier establish that the shared preview was replaced by the other branch during the sweep.

## Qualification consequence

Results after 04:15:45.294 do not verify PR 864 candidate `64d5ab164455...`. Only the successful prefix completed before that boundary may be retained, and only where its response can be tied to the expected build. The expanded sweep as a whole is incomplete and must not be reported as passing.

No retry, deployment, fixture mutation, or CI status change was performed while diagnosing this replacement.

## Separate NCLS timeout evidence

The final CI request for NCLS `/schedule`, Ray `a37b1bd0bf639ddb-OMA`, preceded the replacement window. Its private Worker record shows HTTP 200 in 2,957 ms, 36 rows read, and zero rows written. This supports the diagnosis that the earlier 30-second NCLS failure exhausted an aggregate multi-route test budget; it was not a failed `/schedule` document response.

Private evidence remains under `.tmp/`. This committed record intentionally omits request headers, query text, parameters, and stack traces.
