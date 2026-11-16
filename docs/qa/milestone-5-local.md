# Milestone5 local integration evidence

Status: **published as owner-private version5; local9B and actual HTTPS smoke, cold-load and standard performance gates passed**. Nothing in this report certifies commercial-game parity or the unfinished original requirements.

## Runtime and direct controls

Local8D is committed as `d323dc17b3e88dc4a7c5d1aee5c4c2d560fac221`. Its operations3 domain passed41 tests, the real Worker passed10 contract cases, and three actual browser cases passed. The browser journey repairs an observation block with real pointer input, transmits an actual command, distinguishes onboard installation from later Earth ACK, receives12/3 spectra and replays the version2 checkpoint exactly. Other cases cover cancellation/retry, forged import rejection and restore/exit ordering. [Domain record](operations/acceptance-summary.md), [Worker record](operations/worker-contract-audit/result.json), [8D browser artifacts](../../tests/browser/artifacts/remote-operations/8d/).

Local9A added real current-phase spacecraft inspection and NASA Trek's optional4096×2048 Mars mosaic. Its four Korean/English × normal/large1280×720 camera cases passed: visible controls, actual mesh picking/focus, right-drag/wheel, F/Escape, safe framing, unchanged paused flight and exact prior-view restoration. Its first harness attempt incorrectly treated the zero-height fixed-layout body as a clipping rectangle; the corrected test uses the viewport for body/html and retains strict clipping/hit-test assertions. [Four-case record](../../tests/browser/artifacts/craft-camera/9a/batch-summary.json).

The transfer UI, camera helper and CSS from those four cases are unchanged in9B except renderer lifetime handling. Those four cases have not been represented as a new full four-case9B run.

## A functional pass uncovered a graphics failure

The first9A causal lesson passed its gameplay assertions, but its fixture had not collected warning messages. A later raw-trace audit found invalid WebGL deletions. A fresh native create/delete probe reproduced five stale objects at the first inspection-to-overview transition: four buffers and one VAO created before context loss were deleted after restoration. The stack was geometry disposal during path rebuilding. The original functional pass is therefore recorded as **releaseReady:false**, not a graphics pass. [9A warning audit](../../tests/browser/artifacts/remote-operations/9a/console-warnings-from-trace.json), [native reproduction](../../tests/browser/artifacts/remote-operations/9a-native-probe/).

Installed Three0.182's geometry and texture disposal listeners retain the GL-generation cache that created them. Restoring a context creates new caches while CPU scene objects survive. The correction retires the old owned GPU registrations during loss, retaining CPU geometry, images, object identities and game state for re-upload. A shared helper deduplicates ordinary resources and excludes render-target/depth attachments; targets and borrowed environment maps retain explicit owners. Primary postprocessing passes and inactive texture/command-marker pools are included. ControlRoom shares the primary renderer and keeps its borrowed environment separate.

## Frozen9B verification

Build: `index-TfmOhXw5.js`, shared `index-hgc1M-PQ.js`, transfer UI `transfer-ui-jysXN1a1.js`, worker `transfer.worker-D8HCV3Ql.js`. The domain worker is unchanged from8D. TypeScript/build passed; the Korean font subset remains736 characters.

| Gate | Observed result | Scope |
| --- | --- | --- |
| Focused CPU |37/37 PASS |5 GPU-registration ownership cases plus the prior32 camera/texture/signal cases |
| Actual causal lesson with native GL ownership |1/1 PASS,1.4min |Three loaded4K context restores, overview/path rebuilds, cached re-entry, real command/ACK/science, exact save2 replay and actual app Exit |
| Primary/room/transfer recovery and rebuild |2/2 PASS,23.8s |Nine actual restores total: transfer3, primary3, live room3; room Exit, resume/pause, Finish→Redesign, bus replacement, undo and new plan geometry |

