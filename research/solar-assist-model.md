# Solar campaign: gravity assist implementation and limits

## Official-source foundation

NASA's gravity-assist primer explains that an unpowered encounter changes the
direction of velocity in the planet frame, conserving asymptotic speed. Adding
the moving planet's velocity produces the heliocentric energy change. Voyager's
Jupiter encounter enabled travel onward to Saturn; geometry and timing are
essential, not merely passing near a selected planet.
[NASA Basics of Spaceflight](https://science.nasa.gov/learn/basics-of-space-flight/primer/).

The NASA/JSC Copernicus paper describes **zero-sphere-of-influence (ZSOI)**
patched-conic planning: Lambert arcs meet at the planet center, and a parameterized
velocity rotation represents the flyby. In equations 1–2 and pp.3–5, an unpowered
flyby has equal incoming/outgoing asymptotic speeds and

`turn = 2 asin(1 / (1 + periapsisRadius * vInfinity² / planetGM))`.

The paper distinguishes genuine spacecraft impulses from this gravitational
rotation. A parallel impulse at infinity changes outgoing asymptotic speed;
a periapsis impulse is a separate model. These distinctions are preserved here.
[Williams et al., Recent Improvements to the Copernicus Trajectory Design and Optimization System](https://ntrs.nasa.gov/api/citations/20120001856/downloads/20120001856.pdf).

Planet states remain the project's explicitly approximate 1800–2050 Kepler
model, not new high-precision ephemerides. JPL identifies this as a lower-accuracy
approximation; Earth denotes the Earth/Moon barycenter.
[JPL approximate planetary positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html).

## Implemented method

`src/solar/assist.ts` is an original implementation, not the Copernicus software.
It reuses the existing bounded zero-revolution Lambert solver and universal
Kepler propagator. The existing `src/swingby` campaign is a separate fixed Mars
scenario with finite local arcs; its preset corrections are not reused as
interplanetary savings.

1. Solve Earth→assist and assist→destination with their three actual epochs.
2. Subtract the assist planet's velocity from both encounter velocities.
3. Require the asymptotic speed mismatch below 0.00001 km/s for an unpowered
   candidate. Search roots by bracketed bisection in encounter time.
4. Calculate the three-dimensional turn from the two velocity vectors. Invert
   the turn equation to obtain the necessary closest-approach radius.
5. Reject radius below the model exclusion altitude or above one quarter of
   the approximate Laplace SOI. These are authored scope bounds, not radiation,
   atmospheric, ring-plane, or navigation-safety certifications.
6. Finalize each leg with actual coast propagation, endpoint residual checks,
   and the existing conservative whole-conic solar-clearance test.
7. Charge the ideal 300 km Earth escape impulse. If explicitly requested, charge
   the full outgoing asymptotic correction vector as well. A changed relative
   speed never becomes a free gravity bonus. Destination is a flyby, not capture.

The async search yields between date pairs and supports cancellation. The
default scan uses 13 departure epochs, seven total trip durations and up to 41
encounter fractions, then bounded root refinement. A maximum of 420 date pairs
prevents accidental unbounded browser work. Search failure means no supported
candidate was found, not a proof that no real-world route exists.

## Reproducible numerical result

Default `searchAssistRoute({ assist:'jupiter', target:'saturn', requireSavings:true })`:

| Quantity | Result |
|---|---:|
| Earth departure, TDB Julian day | 2461719.5 |
| Jupiter encounter, TDB Julian day | 2462415.2484531403 |
| Saturn arrival, TDB Julian day | 2465319.5 |
| Total coast duration | 3600 days |
| Required Jupiter turn | 123.9505° |
| Jupiter periapsis altitude | 163473.31 km |
| Relative speed mismatch | 0.000000103 km/s |
| Escape plus numerical residual | 7277.1884 m/s |
| Direct route at identical departure AND arrival | 20025.8389 m/s |
| Best bounded direct scan across identical launch dates | 7391.2436 m/s, 2503 days |
| Savings against that sampled direct window | 114.0552 m/s |

Use the **114 m/s versus about three more years of flight** comparison as the
player-facing tradeoff. The much larger same-date saving is mathematically
consistent but its direct alternative is an inefficient very long coast. Neither
comparison asserts a globally optimal route. Search result exposes both reference
routes and the dates/durations so the distinction is inspectable.

## Playback and validation

`assistRouteState` samples the two genuine Sun-only coasts. Their positions meet
at the planet center; the idealized patch changes velocity instantaneously.
`assistLocalState` produces the independent correctly oriented hyperbola for a
close-pass visualization. It must not be presented as a finite-SOI-continuous
join to those coasts. A future finite-boundary differential correction would be
needed for that claim.

Eight CPU tests cover the discovered feasible route, fair fuel comparison,
moving endpoints, independent asymptote reconstruction, local energy and angular
momentum, heliocentric energy exchange, paid correction, invalid dates and unsafe
turns, meaningful sensitivity to encounter date, bounded search and cancellation.
These tests verify the declared numerical model, not GMAT/Horizons agreement,
mission certification, or whether players find the journey fun.
