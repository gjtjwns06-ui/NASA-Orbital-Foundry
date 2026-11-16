# V9 integrated verification preparation

Status: **PREPARED ONLY — no new browser, GPU, FPS, or performance acceptance run.** The root coordinator owns the final production build and GPU lease. This plan does not promote any requirements-matrix row to complete.

## Freeze and order

1. Finish the NAV01 native cases and compact-flight UI handoff. Integrate the exact accepted Earth and surface-finish files, and enable `surfaceFinish: 'textured'` in the real First Light constructor. Confirm the actual compact objective/drawer is present. These tools never turn product features on through QA setters.
2. Build the final UI worktree, serve its **production `dist` at loopback 5191**, and record the build/source identity. Stop functional browser jobs and close their browser processes before attesting automated-workload isolation. Do not run another tab, asset render, build, or test concurrently.
3. Run the three commands below sequentially. Each starts and closes one fresh browser/context, has a 360-second process deadline, refuses an existing report, and hashes source/public/dist/harness files before and after the timed interval. Review each report before the next command. A changed build requires a new candidate ID; do not combine passes from different input hashes into a single final-build claim.
4. Use the existing functional QA for an integrated native camera/selection/drawer/restore check. If a context-loss postlude is useful, run it only after the 120-second report is fixed, preserve its separate result, and compare actual runtime, camera, PBR ownership and 16K restoration. These performance harnesses do not inject a context loss or successful mission.

```powershell
# Run from orbital-foundry-next-orbit-ui, only after the coordinator releases the GPU.
# Replace v9-integrated-r1 with the immutable candidate/run identifier.
.\tools\performance\v9-run.ps1 -Mode standard20-medium -Candidate v9-integrated-r1 -Browser chrome -Isolated
.\tools\performance\v9-run.ps1 -Mode firstlight-medium -Candidate v9-integrated-r1 -Browser chrome -Isolated
.\tools\performance\v9-run.ps1 -Mode firstlight-high16k -Candidate v9-integrated-r1 -Browser chrome -Isolated
```

Do not launch all three in parallel. The compatibility `-Isolated` flag attests only that competing automated workloads under our control have stopped. Unrelated desktop Chrome/Edge windows and other user apps remain open and uncontrolled. Machine-wide idle/GPU exclusivity is not verified. It is not permission to stop unrelated processes. The wrapper changes only its process environment and restores it afterward; it neither builds nor starts a server. If a harness fails, preserve the entire attempt and its input hashes. Correct a product or harness defect explicitly, then use a new candidate ID. Never alter FPS thresholds, round 59.99 to 60, prefill a mission state, or warm an invisible trail to conceal the first real allocation.

## Three distinct claims

| Run | Exact scene | Retained acceptance scope |
|---|---|---|
| `standard20-medium` | Original 20 real catalogue parts, same physical layout and native input replay; M03 solar planning view; Earth and Mars; 560 craft-path + 600 orbit + 2 guide points | Original 1080p/medium planning stress fixture. Its real budget/power/instrument warnings remain; it is **not** a launched 20-part mission. No new First Light map requests may occur. |
| `firstlight-medium` | Visible Compact preset → real launch → pause at 1× → craft view → 10 s paused warmup → trusted Resume → 120 s active flight | Actual mechanisms, motor work, committed Worker FK, compact objective and default-collapsed equipment drawer. Four real textured-finish maps must be uploaded; Earth remains 4096-wide with zero detail/transcoder requests. |
| `firstlight-high16k` | Same actual Compact launch and control sequence, high setting selected through UI | Actual uploaded compressed **16384×8192** Earth map, 15 mips, exactly one detail request, four uploaded finish maps and compact UI. An 8K/4K fallback is useful functionality but cannot pass this explicit 16K case. |

All runs preserve native DPR1, 1920×1080 CSS/drawing buffer, full motion, normal UI, 12 trusted right drags and 12 wheels, visible-tab timing, **raw mean FPS ≥60, p99≤33.3 ms, and actual measured wall duration 120–121 s**. Frame intervals and long tasks are kept as raw evidence. Maximum interval, counts above 33.3/50 ms, p50/p95 and heap are observations; this preparation does not invent a new long-task or memory threshold. The old v8 60 FPS reports are historical references, not measurements of this integrated candidate.

The active runs require ≥115 physical seconds, ≤wall-time+0.25 s advancement at 1×, actual nonzero mechanism motion and motor energy, running state throughout, and displayed FK matching the committed Worker at each observed time. This is 120 seconds of actual wall-clock flight, not a requirement that the last 0.25-second physics tick land at exactly 120.000 seconds. It is not a complete commissioning mission success claim.

## Resource and stutter attribution