The causal case observed zero app errors, zero native deletion errors and zero ownership warnings across both renderer contexts. Each old PMREM target retired once; the detail image remained cached with one network fetch and returned to4096×2048 after restoration. The paused runtime stayed identical. The result's Retry control is visible and hit-testable above the packet history. [9B causal record](../../tests/browser/artifacts/remote-operations/9b/batch-summary.json), [extended recovery record](../../tests/browser/artifacts/transfer-context-ownership/after-9b-rebuild/).

Nine other console warnings remain in the causal trace, including PMREM sampling and driver shader precision warnings. They are preserved; no warning-free rendering claim is made. Native ownership guards now remain active through actual renderer disposal, not only until the restored image appears.

The isolated high-quality1280×720/DPR1 close view completed10 seconds of warmup and120.0094 seconds of measurement: mean60.000750 FPS and p9917.0ms. All twelve actual orbit drags and twelve wheel actions were observed;64 geometries/11 textures/23 programs stayed constant across six samples, the paused runtime hash was identical, and no application errors or ownership warnings occurred. The actual mission craft had eight parts; this is a separate declared55FPS/33.3ms close-view gate, not the original20-part1080p standard fixture. NASA Mars4096×2048 remained active and the planet was visibly at least100px at every sample. [Raw close-view evidence](../../tests/browser/artifacts/performance-craft-inspection/9b/chrome/report.json).

An apparent blank final screenshot in one tool preview prompted a publication hold. Inspection of the saved PNG by two independent viewers, then the root reviewer, showed the craft and detailed204px Mars. Pixel comparison confirmed the entire3D region unchanged; the only before/after difference was the Fit button hover. The image SHA-256 is `23dfa4f0fac8b6b257b6d42cdf0381b6d0246561af8d0c3e7ff6fd2cf51daeb8`. No product fix or replacement measurement was needed; the raw image and numeric result are retained.

Raw Playwright ZIP archives are retained locally and excluded from Git publication. Screenshots, JSON observations, test source, source hashes and an archive manifest are kept in the repository. Historical test executions are not combined into a fictitious single all-tests-pass batch.

The original requirement table remains12 implemented/43 partial/2 unverified. New M02 exit-corridor work is isolated and not part of this candidate build.


## Exact private publication and deployed verification

Published source `8dcf0519bf8401b8f66126b48b0f1704e31e1011`, version5, deployment `appgdep_6af8d19544d88191928b1ae406497ed6` succeeded at2026-11-14T21:24:50Z. [Owner-private game](https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site). Its published entry remains exactly `index-TfmOhXw5.js`; the deployment was built from the pushed source, without the separate M02 candidate worktrees. Owner-only audience remained unchanged.

The local gzip archive is11,784,574B/SHA-256 `ad3fae69b9afb6bdb31824e9c0cc65f3d8374d63d0f78d7e269ec86dd3b7147c`. Hosting records the uncompressed TAR as20,203,520B/51files/SHA-256 `26a621c6cc33be7dfa3eb7131b6100d3a546fe9751a95196a533e7f0fde887f1`; these are deliberately distinct hashes.

Actual HTTPS smoke returned200 and verified16 hardware cards, actual3D rendering and the exact release, with zero errors. Fresh-cache20Mbps/100msRTT/1920×1080 first assembly including fonts took6675.5183ms and11.843744277954102MiB encoded bytes. All responses were measured, with no failed/cache responses; the lazy4K Mars image was absent from initial loading. The separate original20-part medium1080p standard fixture completed10s warmup then120.0167s/7200intervals: mean60.000900013500356FPS,p9917ms,max17.3ms,zero errors/long tasks,all twelve drags/twelve wheels. Six resource samples stayed125geometries/10textures/18programs. The fixture retains documented budget/power warnings and is a rendering stress scene, not a successful spacecraft mission.

Three deployed screenshots were independently visually reviewed. Credentials were passed through memory/stdin only and cleared; all browsers closed before other jobs resumed. [Smoke](../../tests/browser/artifacts/deployed-v5/report.json), [cold load](../../tests/browser/artifacts/cold-load-deployed-v5/report.json), [standard performance](../../tests/browser/artifacts/performance-standard-deployed-v5/report.json), [independent review](../../tests/browser/artifacts/deployed-v5/independent-review.json).
