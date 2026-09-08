# Miniflare D1 diagnosis

2026-09-07. Read-only host investigation plus one authorized test-lifecycle correction. No production, dependencies, registry, network configuration, or other processes changed.

## Observed failures

- retirement-d1-serial.log completed 21/23 tests. post-scheduling failed inside Miniflare ProxyClientBridge while applying baseline statements, with connect ETIMEDOUT 127.0.0.1:52285. This is a loopback transport failure before the scheduled-post invariant runs.
- The inbox test first logged a transport failure for its healthy publisher. Its subsequent observed-state read returned undefined, causing JSON parsing to fail. The JSON symptom follows the missing initial transport delivery; it does not establish malformed application JSON.
- retirement-d1-isolated.log passed both identical tests without source changes.
- retirement-d1-serial-final.log failed several product tests at setup or D1 transport and then stopped advancing. No passing aggregate was obtained.

## Installed stack and transport

Node 24.18.1 (repository pin), Miniflare 5.20260826.0-alpha, Undici 7.29.0 under Miniflare, workerd 1.20260826.1 Windows x64.
Miniflare dispatchFetch awaits ready, uses the runtime entry socket, and transports binding operations through an Undici dispatcher (node_modules/miniflare/dist/src/index.js near 113738). The reported address is literal IPv4 loopback, so changing localhost DNS preference would not address this evidence.

## Confirmed teardown defect

product-price-d1.test.ts migratedD1 allocated Miniflare and awaited every baseline statement before returning the runtime to the test. Caller try/finally began only after that await. A setup failure bypassed every disposal block.
During the stuck run, workerd PIDs 15740 and 69748 both belonged to product test child 124460 and were still listening on 127.0.0.1 ports 64408 and 64817. This confirms leaked runtime ownership after failed setup. It explains the stuck child and secondary resource accumulation, not the first loopback failure.
Authorized correction registers context.after immediately after allocation, before any asynchronous setup. All four test callers pass their TestContext. Removed the redundant caller disposal blocks and their two-second Promise.race. There is one teardown owner and the original test error remains reported. Targeted ESLint passed. No runtime tests launched for this correction, per parent instruction.

## Host observations

- TCP dynamic range 49152..65535 (16384 ports). Snapshot had 1034 TIME_WAIT, 352 established, 340 listeners, 322 bound, 35 close-wait sockets. These counts do not demonstrate ephemeral-port exhaustion.
- No System events 4227/4231 were returned for the preceding two hours. Absence is not proof against exhaustion.
- About 5.8 GiB physical memory and 32 GiB virtual/commit headroom remained in the memory snapshot. Global memory exhaustion was not established.
- WSL Ubuntu-24.04 failed before executing its shell: Wsl/Service/CreateInstance/CreateVm/HCS/0x800705aa, Insufficient system resources exist to complete the requested service. Linux Node/Corepack availability could not be inspected. This is a separate resource failure; it does not prove the cause of the loopback errors.
- After the parent stopped runner 109128 and descendants, no workerd processes remained in the next inventory. Remaining Node processes mentioning this checkout were one older unrelated process and two Codex CUA runtimes. No further task-owned Worker was identified for cleanup.

## Next diagnostic and qualification path

Do not repeat the full Windows suite blindly or change application code. The original loopback failure remains unresolved.
For a discriminating Windows diagnostic, capture NODE_DEBUG=net output for the exact existing failing test alongside a timestamped Get-NetTCPConnection/process snapshot at the failed destination port. Determine whether workerd remains listening when the connect fails, whether it exits/restarts, or whether connects fail despite a live listener. The present logs lack that simultaneous observation.

The canonical CI quality job already uses ubuntu-latest, pinned Node24.18.1, immutable Yarn installation, and yarn test:d1 (.github/workflows/ci.yml lines27-48). Running the unchanged suite there is an existing independent qualification path, not a substitute success claim for this failed Windows aggregate. WSL cannot provide that path until its HCS startup issue is resolved. Do not kill unrelated applications or alter pagefile/firewall/port settings without evidence tying them to this failure.

## Second confirmed setup leak

The parent observed retirement-d1-cleanup-final.log pass all four product tests, then fail cache invalidation lifecycle setup and hang in public-resource-cache-d1.test.ts child80604 under runner25508. The second cache test passed afterward, but the child did not exit.

Inspection confirmed migratedCacheD1 had the same allocation ownership gap: Miniflare was allocated and baseline statements awaited before returning; caller try/finally began only after successful return. Authorized correction in public-resource-cache-d1.test.ts registers TestContext.after immediately after allocation and passes each top-level test context into setup. Removed duplicate caller finalizers. Test assertions, application code, and retry behavior are unchanged. Targeted lint and diff validation ran; no runtimes launched by this delegate.

## Completed diagnostic run

The parent ran the full existing D1 suite serially with NODE_DEBUG=net and listener snapshots after both lifecycle fixes. All 23 cases passed, with no failures or skips, in 387053.9857 ms. Evidence is d1-net-full-diagnostic.log and d1-net-full-sockets.log. This proves the final suite passed on this host under instrumentation. It does not establish the cause of earlier intermittent loopback connection failures or erase those failed runs.
