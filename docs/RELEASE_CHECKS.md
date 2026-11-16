# Repository release checks

Prepared on 2026-11-16 (Asia/Seoul), from public game release source `f7c305c0d13eb138bde5a3d745ebc2663c611a7e`.

## Verified for this repository export

- `npm ci`: completed; npm reported no dependency vulnerabilities at installation time.
- `npm run test:solar`: **8 test files, 62 tests passed**. This covers the main Solar System model, destination reachability, campaign constraints, assists, operations, instrument geometry, journey persistence and photo album.
- `npm run build`: TypeScript check and Vite production build completed. Vite reports large chunks; no bundle-size or first-load performance claim is made.
- README relative links and local images resolve. The demonstration is the verified 29-second public recording with actual equipment installation.
- Game source under `src/` is copied from the public release. The GitHub export does not include the unpublished project-page/learning-activity draft.

## Known historical-suite limitation

The broader legacy test suite is **not represented as fully passing**. A supplementary run of `tests/deployment-craft.test.ts` found its old byte-identity assertion does not match the current released dependencies. Comparing the captured hashes shows a mixture of line-ending differences and subsequently changed files. The historical reference has not been rewritten to manufacture a passing result, and this is not evidence of a new gameplay failure.

The included GitHub Actions workflow runs the passing focused campaign checks and the production build. Historical test fixtures and technical notes remain available for investigation; their earlier results apply only to their recorded build and scope. Automated checks do not measure player enjoyment or classroom learning effectiveness.
