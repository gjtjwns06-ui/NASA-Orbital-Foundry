# M03 command-network model proposal

Status: **concrete proposed constants and numerical acceptance gates; not implemented, selected as a released model, or tested.** Prepared 2026-11-15. This document supplements [the agreed Phase A contract](m03-operations-phase-a-contract.md); it does not modify that contract or the released hardware catalogue.

Only primary sources and existing authored game inputs are used below. Closed-form examples were calculated independently of application code. No application tests, browser sessions, build or local performance run were executed for this document. The numerical integration policy remains a candidate until its stated gates pass; tolerances must not be relaxed after a failure to manufacture a pass.

## 1. Version boundary

Proposed identity: `omf-command-network-1.0.0`, used only by the new `transfer-3.0.0` operational runtime/save-envelope version 2. Publish an immutable configuration and its hash when its constants are accepted. There is no configuration hash yet.

Keep hardware-2.0.0 geometry, masses, existing downlink data and catalogue hash unchanged. The existing trajectory/ephemeris identity also remains unchanged. New receive-frequency antenna behavior, ground uplink, radio operating modes, command framing and acknowledgement transport belong to this network model.

The initial authored Mars lesson requires the connected, selected `iris22-carrier-v1` + `xband-reflector-1m-v1` chain. An unsupported or disconnected chain returns a structured compatibility issue. Do not silently substitute the legacy integrated radio or treat a UHF antenna as an X-band receiver.

## 2. Primary facts versus chosen model inputs

### Primary facts used

