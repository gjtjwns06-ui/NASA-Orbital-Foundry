# Deployment domain evidence boundary

The19 production source files in `deployment-integration-manifest.json` remain hash-frozen. Domain acceptance now covers69 unique cases across20 files, with explicitly separate runs: the resumed18-file/65-case continuation passed917.79s, the source-matched recovery convergence case previously passed274.99s, and the critical terminal-drain three-case run previously passed115.83s. The original combined69-run was interrupted by the user pause and has no recoverable terminal verdict; it is not reported as a clean full-suite pass. The stored recovery acceptance assertions and both retained source manifests were independently rechecked on resume. Fresh TypeScript and all19 unchanged dependency hashes passed. [Final acceptance receipt](deployment-domain-final-acceptance.json), [raw continuation result](qa/resumed-continuation-2026-11-15T04-46-12Z/vitest-results.json).

No production source, test assertion, numerical gate or pinned fixture changed during this continuation. Renderer, actual pointer interaction, Worker races, context restoration and frame performance retain their separate integrating-owner evidence.

| Plan gate | Domain evidence | Limit |
| --- | --- | --- |
| D01 FK | `deployment-kinematics.test.ts` independent transforms, axes and nested mounts | Renderer must consume the same supplied poses |
| D02 rigid dimensions | Shared link boxes/roles/pivots are explicit | Actual render vertices and connected art are renderer-owned |
| D03 stowed fit | `deployment-craft.test.ts`, fixed-wing flight | Fixed2.876m span requires its actual larger fairing |
| D04 midsweep obstruction | `deployment-clearance.test.ts`, `deployment-clearance-lesson.test.ts` | The authored passive guide has clear endpoints but blocks the real intermediate wing |
| D05 conservative certificate | SAT/Hausdorff interval checks, uncertain-limit regression | Unresolved intervals cannot authorize motion |
| D06 contacts | Explicit bearing-pair exemptions, actual device sweep tests | No whole-owner or bus exemption |
| D07 mass/inertia | Independent box references and full tensor tests | Authored rigid components, no flexible structures |
| D08 angular momentum | Free/coaxial cases plus independent asymmetric3D reference | Reference trajectory comparison supplements conservation |
| D09 actuator feasibility | `deployment-drive-feasibility.test.ts` | Conservative configuration-wide work bound; authored20% useful DC reserve, no vendor torque-speed claim |
| D10 real completion | `deployment-mechanism.test.ts` | Latch verification requires real powered time |
| D11 outages | Mechanism tests plus `deployment-outage-boundaries.test.ts` | Release, acceleration, scheduled braking, cruise and verification retain actual pose/work |
| D12 recovery | Full eclipse-recovery flight, original four-profile gates | Physical15W recovery panels; no checkpoint reset or refill |
| D13 optical geometry | `deployment-devices.test.ts`, actual runtime generation | Nine-ray quadrature is an explicit approximation |
| D14 RF interlock | Device latch gate plus real admitted frames and moving receivers | Supported Iris131072bit/s mode; authored array pattern/network |
| D15 resource accounting | Independent W/J/Wh and both motor-rate integrals | Existing bus/pack output limits apply |
| D16 event causality | Left-limit mode, exact EPS cutoff, preserved previous work | A failing integration interval conservatively emits no RF bits |
| D17 request independence | `deployment-partition.test.ts`, terminal-drain exact partitions | Renderer settings are outside authoritative inputs; browser proof remains separate |

Actual domain flights include compact and fixed successful alternatives, the physically repaired guide configuration, eclipse recovery, interrupted/reversed/redeployed motion, an actual EPS overload with stored energy remaining, and failure between real final-frame emission and receipt. The final frame can arrive after spacecraft power failure, but the result remains failed. Pending and fully drained checkpoints replay from original inputs; no data or energy is installed from a save.

The old successful complete recovery checkpoint is independently pinned and compared exactly after excluding only new terminal metadata. Earlier unpublished save identities are rejected rather than silently migrated. All19 copied released dependencies remain hash-identical. Current production models and historical fixtures are not rewritten.

One broader Stage3 narrative item remains outside the demonstrated fixture set: a negative ordering case between two separate devices. The actual demonstrated ordering negative is lower-before-upper sibling-wing interference, with certified upper-first deployment; the assembled wing→RF device sequence is positively certified. This distinction must remain visible in the combined acceptance report.

Current evidence does not replace the root-owned browser proof of dragging the guide, undo/redo, visible hinge preview, timeline edits, detached/cancelled restore, reduced-motion equivalence, native resource ownership and isolated performance. Those are integration gates, not properties inferred from unit-test counts.
