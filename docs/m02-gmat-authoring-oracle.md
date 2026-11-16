# M02 candidate orbit: independent GMAT authoring check

The candidate local conic passes **24/24 actual GMAT R2026a cases** in [the second oracle report](../tools/swingby/gmat-exit-oracle-v2/report.json). This is a numerical authoring prerequisite, not acceptance of the new gameplay runtime, finite attitude preparation, carrier geometry or science return. Each case preserves its script, startup settings, console output, raw eight-state CSV and comparison.

All cases start from the same actual TDB epoch, 3,600 seconds before a fixed correction. GMAT independently integrates central Mars gravity, executes an ideal impulse with a chemical tank and mass depletion, finds periapsis, then finds the outward 100,000 km evaluation sphere and outward 577,000 km model boundary. The analytical study supplies the comparison, not GMAT's event times. Both heliocentric reconstructions use the same frozen Horizons Mars ephemeris; this is not an independent planetary ephemeris check.

| Maximum observed difference | Value | Gate |
| --- | ---: | ---: |
| Local position across eight samples | 0.4664 m | 10 m |
| Local velocity across eight samples | 0.0001397 m/s | 0.01 m/s |
| Periapsis altitude | 0.0000000222 km | 0.01 km |
| Evaluation crossing time | 0.0000511 s | 0.1 s |
| Outward model-boundary time | 0.00009591 s | 0.1 s |
| Heliocentric exit direction | 0.00000000782° | 0.005° |
| Heliocentric specific energy | 0.00000002492 km²/s² | 0.01 km²/s² |
| Applied inertial impulse vector | 0.00000000001061 m/s | 0.00000001 m/s |
| Propellant decrement | 0.000000000000115 kg | 0.0000000001 kg |

Every fixture has an outward radial velocity at both exit events and the same direction/energy classification in both calculations. Impulses produce no position jump. The zero impulse uses exactly zero burn components and consumes no fuel.

## The first attempt remains rejected

The [first 24-case report](../tools/swingby/gmat-exit-oracle-v1/report.json) passed the orbital limits but failed its stricter applied-impulse vector gate in 23 cases. The maximum discrepancy was about 0.000001688 m/s. Its original harness is retained beside that report; the gate was not loosened.

NASA's current [Burn.cpp implementation](https://raw.githubusercontent.com/nasa/GMAT/main/src/base/burn/Burn.cpp) converts a custom coordinate-system burn through its base-system transform and includes a note about the MJ2000 conversion. This suggested an ICRF/MJ2000 adapter issue; it is an inference from source and the observed behavior, not a claim that a particular upstream issue has been confirmed.

The revised adapter creates a non-propagated spacecraft reference at the actual burn epoch, applies the requested ICRF velocity increment to that reference, and asks GMAT for the resulting MJ2000 velocity difference. It then applies that vector through a Mars-origin MJ2000 burn. The independently reported ICRF states before and after the maneuver must still match the original requested vector within the unchanged strict gate. This removes the observed discrepancy without modifying the game conic or the goal.

## What the candidate goal distinguishes

The target remains provisional until actual resource and science flights pass. The following are **geometrically valid candidates**, not completed missions:

| X / Y correction, m/s | Direction error | Energy, km²/s² | Geometric outcome |
| --- | ---: | ---: | --- |
| 0 / +2 | <0.00000001° | −281.88985 | Both objectives pass |
| −1 / +2 | 0.02464° | −280.63108 | Both objectives pass |
| +1 / +2 | 0.02204° | −283.11672 | Both objectives pass |
| 0 / +1.5 | 0.06153° | −281.89475 | Both pass with lower impulse |
| 0 / 0 | 0.24611° | −281.96197 | Direction fails; energy passes |
| −2 / +2 | 0.05205° | −279.33967 | Direction passes; energy fails |
| −7 / 0 | 0.38112° | −272.44604 | Objectives fail; 153.72 km periapsis violates 250 km safety |

The mass-depletion example uses the existing balanced hardware craft's dry mass plus the proposed 0.4 kg carrier, and 0.25 kg initial propellant. The baseline 2 m/s impulse costs about 0.04818 kg. Neither this scalar calculation nor GMAT validates whether the real mounted engine can prepare, point and execute that burn. Those checks remain in the new runtime acceptance work.

The next gate is to compare the implemented `swingby-1.0.0` conic/planner against these unchanged raw oracle fixtures, then execute the actual attitude, power, fuel, observation and Earth-reception loop. No released simulation or requirement status was changed by this authoring check.
