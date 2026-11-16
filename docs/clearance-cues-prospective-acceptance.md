# Clearance witness labels — prospective acceptance

Candidate: `work/clearance-cues`, based on `0a7932f`. This document is written before implementation validation. No acceptance result is prefilled.

The two labels name the **centers of the two existing highlighted inspection boxes** in a completed Sweep/hinge witness preview. They do not mark contact points or predicted flight events. Existing guides are intentionally depth-independent inspection overlays; labels share that meaning. Placement ghosts have no such guides and receive no labels.

1. Each label carries the current accepted source/request IDs and the corresponding real witness part/link/box ID. Its anchor is the existing guide's world position, including its applied preview link pose and structural-body transform. Blocked and uncertain reports use distinct, honest wording and the supplied sample angle.
2. Pending, cancelled, stale-source, hidden, non-workshop, live-flight, context-lost and disposed scenes expose no labels. Offscreen/behind-camera anchors and UI-covered anchors are hidden. Cards and leaders stay in the usable center viewport, below the real badge and above the timeline; colliding cards are separated or hidden if no bounded placement exists.
3. Clicking a visible name selects that actual part, clears a selected hinge and leaves camera, craft, programme and physics unchanged. Stale/hidden label actions cannot select. Closing the preview is explicit, after which the player can use the existing native mouse placement gesture. No automatic relocation or camera reframing is added.
4. Focused CPU tests exercise actual Three.js guide geometry/projection, freshness gates and card placement, without constructing WebGL or claiming a physical flight. A production build checks integration. Source hashes are frozen before these checks.
5. Native acceptance (only when the root grants its browser/GPU lease): real clearance lesson → Sweep → two matching labels; native label selection without camera/input changes; explicit close → native drag repair → real Worker launch gate clears; undo and fresh Sweep; close/Escape, preset, flight and context-loss cleanup. Inspect 1280×720 Korean and 1920×1080 English/large layouts. Preserve failures and scope any unexecuted case as pending.

No physics, saves, new meshes or GPU asset ownership changes are in scope. This is a short clarity improvement, not a new full game acceptance or performance claim. Automated timing leases take precedence over tests/builds.
