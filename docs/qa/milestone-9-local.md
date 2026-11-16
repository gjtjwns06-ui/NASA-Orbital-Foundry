# Version 9 — orbit sculpting and flight presentation

Version 9 is now privately published at https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site. Native deployment succeeded on 2026-11-15 at 10:16:02 UTC from source commit `0a7932fb212ce0ddfb08e2dbca82b4a184578882`; [publication receipt](milestone-9/deployment.json). The browser and performance evidence below is local; no new hosted measurement is claimed. The original 57 functional/nonfunctional requirements and 20 QA criteria remain unchanged. Commercial-game equivalence and external novice usability are not established.

## Direct orbit manipulation

The Earth planner now exposes independent Pe/Ap handles and an inclination ring. Pointer rays edit a versioned initial ellipse and its real propagated path, with a live readout and launch-package validation. Escape, pointer cancellation, blur, context loss and camera commands cancel the complete draft transaction. Undo/redo is available in the planner. Holding a shape handle freezes OrbitControls damping and cancels camera tweens so the target does not slip under the pointer.

The domain supports 180–2000 km apsides and 0–180° inclination, with a fixed initial periapsis direction. The new model uses orthogonal radial/transverse/normal impulses. Old saves without the opt-in orbit field retain their original circular arithmetic, model identity and replay. Launch insertion limits are authored game assumptions; this is not an ascent simulation or free in-flight orbit editing. See [domain acceptance](../nav01-domain-acceptance.md).

Domain verification: 71 focused CPU cases in seven files, including five exact legacy trajectory/runtime/result fixtures. Four independently authored actual GMAT runs compare 5,764 states; maximum position difference is 0.171 m and velocity difference 0.000190 m/s against predeclared 10 m / 0.01 m/s gates. This validates the scoped central-gravity propagation, not atmospheric drag, J2, ephemeris agreement, communications or mission success.

The separate renderer audit initially found that F moved the camera while an orbit edit stayed active. That rejected evidence is retained. The corrected scene passed nine CPU contract cases, including actual pointer dispatch, selected coeval burn axes, cancellation and camera freeze. Four ray/angle helper cases also passed. [Independent audit](../nav01-ui-independent-audit.md).

Native Chrome 157.0.8103.52 production `index-R7BxOHKt.js` passed four actual-user cases in one 2.5-minute run:

- Korean normal 1280×720 and English large 1920×1080: native mouse Pe/Ap/inclination edits changed the actual trajectory; circular-only rideshare blocked launch; selecting the dedicated insertion package enabled it; JSON preserved the new model and exact draft.
- Native Escape/F cancellation, undo/redo and held-camera preservation, including real prior OrbitControls inertia.
- A genuinely launched elliptical mission reached its natural T+10800 result, exported through the visible JSON control, and exactly reconstructed the full terminal simulation from that file after starting a different draft.

All four report application/resource/native ownership errors as zero. Shader compiler precision/division warnings in two planning cases are retained; no zero-warning claim is made. The 302 source/output/harness identities match before and after. This is functional evidence, not an FPS measurement or a test of every orbit/camera combination. [Before](nav01-native-r1-before.json), [after](nav01-native-r1-after.json), [case evidence](../../tests/browser/artifacts/orbit-apsis/nav01-native-r1/).

## Earth and spacecraft appearance

The accepted optional NASA Blue Marble 8K/16K KTX2 maps improve the real close Earth view. High craft view selects one supported compressed map; medium/workshop/overview use the existing 4K map. Unsupported or failed loads retain the baseline. [Source, encoding, limits and native proof](../earth-detail-handoff.md). The 16K BC7 payload plus retained 4K baseline is approximately 213.33 MiB of GPU map storage, excluding driver and other renderer costs; it is not a free visual improvement.

Four original 256px normal/roughness maps add foil creases and aluminum detail without changing spacecraft geometry, UVs, physical envelopes, lights or camera. The scoped native batch passed in 116.710 seconds with matched states, actual UI replay, active/inactive context restoration and ownership disposal. Draw calls and triangles stayed 111 / 93,284 in the measured actual UI pair; four textures and one program were added. [Explicit handoff](../surface-finish-handoff.md). CPU map/ownership tests passed 7/7. These are separate candidate results, not a combined whole-game suite.

## Integrated flight presentation

The compact objective/equipment panel and reachable restore progress/cancel are accepted and integrated; actual First Light enables the original textured finish by default. The UI candidate retained its R1 aggregate timeout and passed three bounded R2 closure cases, including real cancellation and exact baseline/candidate terminal reconstruction. The observed 74–108-second replay wait is still an unresolved player cost. [UI acceptance](flight-ui-acceptance.md).

Integrated production is `index-BA9aEXW2.js` / `deployment-ui-D4HW_1RB.js`. One native Edge 157.0.4341.46 case passed actual launch/step, compact objective, native 16K plus all four uploaded finish maps, context restoration, genuine resumed flight, save, exit and retirement. The exact five texture objects were reused after restore and all five were disposed on exit. Physical state and camera were exact through restoration; no application or native ownership errors occurred. Source/output/harness identities stayed fixed (304 entries). The first run passed restoration but timed out waiting for +5 physical seconds with a 15-second gate while its observer cloned full state every animation frame. That failed report and original test are retained. A repeat changed only observation polling to250ms, kept the same +5/15s condition and identical product, and passed in58.6s. This shows observer sensitivity, not a proven exclusive attribution or FPS result. [R1](../../tests/browser/artifacts/deployment-v9-integrated/v9-integrated-native-r1/report.json), [R2](../../tests/browser/artifacts/deployment-v9-integrated/v9-integrated-native-r2/report.json).

