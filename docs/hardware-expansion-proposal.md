# Hardware expansion proposal — two buses, sixteen meaningful models

Status: **proposal only; no production implementation in this iteration**. Researched 2026-11-15. Current released calculations remain `sim 1.3.0` and `transfer-1.0.0`.

## Recommended decision

Add **two selectable authored spacecraft buses and sixteen active hardware models**, with power/data/RF connections that affect what the spacecraft can actually do. Keep the existing bus and nine legacy kinds available to historical saves. Do not rename the current nine cards into sixteen near-identical variants.

The first useful playable slice is a small LEO bus with a low-power UHF radio versus a larger expedition bus with an Iris-based X-band radio and high-gain reflector. Mounting a radio must consume a real power rail, obtain a compatible data path, and connect to a matching antenna. Wrong combinations remain visible in the hangar with precise reasons; they never silently become the existing universal X-band radio.

The original specification explicitly treats the count as a content target, says not to invent factual specifications to fill empty records, and requires automatic compatible power/data connections in ASM06. The proposal therefore distinguishes measured/published values, calculations from those values, and authored game parameters **per field**, not just per card. [Original specification](reference-functional-spec-v1.1.md)

## 1. Primary-source findings and constraints

NASA's current SoA landing page identifies the **2026 edition**, published May 2026. Its electrical-power, avionics, GNC and communications chapters provide integration context, rather than proof that arbitrary listed products work together. A processor connector or protocol name alone does not establish an interoperable flight stack. [NASA 2026 SoA](https://www.nasa.gov/smallsat-institute/sst-soa/), [avionics chapter](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics/), [power chapter](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/)