| Fact | Source locator and interpretation |
| --- | --- |
| Iris deep-space uplink 7.145–7.190 GHz; downlink 8.400–8.450 GHz | [JPL Iris V2.2 brochure](https://scienceandtechnology.jpl.nasa.gov/sites/default/files/documents/Brochure_Iris_Transponder_V2.2_SEP_2022.pdf), transponder specifications table. Channels require configuration. |
| Iris X-band noise figure 2.5 dB | Same brochure, receiver specifications. This is not a whole-spacecraft system noise temperature. |
| Iris carrier-tracking input range −70 to −147 dBm | Same table. This is **not** a command BER/demodulation threshold. |
| Iris RX-only 9.1 W, TX-only 25.0 W, simultaneous RX/TX 29.0 W at 12 V | Same brochure, operating-mode table. Keep the source's inconsistent prose/headline values separate. |
| 34 m X-band reference gain 66.98 dBi at 7.1675 GHz; representative transmitter feed loss 0.6 dB | [DSN 810-005 module 104 Rev. O](https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104O.pdf), Table 4, printed p.31. Peak-gain/elevation and polarization conditions apply. |
| Reference RF output 200 W–20 kW; representative maximum EIRP 139.4 dBm = 109.4 dBW | Same Table 4, printed p.32, listed 34 m stations with the 20 kW transmitter. This is a reference capability, not five actual service reservations. |
| AX100 is half-duplex | [GomSpace AX100 rev.3.7 datasheet](https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanocom-ax100.pdf), printed p.4; p.5 shows shared RX/TX switching. Also stated on the [manufacturer product page](https://gomspace.com/product/nanocom-ax100/). |

The Iris PDF direct web open failed in this research session, but the official URL's indexed tables returned the values above. DSN module 104 was accessible directly with page/line locators. AX100's direct fetch timed out; the official indexed PDF and product page independently confirmed half-duplex. No third-party mirror is used as evidence.

### Authored network and configuration

Reuse the five existing educational stations from `src/transfer/state.ts`:

| ID | Latitude, degrees | Longitude, degrees |
| --- | ---: | ---: |
| G1 | 35 | 75 |
| G2 | −35 | −60 |
| G3 | 35 | −140 |
| G4 | −25 | 130 |
| G5 | 30 | −15 |

These are **not actual DSN station identities**. Retain the existing approximate Earth rotation, elevation floor 5°, and 3° solar-exclusion policy as authored game assumptions. Do not claim real scheduling, weather, spectrum authorization, UT1/EOP precision or service availability.

| Proposed constant | Value | Provenance / reason |
| --- | ---: | --- |
| `uplinkFrequencyHz` | 7,167,500,000 | Chosen center of the source deep-space allocation |
| `maximumGroundEirpDbW` | 109.4 | Adopted rounded source capability |
| `minimumGroundEirpDbW` | 89.4 | Same adopted antenna/feed and the source 20 dB transmitter-output range |
| `targetReceiverPowerDbm` | −100 | Authored bounded ground power-control target, not Iris auto-gain behavior |
| `propagationAndPolarizationLossDb` | 3 | Authored lumped loss, excludes receiver feed loss and modeled pointing/obstruction loss |
| `receiveDishDiameterM` | 1 | Existing authored reflector aperture |
| `receiveApertureEfficiency` | 0.55 | Existing authored aperture efficiency |
| `receiverNoiseFigureDb` | 2.5 | Iris source value |
| `antennaNoiseTemperatureK` | 100 | Authored effective sky/spillover input; no real antenna thermal analysis |
| `receiverFeedLossDb` | 1 | Authored loss ahead of receiver |
| `receiverFeedPhysicalTemperatureK` | 290 | Authored feed temperature |
| `noiseFigureReferenceTemperatureK` | 290 | Conventional noise-factor reference |
| `negativeBoltzmannDb` | 228.6 | Rounded dBW/K/Hz constant, consistent with current link arithmetic |
| `uplinkInformationRateBps` | 256 | Authored fixed command information rate |
| `uplinkCodedSymbolRate` | 512 symbols/s | Authored binary, two coded symbols per information bit accounting |
| `requiredInformationEbNoDb` | 6 | Authored deterministic decoding budget; not a vendor BER curve or implemented FEC decoder |
| `requiredMarginDb` | 3 | Authored reserve above the decoding budget |

The fixed command rate deliberately makes frame duration predictable. There is no stochastic bit-error draw and no claimed delivery probability. A command is accepted only when every modeled receiving interval meets the gates. Carrier tracking and command demodulation remain separate tests.

Independent 8.4 GHz downlink is retained for ACKs. Do not claim a coherent turnaround frequency ratio merely because the source transponder supports one.

## 3. Gain, noise and link equations

Use SI in RF equations and km/s only in the trajectory/light-time layer:

```
c = 299792458 m/s
lambda = c / uplinkFrequencyHz
G_rx_peak_dBi = 10 log10(0.55 * (pi * 1 m / lambda)^2)
              = 34.917564322637 dBi

theta_half_uplink = 1.25 deg * 8.4 GHz / 7.1675 GHz
                  = 1.464945936519 deg
pointingLossDb = min(120, 3 * (offAxisDeg/theta_half_uplink)^2)
```

The same-aperture frequency scaling is a new authored receive model. Do not reuse the 8.4 GHz gain unchanged. The 1.25° input is the existing game's one-sided half-power angle, not the DSN table's two-sided beamwidth. Reuse actual mounted boresight, five-aperture origins and obstruction geometry. Require at least 3 of 5 aperture samples clear; additionally apply `10 log10(clearFraction)` to effective gain. This fraction is an educational aperture proxy, not electromagnetic diffraction/CAD certification.

The conventional relation `T_e = T_0 (10^(NF/10) − 1)` is supported by [NASA's receiver noise treatment, equations 5–6](https://ntrs.nasa.gov/api/citations/19690013449/downloads/19690013449.pdf). With a lossy warm feed, refer the entire noise budget to the antenna terminals:

```
F = 10^(2.5/10)
T_e = 290*(F-1) = 225.701028911288 K
L = 10^(1/10)
T_system_at_antenna = 100 + (L-1)*290 + L*T_e
                    = 459.229130184819 K

FSPL_dB = 20 log10(4*pi*range_m*f_Hz/c)
P_antenna_dBW = EIRP_dBW + G_rx_peak_dBi - pointingLossDb
                + 10 log10(clearFraction) - FSPL_dB - 3
CNo_dBHz = P_antenna_dBW + 228.6 - 10 log10(T_system_at_antenna)
margin_dB = CNo_dBHz - 10 log10(256) - 6

P_receiver_dBm = P_antenna_dBW - 1 + 30
```

Receive requires `margin_dB >= 3` **and** `−147 <= P_receiver_dBm <= −70`, alongside geometry, power and mode gates. The tracking interval is a supported-model condition, not proof of BER performance or a hardware damage threshold.

**Do not subtract the 1 dB receive-feed loss again in C/No:** it is already represented in the antenna-referred noise temperature. Subtract it only when converting antenna-terminal signal power to the input reference used for the tracking-level check.

## 4. Bounded ground transmit power

At the start of a frame, use predicted geometry and aligned receive gain to choose:

```
requestedEirpDbW = -130 + FSPL_dB + 3 + 1 - G_rx_peak_dBi
frameEirpDbW = clamp(requestedEirpDbW, 89.4, 109.4)
```

The `−130 dBW` target is `−100 dBm`. EIRP already includes transmitter/feed/ground-antenna effects; do not subtract the DSN 0.6 dB again. The source unrounded nominal calculation, `10log10(20000)+66.98−0.6`, is 109.390299956640 dBW; use the pinned rounded 109.4 dBW consistently.

Hold power and information rate fixed for the frame. Ground emission eligibility uses station visibility, source availability and predicted aligned link/level bounds. It must not look into the authoritative spacecraft's future attitude to avoid a failed command magically. A preview may warn that reception is outside a ground-known listening opportunity; label it an estimate.

At extremely short range, even the minimum supported transmitter output can exceed the supported receive level. Report `RX_LEVEL_OUTSIDE_MODEL` / an explicit queued incompatibility reason; do not invent lower transmitter capability, silently ignore overload or turn the spacecraft to attenuate the signal. The near-Mars lesson avoids this case, but the general queue still validates it.

Choose the available station with the highest predicted emission elevation; break ties by station ID. Lock that station for the entire emitted frame. No invisible mid-frame station handover. One station transmits one command frame at a time; the ground queue is FIFO by sequence, with expired/cancelled entries skipped.

## 5. Finite command and ACK frames

| Item | Proposed limit/rule |
| --- | --- |
| Command payload | Maximum 8,192 UTF-8 bytes after canonical encoding |
| Command framing | 64 information bytes for authored acquisition/header/checksum accounting |
| Frame duration | `8*(payloadBytes+64)/256` seconds; maximum **258 s** |
| Coding accounting | Two coded binary symbols per information bit at 512 symbols/s; do not multiply the duration by two a second time |
| Command counts | 128 unique commands, 256 total journal actions per mission |
| Commands in a frame | One complete immutable command; no partial schedule application |
| ACK | Fixed padded 512 application bytes, including compact IDs/hash/status/revision/time; reject an encoding exceeding the bound |
| ACK bandwidth | 4,096 bits taken from the existing downlink **payload** budget; do not apply the existing 80% payload factor again |
| Retry | Explicit player retry of the same immutable command ID, bytes and expiry; new action ID/sequence |
| Automatic retransmission | None in the first slice. A pending ACK waits for a usable downlink opportunity; an interrupted emitted ACK consumes airtime and requires a command retry for another ACK |

Canonical command encoding uses sorted object keys, preserved array order and UTF-8 byte length, not JavaScript string length. Reject nonfinite numbers, unknown fields and conflicting ID reuse. Normalize negative zero to zero in command numeric inputs before encoding; retain exact authoritative input times in the journal. The payload hash covers the immutable command envelope, including ID and expiry. A retry does not silently extend its validity.

The authored framing/code budget is not a claim that the game implements a flight CCSDS stack, CRC protection or a bit-level FEC decoder. Physics/geometry gates decide complete delivery deterministically.

ACK fields include command ID, payload hash, accepted/rejected status, onboard revision, installation/decision time and installed-schedule hash. Do not put an entire 40-operation schedule inside a nominal 512-byte ACK. Ground reconstruction uses its own submitted payload and known revision chain; if that chain is incomplete, display incomplete confirmation rather than filling it from omniscient state. A delayed duplicate ACK must not downgrade the last confirmed revision.

ACKs are prioritized over science within available payload throughput. A full frame must finish before its receipt can confirm anything. For an emitted frame, keep the chosen station and payload rate fixed; if the required mode/margin fails during transmission, abort the frame without refunding already-used bandwidth. No fractional acceptance. ACK transmission never commands an automatic attitude change: it uses an existing downlink operation and actual orientation.

Initial proposed queue expiry is `min(replaceFromSeconds, issuedAt+21600, missionEnd)`, with a user-selected finite expiry allowed up to `min(issuedAt+86400, missionEnd)`. The schedule's own replacement deadline still applies. An identical retry of an already-installed command is recognized before new-installation expiry/revision checks and can return its cached installation ACK; a never-installed expired command cannot execute.

Use `TX_end + 2*estimatedLightTime_at_TX + 600 s` only as an authored **ground attention timeout**, not evidence of receiver failure. Missing or delayed ACK is “unconfirmed”. There is no automatic claim that the spacecraft obeyed or ignored the command.

## 6. Moving endpoints and interval validity

For each emitted endpoint/chunk boundary, solve in ICRF with elapsed TDB seconds:

```
t_r - t_e = |r_spacecraft(t_r) - r_station(t_e)| / 299792.458
```

Start with instantaneous range/c and iterate to a residual <=1e-6 s, with a bounded 12-iteration limit. A nonconvergent or out-of-ephemeris result is an explicit failure. Do not clamp an arrival after mission end to mission end. The fixed-point contraction is small because modeled endpoint velocities are much less than light speed.

For the ACK, keep the emitted spacecraft position fixed and solve for the future receiving station position. Solve the first and last emitted boundaries separately. A moving receiver changes reception duration slightly; do not assume the last bit arrives exactly one transmission duration after the first. Doppler compensation/carrier acquisition is assumed within the supported tracking model; neither real frequency ramp generation nor a receiver PLL is simulated.

Evaluate receive pointing from the **actual** attitude quaternion and the retarded emitting-station direction. Current Earth-center direction, a future ACK station direction, or requested attitude is not a substitute. Receive power must exist for the interval. Existing safety mode turns the receiver off; a command cannot rescue an already radio-off state without autonomous recovery first.

Emission elevation is checked at each emission slice, not only at frame start. Earth visibility uses the actual station surface normal and the direction to the future spacecraft endpoint. Solar exclusion and planetary occultation are checked throughout the signal's modeled emission/reception intervals.

For moving-body occultation, do not evaluate Mars only at the ground emission epoch, thousands of seconds before the photon reaches it. Prefer a segment/world-line minimum-distance check using the photon line and ephemeris body position at the corresponding photon time. Sun position is fixed in the model; the emitting/receiving station's own Earth endpoint is handled by the elevation test, not falsely counted as an interior Earth collision. A conservative static-body shortcut is acceptable only if its spatial guard and error bound are explicit and independently checked against the moving-body calculation.

## 7. Proposed numerical/event policy and accuracy gates

This is **a candidate for version 3**, not a change to released engines and not a performance claim.

| Situation | Proposed maximum integration interval |
| --- | ---: |
| Actual command/ACK emission or reception; actual ADCS slew | 1 s |
| Near encounter | 5 s, using the existing +/-9,000 s encounter region |
| Downlink outside those cases | 60 s |
| Quiet cruise | Configured 300 or 600 s |

Split exactly at known emission completion, first/last reception, frame completion, schedule boundary, mission deadline and EPS threshold events. Grid boundaries are anchored to mission time, not UI request size. Idle queue entries must not force 1-second stepping over months of cruise. Start a queued emission on a canonical eligible ground opportunity; future receiver attitude is not an eligibility oracle.

For slews use the **actual version-3 hardware torque/inertia/momentum controller and its current angular rate**. Do not retain the old `angle / 20 deg/s` shortcut or an unexplained one-second clamp derived from the legacy controller. Refine at actual settling and mode boundaries. Whether this improves cost must be measured later, separately from correctness.

For an active receiving interval, endpoint-only validity is forbidden. Evaluate start/mid/end, all known mode/power boundaries and the entire sequence of intervals. Use bounded geometry/margin checks to certify that an interval cannot cross a gate. Near a pointing, elevation, occultation or self-obstruction boundary, subdivide the link check down to 0.01 s. A bounded check that remains unresolved is conservatively **invalid**, not presumed clear. A narrow dropout between the coarse endpoints must therefore fail the frame.

Angular variation bounds must derive from installed hardware maximum rate/current rate and line-of-sight motion. Self-obstruction checks can conservatively bound the changing ray cone against expanded proxy boxes; an endpoint sample alone is not a bound. The five spatial aperture samples remain a separate disclosed approximation. Do not describe this as continuous electromagnetic certification.

Predeclared acceptance gates:

- Same numerical profile, identical journal: exact command/state/packet/event equality under long warp versus small requests and under save replay, modulo explicitly nonphysical save timestamps. Public telemetry/preview calls cannot affect the partition.
- Closed-form light-time residual <=1e-6 s and closed-form link arithmetic error <=1e-9 in the stated units for unit fixtures. These do not require a full orbital run.
- Candidate active step 1 s versus independent 0.5 s and 0.25 s reference profiles: identical install/reject/cancel/receive outcomes and unique science count; command/ACK event times within 0.05 s; actual attitude within 0.05 degrees during communication; active link margin within 0.1 dB. Both angle and margin gates apply because a narrow beam magnifies angle error.
- Standard authored lesson, 300 versus 600 s quiet cruise: identical command decisions, packet identities and final status; minimum and final battery energy each within **0.10 Wh**; event time difference <=0.05 s for root-located command/ACK boundaries. This is a proposed acceptance bound, not an observed result.
- The radio energy bound is meaningful: one second at 90 W is 0.025 Wh before conversion losses, so a 0.10 Wh budget does not excuse minutes of missed RX/TX or safety-mode load. Refine numerical handling if this gate fails rather than increasing it after the fact.
- For deliberately grazing cases near classification limits, require conservative rejection or consistent acceptance with an explicit geometric certificate. Do not rely on an accidental floating-point sign or let a fragile training fixture decide the product demonstration.
- Protocol bit ledgers conserve all emitted/consumed bits. A payload rate rounded for display must never be used in accounting. No bandwidth is refunded after an interrupted frame.

The independent reviewer should approve the frozen numerical profile before production acceptance testing. If 1 s is not accurate enough for a legitimate high-rate hardware configuration, reduce the active interval or improve event localization; do not claim that a legacy hard-coded angular rate supplies the bound.

## 8. Schedule replacement edge rules

The initial UI edits only blocks that are wholly in the future. Choose the replacement boundary as the earliest affected old/new block start, then validate against the current onboard schedule at actual reception.

- Every replacement operation starts at or after `replaceFromSeconds`.
- Preserve previous entries ending at or before the boundary, with their original IDs.
- Reject a boundary cutting through an existing operation. The first slice does not invent truncation semantics or duplicate IDs for a split block.
- Reject IDs that collide with the retained prefix, even if the proposed future list itself has unique IDs.
- Require complete reception **strictly before** the replacement boundary for a new installation. At exact equality, reject as late; this simple conservative rule avoids dependence on same-time loop ordering. An already-installed duplicate remains an idempotent ACK case.
- At expiry equality, a new installation is also expired. Do not add a floating-point grace period that permits retroactive operation. Compare canonical elapsed times under the pinned solver contract.
- `baseRevision` is checked against actual onboard revision on receipt. The UI takes its value from ground-confirmed knowledge, never silently from `onboardTruth`.
- Preserve initial solution/plan, past operations, in-progress acquisition history and already-created packets. Installing a future revision must not restart an observation or return previously spent power.

These are proposed concrete resolutions of the edge cases left open by the higher-level contract; they require domain/UI agreement before implementation is frozen.

## 9. Analytical test vectors (expected values, not executed tests)

### A. Link arithmetic and bounded power

All rows use clear aperture, zero pointing offset and the constants above. These independently calculated values are suitable unit-test oracles.

| Range, km | Selected EIRP, dBW | Receiver input, dBm | C/No, dB-Hz | Margin above 6 dB budget, dB | Tracking range |
| ---: | ---: | ---: | ---: | ---: | --- |
| 300,000 | 89.4 | −68.7799980260 | 104.1997076862 | 74.1173080331 | Fail: too strong despite ample decoding margin |
| 1,000,000 | 89.4 | −79.2375729316 | 93.7421327806 | 63.6597331275 | Pass |
| 55,000,000 | 103.4448267215 | −100.0000000000 | 72.9797057123 | 42.8973060591 | Pass |
| 150,000,000 | 109.4 | −102.7593981127 | 70.2203075995 | 40.1379079464 | Pass |
| 300,000,000 | 109.4 | −108.7799980260 | 64.1997076862 | 34.1173080331 | Pass |
| 400,000,000 | 109.4 | −111.2787727582 | 61.7009329541 | 31.6185333010 | Pass |

Margin must still be >=3 dB. At one receive half-power angle, gain falls by exactly 3 dB. At 300 million km, the unoccluded angular margin boundary is approximately 4.7180439222 degrees; values on either side should exercise the gate. Do not equate half-power beamwidth with a hard receive cone. A 1 dB feed double-subtraction or dBm/dBW error will break these vectors.

### B. Moving receiver and finite transmission

- Fixed 300,000,000 km range: one-way delay **1000.692285594456 s**.
- Station fixed at x=0; receiver `x(t)=300000000 + 30*t` km; emission t=0: `t_r=D/(c−30)` = **1000.792434121287 s**.
- Same receiver approaching at 30 km/s: `t_r=D/(c+30)` = **1000.592157109192 s**.
- A 1,024-byte payload plus 64-byte framing lasts **34 s** at 256 information bit/s. In the receding case its first-to-last reception duration is **34.003402694276 s**, not 34 s.
- An 8,192-byte payload lasts **258 s**. An 8,193-byte payload is rejected before emission. The UTF-8 text `관측` occupies 6 bytes, not 2.

Use the analytic constant-velocity fixtures for independent oracles; separately check real ephemeris endpoints against the residual equation. Do not substitute analytic fixtures for full mission acceptance.

### C. ACK accounting and power

- A 512-byte ACK is 4,096 payload bits. At 409.6, 1,638.4 and 26,214.4 payload bit/s its airtime is respectively **10 s**, **2.5 s**, and **0.15625 s**, before propagation.
- In a 20-second valid interval at 409.6 payload bit/s with one ACK pending, total budget is 8,192 bits: 4,096 ACK + at most 4,096 science. No second 80% reduction and no science-before-readout leakage.
- A 300-second RX-only radio interval uses **0.758333333333 Wh at the radio input**; simultaneous RX/TX uses **2.416666666667 Wh**. Bus conversion and battery discharge losses are additional, applied once. A radio-only no-solar fixture with bus efficiency 0.9 and battery discharge efficiency 0.95 uses `radioWh/(0.9*0.95)`.
- A safe-mode radio-off fixture cannot receive or emit an ACK, regardless of geometric margin. AX100 TX-active likewise has no simultaneous receive path.

### D. Causality, interruption and revision vectors

1. Hold valid conditions at the first and last reception samples but introduce a 0.5-second pointing/occlusion interruption between coarse integration endpoints: reject the entire command and leave the schedule unchanged. Add a narrower guarded boundary case to exercise unresolved→invalid handling.
2. Keep requested attitude Earth-pointed while actual quaternion is still slewing: validity follows actual quaternion. Repeat with an EPS/safe-mode boundary during reception.
3. Receive a new command 1 ms before the replacement boundary, exactly on it, and 1 ms after it: early may install; equality and late must reject. Use adequately separated times relative to the <=1 microsecond light-time solver contract.
4. Existing operation `[100,200)` and cut 150: reject. Cut 200 with new entries starting >=200: preserve the old entry; reject a reused retained ID. A future block whose original start and new start differ uses the earlier affected start for the UI cut.
5. First reception installs revision 1; identical command retry returns an ACK without creating revision 2. Same ID/different payload fails. A separate command based on revision 0 is rejected after revision 1 is installed.
6. Drop an ACK after actual installation: onboard truth changes, Earth remains unconfirmed. A later duplicate ACK cannot roll back an already confirmed newer revision. None of these states imply completion of future observations.
7. Pause with an unsent queue item and cancel it: no RF frame or onboard effect. Cancel after first emission: reject cancellation, preserve the in-flight signal. An emitted signal never waits for a later attitude opportunity.
8. Serialize/replay before TX, mid-TX, mid-propagation, after install/before ACK and after ACK. Compare all physical and protocol ledgers, then corrupt each relevant ID/time/revision/hash/outcome to ensure rejection without replacing the current flight.

## 10. Known limits and implementation handoff

This proposal adds no real DSN bookings, weather/plasma prediction, antenna electromagnetics, noisy navigation, oscillator drift, receiver acquisition software or bit-level coding implementation. Published radio figures remain tied to their stated conditions. Educational stations, network availability, loss budget, decoding threshold, framing and numerical guards are explicit authored assumptions.

Domain owner: freeze the constants and codec, implement transport/receiver/world-line and event semantics in the new versioned modules, and report any unsupported condition explicitly. Root: use the ground/truth separation and UI message contract without reading unacknowledged truth into command cards. Rendering owner: visualize only recorded frame progress and label display time scaling. Independent reviewer: verify the analytical oracles and causality/save cases, then judge the predeclared convergence gates before any performance claim or merge.

No changes to the agreed Phase A contract, production catalogue or application source are made by this document.
