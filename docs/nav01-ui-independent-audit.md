# NAV01 independent UI/renderer audit

Status: **CPU closure passed; native browser acceptance remains pending**. This is a CPU and source review of the orbit UI candidate, not a browser acceptance or performance result. Product and frozen domain files were not changed by the auditor; the parent agent applied the repair described below.

The actual `GameScene` methods produce a focus-centered initial ellipse, opposite Pe/Ap locations, and a compact plane ring whose angle agrees with the physical plane after the `[x,z,-y]` display transform. The ring's nonzero X offset is included in ray intersection. Removing all maneuvers preserves the orbit controls. Selected coeval-node arrows use the preselected-node RTN frame after earlier ordered impulses, rather than a nearby trajectory sample. The curve and ring release their prior geometry/material when regenerated.

The main transaction source restores the pre-edit design and both undo stacks, increments the revision to reject stale Worker results, and replaces the pending autosave after cancellation. The CPU dispatch tests verify actual ray displacement, Shift scaling and `GameScene` commit/cleanup ordering; they do not substitute for a held native pointer plus Escape/save/reload journey.

## Confirmed defect and repair

Holding an apsis handle and pressing the documented **F** shortcut calls `focusCraft()`. That function changes the camera while leaving the ray-constrained drag active. A later mouse event therefore derives displacement from a different ray projection. The focused regression fails because no rollback happens before the camera changes.

The parent repair cancels the active new orbit gesture before `focusCraft`, `viewAxis`, `flyCamera`, `setMode` and `resize` change the camera or projection. The original eight-case closure passed. Starting a new handle now clears the camera tween and follow state without moving the current view; the render loop suppresses `controls.update(dt)` while the gesture is held. A ninth CPU case invokes the actual `onDown` and `render` methods to check those boundaries and normal update resumption after cleanup. Its update callback is a sentinel for unwanted camera work, not the native OrbitControls implementation.

Real right-orbit damping followed by an immediate handle grab, and the actual held-drag F shortcut, still belong to native browser acceptance. The code no longer relies solely on `controls.enabled=false` to freeze the editing camera.

## Evidence

- [Seven initial CPU cases passed](qa/nav01-render-contract-initial.json).
- [Regression batch: seven passed, one failed](qa/nav01-render-contract-focus-rejected.json). The repeated seven cases are not additional unique tests.
- [Original eight cases passed after repair](qa/nav01-render-contract-focus-closure.json).
- [Final nine-case CPU closure passed](qa/nav01-render-contract-camera-closure.json).
- [Retained rejected audit](qa/nav01-ui-independent-audit-rejected.json) and [its exact eight-case test source](qa/nav01-render-contract-focus-rejected.test.ts.txt).
- [Exact audited source identities and domain matching](qa/nav01-ui-independent-audit.json).
- [Actual-method test source](../tests/nav01-render-contract.test.ts).

TypeScript checking passed after adding the audit tests. All eight current domain sources matched the frozen domain manifest. The earlier 71-case domain run and four GMAT cases were not repeated or relabeled as UI acceptance.

Native labels, pointer hit areas, layout, camera inertia, storage transactions and context restoration remain the browser acceptance scope. No publication, frame-rate or commercial-game quality claim follows from this audit.