The active harness is derived from the accepted v8 retained-flight contract. It observes the real hidden CPU-owned initial history and preserves its object, geometry, material, BufferAttribute, Float32Array, 1024-point capacity and exact actual-history mapping. The first real history upload may create exactly one Buffer, one VAO, one Program and two subsequently deleted Shaders; nothing else. All subsequent native lifetime counters and object IDs must be exactly stable. No blanket “±1 resource” allowance exists. Non-history geometry/material/program ownership and all texture counts stay fixed. The original failed v8 exact-count report is untouched.

Before the high timed interval, the harness waits at most 90 s for real detail readiness while the physical mission is paused. It then gives the same 10-second paused warmup and requires the map and four finish maps to be truly registered on the native renderer. It records the launch-to-ready elapsed time and startup frame/long-task record in **`startup.json`**, separately from **`timing.json`**. This avoids describing warmed FPS as startup responsiveness, while retaining startup stalls for review. High-detail first upload or shader compilation during the 120-second interval fails the exact resource contract instead of being hidden by moving the resource baseline.

Every run installs the existing all-context native deletion audit before navigation and records active renderer create/delete/live-ID counts. Standard20 additionally tracks the inactive primary renderer for churn. All contexts are checked for ownership errors and unexpected losses; visible Exit is used after timing to include disposal in the error audit. `report.json` stores driver identity, warnings, errors, request failures, snapshots and every declared boolean. **Every criterion must be true for `passed`**. The original standard20 harness recorded some failed FPS/resource fields without always failing its process; this successor closes that reporting hole without changing their numerical thresholds or the original evidence.

CPU mip bytes and estimated finish mip bytes are reported as allocation payloads/estimates. Neither them nor `renderer.info.memory.textures` measures actual GPU resident memory. A 16K compressed payload can consume substantial residency; inspect stutters/native resource churn without presenting its byte count as a hardware memory profiler result.

## Evidence paths and limits

- Standard20: `tests/browser/artifacts/v9-standard20/<candidate>/<browser>/`.
- Medium actual flight: `tests/browser/artifacts/v9-firstlight-medium/<candidate>/<browser>/`.
- High16K actual flight: `tests/browser/artifacts/v9-firstlight-high16k/<candidate>/<browser>/`.
- Every directory: `report.json`, frozen-before/after manifests, raw timing. Active runs also retain startup timing.
- Exact machine-readable contract: [v9-scenario-contract.json](../tools/performance/v9-scenario-contract.json).
- Preparation receipt: [v9-performance-preparation.json](v9-performance-preparation.json).

These runs do not replace the completed NAV domain/GMAT or real pointer/cancel proofs. They also do not cover all missions, browser/hardware combinations, cold network load, accessibility, or commercial-game visual parity. New physical Worker hashes caused by a shared import require scoped legacy identity evidence, not an assertion that every historical artifact is byte-identical. The coordinator must verify which build is served: a before/after filesystem manifest alone cannot prove that a separately running server is serving that directory or that `dist` was built from those source bytes.

## Next highest user-visible gap

After this integration, prioritize **NAV05: understandable consequences of a player's M03 route change**. The original matrix records working date handles/C3/fuel/receipt forecasts, but no previous/new route overlay and no explicit arrival/observation/contact/eclipse difference. That is directly visible in the central game loop: a player can now manipulate an attractive 3D trajectory, yet still has to infer why the new trajectory is better or worse.

A bounded next iteration should retain one last valid M03 candidate as a dashed comparison route; show only actually computed changes in arrival time, departure energy/fuel and science received by the existing deadline; and provide a native one-click return to that exact previous valid plan. Invalid or pending candidates must remain visibly distinct and cannot overwrite the retained comparison. If a quantity such as eclipse time is not computed for the existing M03 model, display its absence rather than fabricate a difference. Include a date-handle change → feasible/infeasible consequence → restore → exact same forecast acceptance journey. The restoration path addresses the relevant part of NAV06; it is not a claim that all cancellation/timeout cases are solved.

This adds a clear decision-and-feedback loop to the user's hands-on design request without adding a new unverified physics system. The original P1 asteroid follow-on journey remains an explicit unmet content request; current Earth→Mars M03 is not that mission. It should follow a separately specified reachable trajectory, science opportunity and GMAT validation domain, rather than a random asteroid collision effect or an invented link from the current Mars exit.


## Pre-run environment clarification

Before the first V9 performance attempt, the coordinator observed unrelated user Chrome/Edge desktop browsers. They were not closed or modified. Reports explicitly record `machineWideIdleVerified:false`, unrelated application activity unmeasured, and no competing automated workload. These are scoped warm measurements on this desktop; comparisons to earlier quiet-machine measurements are contextual, not a controlled performance delta. Every numerical, physical and native resource gate remains unchanged. This is a declared environment protocol before run 1, not a retroactive exception.
