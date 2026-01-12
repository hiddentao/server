# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [3.4.0](https://github.com/QuickDapp/QuickDapp/compare/v3.3.0...v3.4.0) (2026-01-08)


### Features

* add static assets documentation and fix SPA routing ([4921daf](https://github.com/QuickDapp/QuickDapp/commit/4921daf5d403b8347a92c59e59b0704fec86b9dc))
* do a bundled build for docker ([3e357ca](https://github.com/QuickDapp/QuickDapp/commit/3e357ca272b45fa67038f820d88b2e702ce3a344))

## [3.3.0](https://github.com/QuickDapp/QuickDapp/compare/v3.2.0...v3.3.0) (2026-01-07)


### Features

* add minify and sourcemap options to binary compilation ([#3](https://github.com/QuickDapp/QuickDapp/issues/3)) ([dfefda8](https://github.com/QuickDapp/QuickDapp/commit/dfefda842f0c1b446d020a9e02e0c243f98af288))
* add multi-chain support, worker tagging, and error handling ([#6](https://github.com/QuickDapp/QuickDapp/issues/6)) ([740b223](https://github.com/QuickDapp/QuickDapp/commit/740b22338f1ac12cff4f7f4fecaef369f84940e4))
* **build:** enable sourcemap generation for client build ([692ce89](https://github.com/QuickDapp/QuickDapp/commit/692ce89673228684f872e80b6dfeed5e1f4cd7e5))
* **client:** add form validation hook with async support ([60b7e4b](https://github.com/QuickDapp/QuickDapp/commit/60b7e4be22ed5db855cefce24b7ce869fa2a59b6))
* integrate Sentry error tracking and performance monitoring ([2fb77f8](https://github.com/QuickDapp/QuickDapp/commit/2fb77f8a60861d89e89b3d76cb4c709605d55e0b))
* refactor to make web3 optional ([#7](https://github.com/QuickDapp/QuickDapp/issues/7)) ([c44752b](https://github.com/QuickDapp/QuickDapp/commit/c44752bf1df33057ed5fb3df81a21442307fca97))
* **tracing:** add Sentry spans to database and GraphQL operations ([cf7fde4](https://github.com/QuickDapp/QuickDapp/commit/cf7fde42b7c33bb9e6b4b98e373d01bfdb67c6e6))


### Bug Fixes

* **scripts:** respect NODE_ENV in db.ts instead of hardcoding to development ([cddb0cf](https://github.com/QuickDapp/QuickDapp/commit/cddb0cf7d2d0d2256fcf1866d163459d0eb2d8c5))
* **sentry:** prevent multiple Sentry initializations ([fffd1c2](https://github.com/QuickDapp/QuickDapp/commit/fffd1c2c6d13674b4758abfc707293898ea7c054))

## [3.2.0](https://github.com/QuickDapp/QuickDapp/compare/v3.1.0...v3.2.0) (2025-10-01)


### Features

* add GraphQL code generation with TypeScript support ([add0d69](https://github.com/QuickDapp/QuickDapp/commit/add0d69a93e6355f4761b974ae67f193287f9b43))
* add transaction retry logic with exponential backoff ([feac9d9](https://github.com/QuickDapp/QuickDapp/commit/feac9d9df119afb9c10eb6782a8f33ce58ded483))


### Bug Fixes

* improve GraphQL code generation integration in development workflow ([d6c27c5](https://github.com/QuickDapp/QuickDapp/commit/d6c27c54733999ba02a5a105b937dce847928529))
* **scripts:** improve error handling in database scripts ([de48fc9](https://github.com/QuickDapp/QuickDapp/commit/de48fc9ad75a80dba4b43e1beff4d6939bbb776e))

## [3.1.0](https://github.com/QuickDapp/QuickDapp/compare/v3.0.4...v3.1.0) (2025-09-23)


### Features

* add OpenZeppelin contracts library to sample-contracts ([01f9e78](https://github.com/QuickDapp/QuickDapp/commit/01f9e782316a8e0c421ede168945cab890725e6e))
* add SERVER_CHAIN_RPC_ENDPOINT for server-side blockchain connections ([2a79c78](https://github.com/QuickDapp/QuickDapp/commit/2a79c78951c298ce4adaa1b84c193fabfdbd0deb))
* auto-create users during SIWE authentication ([e743c5d](https://github.com/QuickDapp/QuickDapp/commit/e743c5d5185bf1f4b3d171d0589079a81e409ec3))
* centralize chain configuration and fix failing tests ([e843f41](https://github.com/QuickDapp/QuickDapp/commit/e843f41c44fb6a6e72c12f8b2eb050feb8e315d3))
* enhance blockchain monitoring with custom events and improved error handling ([417c02a](https://github.com/QuickDapp/QuickDapp/commit/417c02ad2bc8329810d0244a95856e2bdbc78fec))

## [3.0.4](https://github.com/QuickDapp/QuickDapp/compare/v3.0.3...v3.0.4) (2025-09-23)


### Bug Fixes

* db verification command in ci ([44a0e1d](https://github.com/QuickDapp/QuickDapp/commit/44a0e1dcf14ba8e837207b80409a5be7d666670c))

## [3.0.3](https://github.com/QuickDapp/QuickDapp/compare/v3.0.2...v3.0.3) (2025-09-23)

## [3.0.2](https://github.com/QuickDapp/QuickDapp/compare/v3.0.1...v3.0.2) (2025-09-23)

## [3.0.1](https://github.com/QuickDapp/QuickDapp/compare/v3.0.0...v3.0.1) (2025-09-23)

## 3.0.0 (2025-09-23)


### ⚠ BREAKING CHANGES

* bun run build now always creates binaries by default

### Features

* add CI, license, and TypeScript badges to README and repository info to package.json ([36e8506](https://github.com/QuickDapp/QuickDapp/commit/36e850612515ebb8d91a029e10f17ae7f8b59ec1))
* add Docker support and fix binary asset bundling ([c8388b6](https://github.com/QuickDapp/QuickDapp/commit/c8388b635daa2cd278b208722bbd0901029730c0))
* add production command and simplify build process ([8764b24](https://github.com/QuickDapp/QuickDapp/commit/8764b24f05781c6d34a515bf08059f83593381aa))
* enhance authentication system and reorganize test structure ([e66e20f](https://github.com/QuickDapp/QuickDapp/commit/e66e20f639a058db066dee4f8b0bd80c63937c5a))
* implement complete frontend architecture with blockchain integration ([b1a71a1](https://github.com/QuickDapp/QuickDapp/commit/b1a71a1bc0dbfbfe20d7d3f33038c3fbac64a188))
* implement comprehensive test infrastructure with database helpers ([f4384e1](https://github.com/QuickDapp/QuickDapp/commit/f4384e165557df671c426da2888803d3a6234479))
* implement QuickDapp server with ServerApp pattern ([128367f](https://github.com/QuickDapp/QuickDapp/commit/128367fbac33badfe1bb40628fea0b7a46ce3484))
* improve README documentation and fix blockchain tests ([adcee56](https://github.com/QuickDapp/QuickDapp/commit/adcee561c76e5d59ae2f730931c505a3b5ad3ab8))
* merge sockets branch with WebSocket support and race condition fix ([a341abf](https://github.com/QuickDapp/QuickDapp/commit/a341abfe5f17e435bddc9b1a53585108177ab645))
* update package.json with proper scoped name, version 3.0.0, and enhanced metadata ([12eb518](https://github.com/QuickDapp/QuickDapp/commit/12eb518cf393a749fa1866aba20edecafeb2e31e))


### Bug Fixes

* ensure worker processes use correct runtime executable ([ac5df7f](https://github.com/QuickDapp/QuickDapp/commit/ac5df7fd881234cf663f95e3cc7d89bc92020666))
* format logger.ts ([bd08b33](https://github.com/QuickDapp/QuickDapp/commit/bd08b3376cecd6dbf51f0916f2addaffb8e914ba))
* resolve bun executable path issues in CI and tests ([b5a2c75](https://github.com/QuickDapp/QuickDapp/commit/b5a2c757b9c8b3392e084d14b7ce3e12cb5bd8b0))
* resolve database connection pool exhaustion and test infrastructure issues ([6baff6b](https://github.com/QuickDapp/QuickDapp/commit/6baff6b3f70cac6b684132b7666a0ae452c5dd94))
* **test:** correct db command and remove failing SPA test ([e0cc50e](https://github.com/QuickDapp/QuickDapp/commit/e0cc50ed968b24cb8b2bcd88b455c2f48d47ca29))

## 4.0.0 (2025-09-23)


### ⚠ BREAKING CHANGES

* bun run build now always creates binaries by default

### Features

* add CI, license, and TypeScript badges to README and repository info to package.json ([36e8506](https://github.com/QuickDapp/QuickDapp/commit/36e850612515ebb8d91a029e10f17ae7f8b59ec1))
* add Docker support and fix binary asset bundling ([c8388b6](https://github.com/QuickDapp/QuickDapp/commit/c8388b635daa2cd278b208722bbd0901029730c0))
* add production command and simplify build process ([8764b24](https://github.com/QuickDapp/QuickDapp/commit/8764b24f05781c6d34a515bf08059f83593381aa))
* enhance authentication system and reorganize test structure ([e66e20f](https://github.com/QuickDapp/QuickDapp/commit/e66e20f639a058db066dee4f8b0bd80c63937c5a))
* implement complete frontend architecture with blockchain integration ([b1a71a1](https://github.com/QuickDapp/QuickDapp/commit/b1a71a1bc0dbfbfe20d7d3f33038c3fbac64a188))
* implement comprehensive test infrastructure with database helpers ([f4384e1](https://github.com/QuickDapp/QuickDapp/commit/f4384e165557df671c426da2888803d3a6234479))
* implement QuickDapp server with ServerApp pattern ([128367f](https://github.com/QuickDapp/QuickDapp/commit/128367fbac33badfe1bb40628fea0b7a46ce3484))
* improve README documentation and fix blockchain tests ([adcee56](https://github.com/QuickDapp/QuickDapp/commit/adcee561c76e5d59ae2f730931c505a3b5ad3ab8))
* merge sockets branch with WebSocket support and race condition fix ([a341abf](https://github.com/QuickDapp/QuickDapp/commit/a341abfe5f17e435bddc9b1a53585108177ab645))
* update package.json with proper scoped name, version 3.0.0, and enhanced metadata ([12eb518](https://github.com/QuickDapp/QuickDapp/commit/12eb518cf393a749fa1866aba20edecafeb2e31e))


### Bug Fixes

* ensure worker processes use correct runtime executable ([ac5df7f](https://github.com/QuickDapp/QuickDapp/commit/ac5df7fd881234cf663f95e3cc7d89bc92020666))
* format logger.ts ([bd08b33](https://github.com/QuickDapp/QuickDapp/commit/bd08b3376cecd6dbf51f0916f2addaffb8e914ba))
* resolve bun executable path issues in CI and tests ([b5a2c75](https://github.com/QuickDapp/QuickDapp/commit/b5a2c757b9c8b3392e084d14b7ce3e12cb5bd8b0))
* resolve database connection pool exhaustion and test infrastructure issues ([6baff6b](https://github.com/QuickDapp/QuickDapp/commit/6baff6b3f70cac6b684132b7666a0ae452c5dd94))
* **test:** correct db command and remove failing SPA test ([e0cc50e](https://github.com/QuickDapp/QuickDapp/commit/e0cc50ed968b24cb8b2bcd88b455c2f48d47ca29))