The following historical entries preserve the measurement sequence. Competing automated jobs are stopped; unrelated user desktop browsers remain open and uncontrolled, so machine-wide isolation is not claimed. All numerical/resource gates remain unchanged. Source publication subsequently completed; hosted browser verification was not rerun. No prior version performance is reused as a version9 measurement.


## Initial scoped performance observations (failed gates retained)

All competing automated jobs were stopped; unrelated user Chrome/Edge desktop windows remained open and uncontrolled. On Chrome157/Arc130V,1920x1080,DPR1,normal UI/full motion:

- Original20part medium planning:120.0111s, mean59.8675646801365FPS,p9917.1ms,max33.4ms. Native resource/identity stability,12drags+12wheels,all errors and every other declared criterion passed. The raw >=60FPS criterion failed; aggregate remains failed.
- Actual Compact medium + original PBR:120.0278s, mean59.85085197683534FPS,p9917.1ms,120physical seconds at1x,+564Jactual motor work. Actual Worker/displayed FK,all source/texture/trail identities,native allocations after the first genuine history upload,all24input gestures and every other declared criterion passed. Aggregate remains failed solely for meanFPS.
- The first medium setup attempt never reached timing because the inherited harness tried Fit while the new Equipment drawer was closed. That failed attempt and its exact harness are retained. The successor uses visible Equipment -> Fit -> Close before timing; numerical/resource gates and product bytes are unchanged.

At this initial checkpoint high16K measurement was pending. These results are not rounded to60, and no causal regression or improvement is inferred from earlier quieter-machine measurements. The strict fresh candidate performance criterion remains unmet.


### Bounded comparison and high-detail startup contract

One accepted-v8 control used the exact current standard20/native observer source, unchanged e0853fe product files and exact served `index-BA0mrQ_m.js` from main. It passed all criteria:120.0237s,60.000800010666204FPS,p9916.9ms. This means the earlier candidate shortfalls cannot simply be dismissed as the desktop environment. Uncontrolled background applications still prevent a causal attribution from this one comparison. [Separate v8 control](../../tests/browser/artifacts/v9-standard20/v8-contemporary-control-r1/chrome/report.json).

The first high16K setup naturally paused atT5 with two genuine history points already uploaded. Its hidden-initial-history prerequisite therefore failed before the120s interval; there is no timed high16K result from that attempt. The real16K map was ready6244ms after launch, with178,957,008 compressed mip bytes. Startup included a333.2ms maximum frame and341/290ms long tasks. These costs remain recorded, independent of steady performance.

A separately declared high-only successor uses a genuine1x visible flight prefix toT5–10, then unchanged-runtime paused warmup. Its measured120s requires exactly zero native allocations/deletions and fixed resource identities from the actually uploaded baseline. It does not turn the earlier first-upload failure into a pass or warm invisible geometry. All FPS,physical advancement,FK,mechanism,input and error gates remain. [New scoped contract](../v9-high16k-steady-contract.md). Its subsequent result is recorded below.


## Final local release acceptance

The high-only steady-flight successor passed all48declared criteria on the unchanged integrated product:120.0073wall seconds,119.75physical seconds at1x,+564Jactual motor work,mean60.0007167747798FPS,p9916.9ms. Actual16K compressed Earth and all4PBR maps stayed uploaded,all24native gestures were observed,displayed FK matched the Worker,and every native resource counter/live identity remained fixed during the timed interval. This is after a recorded real5-second prefix and paused asset warmup; it does not erase high startup stalls. [High report](../../tests/browser/artifacts/v9-firstlight-high16k-steady/v9-high-steady-r1/chrome/report.json).

One bounded standard20 crossover after the accepted-v8 control also passed all30criteria:120.0099s,mean60.00075000937494FPS,p9916.9ms,stable native/Three resources,zero errors and all original input gestures. The standard observer/fixture and all297product source/public/dist files were unchanged from the initial failing candidate run. [Crossover](../../tests/browser/artifacts/v9-standard20/v9-standard20-crossover-r1/chrome/report.json). The initial59.85–59.87FPS reports remain failed. This establishes observed run-to-run variation, not its exclusive cause or guaranteed performance under unrelated background activity. No numerical threshold was changed and no repeat-until-green loop was used. Medium FirstLight's separate initial-upload test retains its numerical FPS failure; high steady and standard20 passes are not relabeled as that test.

Functional release content is accepted locally: independent ellipse editing and strict replay,16Ksafe fallback,original PBR,compact truthful flight objectives,reachable restore progress/cancel,native recovery and resource retirement. Original external novice testing,full original feature/QA matrix,long restore cost and commercial-game parity remain open. Native private publication completed as version 9; this record does not attest a new hosted browser/performance measurement.


Main release build retains canonical public JSON line endings:76dist files (including allJS/CSS/assets) exactly match the tested candidate; three unchanged swingby JSON reference documents differ only by CRLF/LF, with exact parsed-value equality. They are public reference documents; source inspection found the model document linked for inspection, with no runtime fetch of these three paths. The compiled runtime code is byte-identical. [Per-file rebuild record](milestone-9/rebuilt-dist.json). The original functional specification remains SHA25663890bee1904681d2459f64439fe312f687fad75cfce44e8600798aff4844098.
