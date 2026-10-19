# API-owned contracts

This is the pinned `@retreatengine/contracts` snapshot from the API. Edit the API source, not these generated files or `src/generated/contracts`.

- `npm run generate:contracts -- --api /path/to/api-checkout`: verify checksums, update the pinned API package and regenerate shared compatibility types plus Hey API Axios SDK.
- `npm run generate:contracts`: regenerate against the already pinned package, offline.
- `npm run check:contracts`: regenerate into a temporary directory and detect missing, changed or extra generated files without modifying the checkout.
- `npm run check:contracts -- --api /path/to/api-checkout`: additionally detect mismatched API/admin snapshots (`CONTRACTS_API_DIR` is equivalent).
- `npm run test:contracts`: exercise generation and deliberate drift/tampering failures on isolated copies.

`src/types/index.ts` is a compatibility re-export of API-owned shared types. Form-friendly dates and legacy optional fields are preserved. These compatibility types are distinct from wire DTOs in `src/generated/contracts/sdk/types.gen.ts`; legacy endpoints with incomplete Swagger metadata remain untyped. This migration does not pretend to add validation/return guarantees to every API endpoint.

Contact Book uses the generated SDK now. It shares the existing Axios instance, runtime API base URL, auth/error interceptors, cache keys and invalidation. Further wrappers can migrate without changing caller behavior. Never use an unconfigured generated singleton for authenticated application requests.

CI checks the pinned contract and generated files on every PR. To compare a paired private API branch too, configure repository variable `CONTRACTS_API_REPOSITORY` (e.g. `thegoodbyte/provider-plus-nestjs`), optional `CONTRACTS_API_REF` (default `production`), and read-only secret `CONTRACTS_READ_TOKEN`. Require the workflow in branch protection. These external repository settings are not changed by this local implementation. Coordinate package changes across both repositories; a pinned version is not an automatic live/latest-backend lookup.

Node 22.18+ is required by the pinned generator; CI uses 22.20. [Generator documentation](https://heyapi.dev/docs/openapi/typescript/clients/axios).
