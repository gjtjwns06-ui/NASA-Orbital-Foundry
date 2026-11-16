# Version 11: identify the hardware that blocks unfolding

The published version10 remains the baseline. This iteration connects the existing physical clearance witness to the player's direct repair action.

## Player interaction

Run the existing unfolding inspection. Two numbered labels point to the actual highlighted boxes: the cable guide and solar wing in the introductory obstruction. They identify inspection-box centers and the computed sample angle, with distinct blocked/uncertain wording. Selecting a label selects the real part without moving the camera or changing the design. Close the preview, drag the actual hardware, and inspect again. Successful clearance still comes from the ordinary Worker.

Labels follow camera and viewport changes. Invalid, pending, cancelled, offscreen or obsolete previews cannot leave interactive labels behind. Flight has no preview annotations. The same native pointer, keyboard, Undo, context recovery and save semantics remain.

## Implementation boundary

Five production files add source-bound read-only guide positions, screen projection, a small pure CSS-pixel layout function and two persistent DOM labels. No new GPU meshes, textures, shaders, physical model, numerical tolerance, save format or automatic relocation is introduced.

The first source review caught persistent keyboard focus being restored to the wrong label; R2 fixes that exact target. Candidate CPU4/4 and build passed. The Korean native repair case passed. The initial English case incorrectly expected every window resize to cancel a valid preview; that failure remains archived. A separate corrected closure verified actual reprojection, context cleanup, preset and live-flight exclusion without changing the product. The original scripts and records are retained.

## Integrated acceptance

1. Validate all five production hashes against the frozen candidate and all support-file hashes against its delivery allowlist. Keep the shared native-audit helper unchanged.
2. Build against version10's accepted route comparison and run focused renderer, material, flight-presentation and route-comparison regressions.
3. Run the final combined native cue spec once on this integrated product. Use an explicit integration-freeze path so the old candidate's build hashes are not asserted against a different integration. Preserve its imported script before this harness-only parameterization.
4. Verify actual identities, readable/reachable layouts, no-camera selection, keyboard focus, direct repair/Undo, resizing and graphics recovery. Retain driver warnings and every failure.
5. Compare compiled physical Worker hashes to published version10; package and privately publish only after acceptance. No fresh FPS, hosted-performance, commercial-game parity or complete original-spec claim follows from these functional checks.

The existing root candidate directory `orbital-foundry-next-v10` is the version11 integration container. Its physical/product baseline matched published version10 before importing this feature. A separately created v11 checkout is not the tested product and must not be confused with this candidate.