| Source / identified configuration | Useful verified fields | Boundaries for the game |
|---|---|---|
| GomSpace TSP-45W, DS1038993 rev3.3, 2024-05-24 | Total mass 0.885 kg; up to45 W per complete array/wing, BOL at1367 W/m²; three panels. Datasheet table: loaded7/8-cell strings15.82/18.08 V, open circuit18.20/20.80 V. 5 V release option650 mA per release controller. | A photovoltaic source feeds an MPPT input, not a regulated5 V load port. 0.650 kg is the deployed portion, **not** mass after deployment. Use a fixed deployed wing initially; tracking motor consumption is not verified here. [Datasheet §§2,4,5,7](https://gomspace.com/wp-content/uploads/2025/09/Datasheet-NanoPower-TSP_45W.pdf) |
| GomSpace BPX100 Wh, 4S-2P, DS1076870 rev1.1.0, 2026-04-21 | Existing verified source record:0.500 kg; nominal100 Wh/14.4 V; headline recommended86 Wh;93×86×41 mm. | The document also reports condition-dependent87/89 Wh; preserve the selected86 Wh policy and discrepancy. Do not equate the connector's current rating with all cell/EPS discharge limits. This research pass hit repeated PDF timeouts; use the previously verified exact revision, then archive/hash before new release. [Existing record](../public/data/component-sources.json), [manufacturer PDF](https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanopower-BPX-100-Wh-1076870-1.1.0.pdf) |
| GomSpace AX100U, DS1013823 rev3.7, 2019-11-29 | Radio board0.0245 kg,65×40×6.5 mm.3.3 V typical. RX55 mA→0.1815 W; TX800 mA at25°C→2.64 W. RF30 dBm→1 W. I²C/UART/CAN with CSP. Signal capability38,400 bit/s;25 kHz mode maximum19,200 bit/s. | Add board carrier, harness and antenna separately. Net science bits/s is below coded signal rate. A flyer advertises115.2 kbit/s; this proposal pins the identified datasheet's38.4 kbit/s configuration instead. Do not import the NASA table's inconsistent dimension row. [Datasheet §§2,7,8](https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanocom-ax100.pdf), [product page](https://gomspace.com/product/nanocom-ax100/) |
| JPL IrisV2.2, September2022 brochure | Stack0.875 kg excluding cables, SSPA0.150 kg, LNA0.080 kg:1.105 kg assembled electronics.9–28 V table supply range; SPI/SpaceWire. X-band uplink7.145–7.235 GHz across specified deep/near-Earth ranges; downlink8.400–8.500 GHz. | Revision-specific source has internal inconsistencies: headline35 W/3.8 W RF, prose34 W/10.3 W RX, and12 V table RX9.1/TX25/TX+RX29 W. Proposed game uses table modes at regulated12 V and reserves35 W at the port; RF cap3.8 W is explicitly conservative. Do not mix with IrisV2.1/V3. [JPL brochure](https://scienceandtechnology.jpl.nasa.gov/sites/default/files/documents/Brochure_Iris_Transponder_V2.2_SEP_2022.pdf) |
| Blue Canyon XACT-15 / XACT-50, ADCS rev1/2026 | Mass0.89/1.23 kg; envelopes100×100×50 /100×100×75.4 mm;12 V; RS-422. Published storage15/50 mN·m·s per axis and torque5/6 mN·m respectively. | Manufacturer slew examples use4 kg3U /14 kg6U vehicles. Applying10°/s to our metre-scale35 kg bus would be unsupported. DC mode power and exact proprietary control protocol are not published in this short sheet; keep them authored/unknown until sourced. [2026 datasheet](https://www.bluecanyontech.com/wp-content/uploads/ADCS-2026.pdf), [manufacturer page](https://www.bluecanyontech.com/spacecraft-subsystems/xact/) |
| ISISPACE iMTQ, historical V2R brochure; NASA2026 GNC table |0.196 kg;5 V; idle0.175 W/full actuation<1.2 W;0.2 A·m²; I²C. | Reference-only in the first16. It is **not** a stand-alone precision3-axis or deep-space pointing solution. The manufacturer URL currently fails a fresh fetch although indexed content remains; NASA table corroborates mass/power. [Historical brochure](https://www.isispace.nl/wp-content/uploads/2019/08/ISIS-IMTQ-Magnetorquer-Board-Brochure-V2R-web.pdf), [NASA GNC](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/) |

Source inconsistencies must remain visible in the evidence records. In particular, the NASA communications Iris row appears to label7145–7235 as GHz; use the identified JPL GHz ranges above rather than silently treating the table as correct. A current vendor page is not a product qualification report. [NASA communications](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/)

CubeADCS documentation independently illustrates why power/data compatibility needs multiple fields: its standard configuration needs3.3 V,5 V and battery rails, with optional local conversion, and host interfaces depend on the ordered configuration. It also says actuator sizing depends on spacecraft size and deployables. This proposal does not treat a generic “CubeADCS” name as one mass/power value. [CubeSpace PD rev1.03 §§3.1,3.3](https://www.cubespace.co.za/uploads/a55e9627-9377-496b-800e-ecde36e3b21e.pdf)

## 2. Two selectable buses

These are **original game bus profiles**, not NASA/vendor products, not CubeSat-certified structures, and not substitutes for an actual spacecraft ICD. All figures in this table are starting balance parameters to be validated, not existing successful presets.

| Property | `surveyor-l18-v1` — LEO Surveyor | `pathfinder-d35-v1` — Expedition |
|---|---|---|
| Body dimensions X/Y/Z |1.30×1.60×1.30 m initially; smaller usable bay and visible internal arrangement |1.30×1.60×1.30 m |
| Dry bus mass / game cost |18 kg /90 C |35 kg /120 C |
| Included base load |8 W |14 W |
| Included storage |256 Mbit housekeeping/science buffer |256 Mbit housekeeping/science buffer |
| Included rechargeable battery |None; at least one battery module required |None; at least one battery module required |
| Included propellant tank |4 kg mono-propellant capacity; fill represented explicitly |6 kg mono-propellant capacity; fill represented explicitly |
| Power distribution |3.3 V±2%:10 W;5 V±5%:25 W;12 V±5%:15 W; total70 W |3.3 V±2%:15 W;5 V±5%:40 W;12 V±5%:90 W; total150 W |
| Solar input |2 independent wing MPPT groups, each60 W; total120 W |12 wing MPPT groups, each60 W; total360 W |
| Battery/EPS policy |Total charge40 W, discharge70 W; per-pack limit still applies |Total charge80 W, discharge150 W; per-pack limit still applies |
| Data fabric |CSP over CAN1 Mbit/s; SPI10 Mbit/s; RS-422 ADCS port;4 switchable load slots |CSP/CAN; SPI10 Mbit/s; SpaceWire50 Mbit/s effective payload fabric; RS-422 ADCS port;8 switchable load slots |
| Integration drivers supplied |Authored AX100, wide camera, recorder, ADCS driver profiles |Same plus authored Iris, precision camera, spectrometer profiles |
| Tradeoff |Less bus mass, idle load and cost; limited high-power rails and high-rate payload transport |More internal room, EPS and data throughput; greater launch mass, idle drain, cost and inertia |

`legacy-35-v1` is an archival compatibility profile with **exact current constants**:35 kg,120 C,90 Wh,256 Mbit,18 W,6 kg,230 s,45/60 W EPS, current geometry and20°/s attitude policy. It is not one of the two new bus choices and never gains new compatibility rules while replaying an old flight.

The LEO bus is not prohibited from Mars merely by mission ID. A complete design fails on specific missing interfaces, power limits, RF range or science capability. Conversely, the expedition bus can fly a LEO mission, but its weight and budget can make it inferior. This avoids an artificial “Mars pass” bonus.

For the first release both profiles deliberately share the existing external envelope. Distinguish them through internal compartment capacity, mounting surfaces, panel treatment and labels. A physically smaller0.90×1.10×0.90 m Surveyor is a later geometry change only after all mount, ray, stow, scene and camera helpers accept the bus profile. Do not scale the current Three.js bus while leaving physics at its original dimensions.

## 3. Sixteen active hardware choices

`P` = published value for the named revision; `D` = arithmetic/assembly derived; `A` = authored game parameter. **All C prices are A; real USD prices remain null.** Dimensions of game mounts/enclosures must be explicit A values even where a board inside has P dimensions. Radio cards and antenna cards are separate objects.

| # / immutable model ID | Geometry kind / proposed physical model | Concrete gameplay choice |
|---|---|---|
|1 `tsp45-fixed-v2` |`solar`:P0.885 kg,45 W at1 AU; fixed deployed wing. Retain actual three-panel construction; separate A mounting adapter. |Cheap/small enough for the Surveyor MPPT budget. Cell incidence and each panel's shadow reduce actual output. No free tracking. |
|2 `tsp45-sixwing-v2` |`solarLarge`:D6×0.885+0.40=5.71 kg,270 W; six independently shaded wings; A shared bracket. |Needs six MPPT groups and a larger folded envelope. Higher raw power can be curtailed by EPS or charge limits. |
|3 `bpx100-4s2p-v2` |`battery`:P0.50 kg,100 Wh nominal; selected86 Wh usable. A25/60 W pack charge/discharge policy. |One compact pack reduces night/peak-operation interruptions. Correct battery rail/charger profile is required. |
|4 `bpx100-dual-v2` |`battery`:D2×0.50+0.10=1.10 kg,172 Wh usable; two identical4S packs with an authored isolation/controller assembly. |More endurance and50/120 W pack limits; still capped by bus EPS. It is not a direct uncontrolled parallel connection or a vendor SKU. |
|5 `wide-mono-v2` |`camera`:A1.6 kg,1 W idle/18 W capture,5 V, SPI;1024²×10-bit frame,6° full field. |Larger ground footprint, lower resolution,10.49 Mbit uncompressed frames. A feasible UHF mission must budget real capture/write/downlink time. |
|6 `narrow-mono-v2` |`camera`:A3.2 kg,2/42 W,12 V, SpaceWire;4096²×12-bit frame,2° full field. |Fine ground sampling and201.33 Mbit frames; tighter pointing and much more storage/downlink time. No arbitrary science-score multiplier. |
|7 `mars-spectra-v2` |`spectrometer`:A4.6 kg,3/56 W,12 V, SpaceWire; existing24 Mbit observation product with explicit acquisition time. |Science specific to spectral objectives, daylight and field of view. A camera does not satisfy a spectral objective. |
|8 `ax100u-carrier-v1` |New `radio`:P0.0245 kg board plus A0.075 kg carrier/harness; P/D RX0.1815 W, TX2.64 W typical;3.3 V; CSP/CAN. |Low power/weight UHF. Requires a UHF antenna; slow science delivery. Rated signal mode is capped before frame/coding overhead. |
|9 `iris22-carrier-v1` |New `radio`:D1.105 kg electronics plus A0.12 kg carrier/harness;12 V selected mode; SPI/SpaceWire selected integration profile. |Deep-space X-band with explicit RX/TX modes, higher DC load and a narrow-beam antenna requirement. Reserve35 W, use the pinned mode table. |
|10 `uhf-dipole-pair-v1` |`antenna`:A0.20 kg crossed deployable dipoles; matched435 MHz educational profile; no DC continuous load. |Broad coverage/low gain; actual dipole nulls, selection and polarization loss. A passive antenna alone cannot send data. |
|11 `xband-reflector-1m-v1` |`antenna`:A1.10 kg reflector/bracket,1 m aperture;η=0.55 aperture efficiency. |Gain derived from `η(πD/λ)²` (about36.3 dBi at8.4 GHz), beam pattern and pointing loss. Larger folded shape and obstruction; cannot serve the UHF radio. |
|12 `xact15-carrier-v1` |New `adcs`:P0.89 kg plus A mount;12 V/RS-422. P15 mNms/axis,5 mNm torque. A3 W hold/6 W slew until DC source is obtained. |Lower mass/cost, smaller momentum capacity; on larger-inertia spacecraft turns take longer. Exact vendor performance is not asserted. |
|13 `xact50-carrier-v1` |New `adcs`:P1.23 kg plus A mount;12 V/RS-422. P50 mNms/axis,6 mNm torque. A4 W hold/8 W slew. |More momentum capacity for large panels and heavier instruments. Additional power and space; still cannot rotate instantly. |
|14 `chemical230-v2` |`engine`:A2.8 kg,230 s Isp,4 W valve actuation; integrated with matching bus tank/propellant class. |Thrust line/CG and actual remaining fuel determine feasible impulses. Keep ideal instantaneous burn limitation explicit; do not introduce a low-thrust engine into the impulsive solver. |
|15 `recorder-1p6-v2` |`storage`:A0.9 kg,0.7 W,1.6 Gbit,SPI; explicit write/read cap. |Small, low-power buffer; useful for separated observation and ground passes. |
|16 `recorder-8-v2` |`storage`:A1.6 kg,1.8 W,8 Gbit,SpaceWire; explicit write/read cap. |More high-resolution products between contacts, at a mass/power/cost cost. Capacity does not automatically increase RF throughput. |

These are **16 data/model IDs, not16 new mesh families**. The legacy radiator remains in historical designs; it is not counted as a new meaningful choice while thermal behavior is unimplemented. It can return to the active catalogue when it has a real thermal consequence. No new electric/ion engine is proposed until finite burns exist. NASA's propulsion chapter makes the small-total-impulse/cold-gas versus power-demanding electric distinction clear; neither should inherit the current ideal chemical impulse for cosmetic variety. [NASA propulsion](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion/)

A plate-and-lens procedural mesh may share a family across two cameras, but it must have different body dimensions, aperture, folded bounds and optical field. A radio board lives inside the service bay while its antenna is placed outside. A source-qualified board is not enlarged physically just to be easier to click: use a visible carrier, selectable outline, magnified inspect view and label.

## 4. Runtime compatibility that makes the choices matter

### Automatic connection result

`resolveHardware(design, hardwareVersion)` returns a frozen resolved graph. `connectHardware(graph)` deterministically assigns compatible ports using stable part IDs, not array order. There are no user-drawn electrical wires in P0, but an optional overlay shows generated routes and the reason for a rejected connection.

Each model declares separate requirements for electrical load/source/battery, control data, science data, RF, mechanical mount and propulsion. Each bus declares **finite** rail power, total EPS limit, port capacity, fabric throughput, supported protocol adapters and internal volume. An unmatched protocol is not repaired by naming both connectors “SPI”.

Proposed problem codes: `POWER_VOLTAGE`, `POWER_PORT_LIMIT`, `POWER_TOTAL_LIMIT`, `SOLAR_INPUT_LIMIT`, `BATTERY_PROFILE`, `DATA_INTERFACE`, `DATA_PORT_CAPACITY`, `DATA_BANDWIDTH`, `RF_BAND`, `NO_RADIO`, `NO_ANTENNA`, `ADCS_MISSING`, `MOUNT_ENVELOPE`, `PROPELLANT_TYPE`. Each includes implicated part IDs, required/available values and a repair action. The launch review distinguishes a permanently incompatible connection from a feasible operation that must wait for power or contact.

### Power

Check output-rail tolerance against the component's permitted **operating** input interval. Absolute maximum ratings are not operating targets. Check peak/startup port demand and active-mode totals. Compute load-side DC power and conversion losses separately, then integrate Wh. The battery-bank limit is `min(busEPSLimit, sum(connectedPackLimits))`, not unlimited capacity-dependent power. Separate MPPT collection/curtailment from battery charging. Solar wing inputs use their two string classes; do not directly parallel unmatched7/8-cell strings.

For an authored profile, unknown manufacturer tolerances become explicitly labelled integration assumptions, not “verified compatible”. With the proposed Surveyor12 V port limit15 W, the35 W Iris reservation fails clearly even when total spacecraft power looks sufficient. The same radio can connect to Expedition12 V and the supported driver.

### Data

Build a control path to each powered device and a science path `instrument → recorder/OBC → radio`. Acquisition is not instantly converted into a stored completed packet if the chosen bus cannot carry it. Retain a finite instrument buffer, deliver bytes at the link/fabric/write bottleneck, and mark a frame complete only when all required bits arrive in storage. A full buffer suspends acquisition with an event; it does not create free science or erase an already captured frame silently.

At16–20 parts a small deterministic port-assignment search is sufficient; sort by fewest compatible endpoints then stable ID and backtrack where necessary. A greedy first match can incorrectly block a feasible combination. Shared-bus capacity is accounted per mode, while point-to-point ports are reserved per connected part. Reordering the parts array must not alter connections, resource history or score.

### RF

Resolve a selected compatible radio+antenna chain. Net rate is limited by all of: supported signal mode and coding/framing overhead, antenna frequency/pattern, instantaneous link budget, onboard read path and ground receiver mode. Keep RF watts and DC watts separate. Derive reflector gain from aperture and frequency; apply continuous pointing loss in addition to opaque ray obstruction.

Use separate authored UHF ground and X-band deep-space receiver profiles with disclosed gain/noise/coding assumptions. A38.4 kbit/s AX100 does not become524 kbit/s merely because the old `linkBudget` can return that rate, and an X-band dish cannot give an AX100 free X-band performance. For multiple installed radios P0 should use one explicitly selected chain per operation, rather than summing rates without independent ground resources.

### Attitude

Keep old20°/s exactly for legacy replay. New bus profiles estimate inertia from the resolved bus and part masses/positions, including deployed geometry. A bounded controller uses published torque/momentum as **inputs to an educational model**, with `α≈τ/I` and `ω≤H/I`; integrate angular velocity and quaternion with event-safe substeps. UI and power/ray calculations use that actual quaternion.

A complete free rigid-body, disturbance, wheel-desaturation or vendor flight-software simulation is not claimed. Published10°/s examples must not become a universal cap reached by every layout. The minimal release can use a transparently derived worst-axis trapezoidal slew profile; tests must establish that an extended heavy wing turns slower and misses a short observation window. If this model is postponed, postpone the two ADCS cards as active choices rather than offering fake accuracy bonuses. Magnetic-only control must never be presented as sufficient in interplanetary space; dependence on the external field is explicit in NASA's GNC discussion. [NASA GNC §5.2.3](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/)

## 5. Backward-compatible data contract

Preferred new schema is a versioned union, not new values accepted by an old strict parser:

```ts
type LegacyDesign = /* unchanged existing version: 1 */ unknown;
type HardwareDesign = {
  version: 2;
  hardwareVersion: 'hardware-2.0.0';
  busId: 'surveyor-l18-v1' | 'pathfinder-d35-v1';
  parts: Array<{
    id: string;
    modelId: string; // authoritative immutable catalogue key
    kind: HardwareKind; // validated against model, never overrides it
    face: Face; u: number; v: number; rotation: number;
  }>;
  // Existing mission/plan/name/seed fields, versioned operation extensions.
};
type HardwareKind = PartKind | 'radio' | 'adcs';

type ResolvedHardware = {
  version: string; bus: ResolvedBus;
  parts: readonly ResolvedPart[];
  connectionGraph: readonly Connection[];
  issues: readonly HardwareIssue[];
  // IDs/hash of pinned source/assumption records.
};
```

`Part.modelId?:string` can be a temporary TypeScript bridge for existing editor code, but it must not silently activate new rules inside a version1 save. A missing model ID in a legacy design resolves to an immutable `legacy:<kind>:1.3.0` descriptor. An unknown model ID or mismatched model/kind is rejected; there is no fallback to a superficially similar component.

Proposed helpers:

```ts
getBusDefinition(design, engineVersion)
getPartDefinition(design, part, engineVersion)
resolveHardware(design, engineVersion)
evaluateConnections(resolved, operationMode)
partTransformFor(design, part)       // bus-aware mount and bay floor
partGeometryFor(design, part)        // deployed/stowed OBBs + apertures
resolveRadioChain(design, selectedRadioId)
```

Source values are not stored as trusted numbers inside player saves. Resolve immutable IDs and pinned catalogue hash, re-solve/replay, then compare checkpoints exactly as now. Store per-field evidence `{sourceId, revision, locator, unit, condition, kind:'published'|'derived'|'assumed', formula?}` separately from UI translations. Archive source hashes before enabling a new hardware version. Never mutate a published catalogue row in place to follow a changed vendor page.

Implementation ownership: the domain agent owns `sim/hardware*.ts`, resolved interfaces, assembly/resource/attitude integration and both strict persistence paths; the renderer agent owns bus/part meshes, shared-descriptor consumption, inspection and actual-mesh bounds tests; root owns palette/bus selection, operations selection, undo/migration UX, worker routing and browser acceptance. Agree on `ResolvedHardware`, `GeometryProfile`, `HardwareIssue` and radio-chain selection before parallel edits. During the bridge, optional `Design.busId`/`hardwareVersion` and `Part.modelId` may minimize editor churn, with absence meaning exact legacy behavior; the save/model discriminator must still keep new hardware out of old replay rules.

### Preserve actual old runs

1. Freeze legacy constants/geometry and collect existing actual checkpoints before changing any resolver. The old1.3.0 and transfer1.0.0 replay paths retain their previous link budget, EPS arithmetic, geometry, attitude, packet sizes and fuel treatment.
2. Introduce model-version dispatch (`1.3.0` / new`2.0.0`, `transfer-1.0.0` / new`transfer-2.0.0`). Frozen legacy wrappers can share pure orbital math, but not mutable “latest hardware” defaults. Do not merely change `MODEL_VERSION` and reject all old saves.
3. Loading an old runtime resumes the old engine and shows its model label. Changing hardware creates a **new draft**, never rewrites an in-progress historical flight. Show a mass/power/placement/price diff before the player's upgrade action.
4. Upgrade a legacy draft by copying IDs/coordinates, preserving the original, then validating new geometry. Do not auto-resize, delete or relocate obstructing parts. A current single antenna assembly may expand into separate radio and antenna; show the added internal module and cost explicitly.
5. Use version-separated save slots and comparison histories; no M03 autosave may overwrite M01/M02, no new hardware draft may overwrite the only legacy runtime. JSON import/export retains original supported schema and engine version.
6. Catalogue data alone is insufficient for replay preservation: M03 imports `sim/assembly`, `sim/launch` and catalogue resources, so changing these shared functions without legacy context changes transfer1.0 checkpoints too.

## 6. Impact inventory from the current source

This inventory was produced by searching all `BUS`, `PARTS`, `PartKind`, geometry calls and implicit per-kind behavior in `src` and tests. It includes indirect hardcoded assumptions that a global search-and-replace misses.

| File / current access | Required change and risk |
|---|---|
| `src/sim/catalog.ts`, `types.ts`, `index.ts` |Current `PARTS:Record<PartKind,...>` binds geometry and identity; one constantBUS includes battery/fuel/avionics. Add versioned registries/resolvers; preserve exported legacy objects for old callers/tests. |
| `src/sim/assembly.ts` |Direct mass/power/counts; hardcoded six-face half sizes, bay bounds, opaque bus box, apertures, footprints and center of mass. New bus/model geometry must feed all of these. `maxCount` cannot count only kind when two model variants share a function. |
| `src/sim/launch.ts` |Mass/cost use globalBUS/PARTS; folded boxes accept kind; bus stowedOBB is fixed. Parameterize folded/deployed bounds and clearance from the same geometry descriptor used to render. Avoid circular registry→assembly→launch dependencies. |
| `src/sim/simulation.ts` |Initial fuel, mode power, universal X-band link, fuel Isp, score denominator and instrument/antenna count all assume legacy. Require a resolved powered/connected device, not merely `kind==='antenna'`. Replay version owns attitude and link policy. |
| `src/sim/physics.ts` |`availableDeltaV`/`fuelForDeltaV` default230 s. New engine call sites must pass resolved Isp; keep defaults for legacy compatibility. Orbital trajectories need no hardware-specific mutation. |
| `src/sim/attitude.ts` |Global20°/s imported in both engines. Retain constant for legacy; new runtime receives a resolved slew model. |
| `src/sim/targets.ts` |Current camera IFOV, packet sizes and science eligibility are task constants. New cameras require instrument-aware resolution/frame data; objective thresholds stay mission-defined. |
| `src/sim/persistence.ts` |Strict exact keys reject bus/model fields; version1 allows32 parts today. New version enforces original20-part cap and supported IDs; old32-part saves remain parseable. |
| `src/transfer/planning.ts` |DirectBUS/PARTS totals and fuel; `transferCraftDesign` normalizes through legacy Mars design. New transfer context must preserve bus/model identity without applying oldM02 resource policy. Stage rocket equation uses new actual wet mass. |
| `src/transfer/runtime.ts` |Direct base power/fuel/kind loads, hardcoded X-band budget, aperture cones, science requirement and global slew. Cached resources must key by immutable hardware version as well as design. |
| `src/transfer/persistence.ts` |Delegates to old strict `validateDesign`; replays full runtime. Add engine dispatcher; new derived hardware graph/coordinates in imports remain untrusted. |
| `src/render/parts.ts` |`createBus()` has one geometry; `createPart(kind)` picks one mesh. New `createBus(profile)`/`createPart(model)` uses shared mechanical descriptors, separate board/carrier/antenna meshes, consistent normal+Z. |
| `src/render/scene.ts` |Bus created once; part reuse keyed by instance ID; ghosts made fromkind; drag projection/mount panels need bus dimensions. Model change on same ID must invalidate mesh. Maintain UVmetres, not silent normalizedcoordinates. |
| `src/render/transfer-scene.ts` |Recreates legacy bus andkind meshes in flight. Must receive same resolved model and attitude as runtime. |
| `src/render/inspection.ts` |Filters output byPARTS and per-kind optical/RF cones. Read actual connected radio/antenna pattern and model apertures; show disconnected power separately from shade. |
| `src/main.ts` |Palette iteratesObject.values(PARTS); selection, IDs, drag payload and internal-move controls usekind. Introduce bus comparison +model cards and per-model source drawer without breaking undo/import/selection. |
| `src/ui-data.ts`, `src/i18n.ts`, `src/transfer-i18n.ts` |Evidence lookup currently bykind and static labels. Lookup model and exact field; translate compatibility errors while keeping IDs/unitsstable. |
| `src/sim.worker.ts` / preview client, `src/transfer.worker.ts`, `src/transfer-ui.ts` |Workers must dispatch version before preview/replay. Revision guards must also cover bus/model edits; launch must use the latest compatible graph, not prior successful preview. |
| Tests using globals |`sim-engine`, `sim-maneuvers`, `i18n`, `transfer-audit`, `transfer-resource-audit` assert legacy constants legitimately. Retain those expectations and add new-version tests; do not “fix” regressions by changing old expected results. |

Mechanical contract: `GeometryProfile` owns `mountFootprint`, `deployedBoxes`, `stowedBoxes`, optical/RF aperture local coordinates, internal bay bounds and render parameters. Broad visual styling can vary, but actual mesh extents must remain inside matching collision proxies with documented tolerance. Same-kind model reuse is safe only if this profile agrees. New wings need six separate illuminated patches; multiplying one legacy panel's visibility by270 W is insufficient for a differently shaped six-wing assembly.

## 7. Minimum staged implementation and completion gates

| Stage | Deliverable | Gate before proceeding |
|---|---|---|
| A — immutable compatibility foundation |Versioned hardware schema/registry, per-field provenance, frozen legacy resolver, bus-aware geometry helpers |All existing checkpoints and test suites still pass under their original model; no visual or resource change to old flights. No new catalogue claims yet. |
| B — first meaningful bus/radio slice |Two buses, explicit radio/antenna parts, automatic voltage/data/RF matching, real link-budget choice, internal board placement |A valid LEOUHF design; valid expeditionX-band design; wrongband, missingradio, insufficientrail and unsupporteddata each produce distinct blocked reasons. No full16claim. |
| C — power/storage/optics choices |2solar,2battery,2camera,1spectrometer,2radio,2antenna,1engine,2recorder =14 models |Actual throughput affects acquisition and downlink; EPS saturation/curtailment, storage exhaustion and geometric shadow change outcomes; at least two distinct successful designs per supported mission under new rules. |
| D — attitude selection |2ADCS models with shared physical pointing/resource effects;16 models total |Different mass layouts and momentum capacities produce repeatable slew/time-window consequences. No-device and unsupportedcontrolpath are explicit. Both preset strategies rebalanced from simulation evidence. |
| E — ship/compatibility |KO/ENsource/mode explanations, migration draft diff, browser20-part manipulation, savebackup/resume, performance checks |Legacy and new runs resume independently; production browser tests reproduce planned success/failure cases; no placeholder models counted. |

Work surface is roughly18production files plus both worker paths and new source records. The highest migration cost is **shared geometry/resource behavior leaking into historical replay**, not adding enum values. Separate numerical/data work from renderer/interaction work after StageA establishes contracts. An effort estimate should follow that refactor; this document does not promise a calendar duration or claim the new presets already succeed.

### Required evidence, not implementation-mirroring tests

- Preserve full, partial and queued-backlog checkpoints for both old engines. Restore before/after new catalogue introduction, then compare time, energy, fuel, attitude, packet capture/transmit/receipt, command/burn state and score.
- Port-assignment property tests: permutation-invariant graph; feasible non-greedy example; no duplicate exclusive port; unmet peak rail and protocol mismatches; metadata IDs cannot override values.
- Hand-computed energy cases:3.3 V×0.8 A=2.64 W;0.5 h at2.64 W=1.32 Wh before converter losses; battery charge/discharge bounded by both pack andEPS.
- Independent link cases: AX100 can never exceed its selected physical signal rate; UHF and X-band station/antenna mismatches produce zero delivered bits; passive antenna with no radio produces none; receiving time includes light delay.
- Data-flow case: instrument→recorder10 Mbit/s link takes at least20.133 s to move a201.33 Mbit frame; changing recorder capacity alone cannot shorten it. Arrival ordering is invariant under timewarp300/600s and UIquery patterns.
- Geometry checks against actualmesh bounds for every model, both buses and stowed/deployed states; board/harness mass counted once; changing bus can invalidate a previously legal UV placement with a visible cause.
- Attitude analytic cases for inertia, torque-limited turn and momentum-limited maximum body rate; no quaternion jump; optical/radio/power use identical attitude; old20°/s fixtures unchanged.
- Scenario acceptance: forM01, a low-dataUHF survey and an X-band precision mission; forM02/M03, two distinct viable energy/storage/antenna layouts. These are **targets for validation**, not outcomes established by this proposal.
- Source audit: no manufacturer-priced gamecredits, no RF/DC confusion, no cell/array confusion, no directbattery-parallel claim, no verifiedCAD tag on a procedural approximation.

## 8. Provenance, asset reuse and unresolved decisions

Link to exact primary documents and retain metadata/hash/field extraction. Existing manufacturer numerical facts can be incorporated with attribution; this proposal does **not** assert an open redistribution licence for vendor PDFs, photos, CAD, trademarks or firmware. Build original procedural meshes from documented dimensions/approximate assemblies and keep the copyrighted PDFs external unless explicit permission covers redistribution. The CubeSpace PDF is marked copyright and commercial-in-confidence despite its public URL; use it for integration context, not packaged art or wholesale text. JPL's Iris brochure is copyright2022Caltech, not an automatic all-content-public-domain case.

NASA's guidelines distinguish generally reusable NASA media from third-party material and require avoiding implied endorsement. Maintain the existing source drawer and “educational model” language; vendor/NASA marks are not unlock badges. [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)

Before implementation, settle these bounded choices: whether new runs use a separate programme selector or an explicit “hardware2” upgrade; whether radio chain selection lives in each downlink interval or one design default; and which fields lacking a public ICD are authored integration profiles. Recommended defaults: separate new-run profile, one design-defaultradio chain with schedule override deferred, and clearly authored driver/connector adapters. None requires changing or corrupting the released1.3/transfer1.0 saves.

Unresolved source work before source-qualified catalogue release: BPXPDF fresh archival fetch; visual column audit of BCT2026 table and full power/ICD if publicly obtainable; Iris mode-power discrepancy confirmation; TSPexact folded envelope and adapter inclusion; antenna geometry/mass source if replacing the authored reflector. Missing values stay labelled assumptions or unavailable. The current source evidence supports a useful staged implementation; it does not certify a complete real spacecraft design.
