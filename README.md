# Starline Memory

A small work-memory prototype: capture a note, explicitly organize it with Google Gemini, review the proposed facts, save locally, then ask a question over selected records and inspect the cited original.

This is the isolated competition prototype in `memory-cup/`. The existing Starline iOS app and its identity service, private databases and signing assets are outside this package. Public deployment, real-model verification and submission assets are tracked in [the submission checklist](docs/submission-checklist.md); a local build is not proof of deployment or submission.

## Runtime and local setup

- Node.js 22 or newer and npm.
- A current browser supporting JavaScript modules, IndexedDB and WebCrypto.
- HTTPS for a public deployment; `http://localhost` is supported for local development.
- Google AI credentials are required for AI actions. Manual capture/save must remain available without them.

From the isolated project directory:

```sh
npm ci
npm start
```

Open `http://localhost:8080/`. `npm start` reads the process environment; it does not automatically load a `.env` file. Without Google configuration, the server starts with AI unavailable so that manual capture/save can still be used.

To configure local AI, copy `.env.example` to a private `.env`, replace its project placeholder and configure Application Default Credentials. Then start with Node's environment-file support:

```sh
cp .env.example .env
node --env-file=.env server.mjs
```

Edit `.env` before running the second command. Do not enter a credential into browser code. For the API-key alternative, remove the project variable from the local environment and use a server-side key: a configured project always selects Vertex AI first.

| Variable | Behavior |
| --- | --- |
| `PORT` | Listening port; default `8080` |
| `GOOGLE_CLOUD_PROJECT` | Selects Vertex AI with ADC; `GCLOUD_PROJECT` is an alias |
| `GOOGLE_CLOUD_LOCATION` | Vertex model location; default `global` |
| `GEMINI_MODEL` | Configured model ID; code default `gemini-3.5-flash` |
| `GEMINI_API_KEY` | Server-side alternative when no project is configured; `GOOGLE_API_KEY` is an alias |
| `PUBLIC_ORIGIN` | Optional exact public HTTPS origin for browser POST checks |

The health endpoint's `aiConfigured` indicates that configuration is present, not that credentials or model access have been verified. Confirm the actual model with a successful live request. Do not serve the static directory from a separate origin: the client calls the JSON API on its own origin.

## Product flow

1. Capture a text note, or deliberately load clearly fictional sample notes.
2. Choose to organize it with Gemini. A returned draft is not automatically saved.
3. Review and edit the title, summary, tags and supported fields. Inspect the source quotes and confirm any proposed date before retaining it.
4. Save the record in this browser's local vault.
5. Select the records for a question and explicitly consent to sending that selection to Gemini.
6. Open an answer citation to inspect the original record. An unsupported result must not invent a source.

If AI is unavailable, the server returns an explicit error. The interface keeps the note and offers manual capture/save rather than a simulated AI success.

## Architecture and API

One Node.js service serves `public/` and three same-origin endpoints. Google Gemini calls happen on the server using the Google SDK; no API key or cloud credential is sent to the client.

| Endpoint | Purpose and bounds |
| --- | --- |
| `GET /api/health` | Reports service health, AI configuration availability, provider and configured model name; no credential details |
| `POST /api/organize` | Receives `{text, language}` with 2–6,000 text characters and language `en` or `zh`; returns an editable memory draft with source quotes |
| `POST /api/ask` | Receives a question up to 1,000 characters and at most 12 selected records, with at most 24,000 combined characters of original text, titles and fields |

Organized field/date quotes must occur in the submitted note. Answers are deliberately extractive: every nonempty answer line must be a verbatim excerpt from a valid citation quote. Citations must reference supplied record IDs and quote their original text or field values; field labels alone are not evidence. Unsupported or unverifiable answers return a not-found result. These checks do not establish that the underlying record is true or that an excerpt has been interpreted correctly.

The shared interface and ownership boundaries are defined in [CONTRACT.md](CONTRACT.md). Error bodies use `{error:{code,message}}` with request, size, rate-limit or availability status codes. The public prototype requires request limits and rate/concurrency controls; production authentication and distributed quota enforcement are outside this prototype's scope.

## Local vault and privacy boundaries

Saved record bodies are encrypted with WebCrypto AES-GCM using a random IV for each save. IndexedDB stores the encrypted records and a non-extractable per-origin CryptoKey. It does not store plaintext notes in localStorage.

The key lives in the same browser origin as the vault. This encryption is not a separate user password, an operating-system account lock, a recovery system or end-to-end encryption for a cloud vault. Someone using the open browser workspace, or code running with the same origin's access, can still read records through the application. Clearing browser site data or changing the origin can make existing records unavailable. There is no automatic cross-device sync.

An organize action transmits the current note to the server and Google Gemini. A question action transmits the question and only the selected records after consent. The application server does not persist those notes or intentionally log their request bodies. This is not a claim that Google performs no processing or retains no operational metadata; deployed service and provider settings remain relevant.

Delete removes the selected record from this local vault. Export asks for confirmation and downloads **all local records as readable, plaintext JSON**. The export is not an encrypted backup; store it carefully and do not share it unintentionally. Do not load real personal, confidential or regulated records into the public evaluation prototype.

## Tests

Run from `memory-cup/`:

```sh
npm test
```

Backend only:

```sh
npm run test:backend
```

Frontend vault and interaction-state checks only:

```sh
node --test tests/frontend*.test.mjs
```

On 18 October 2026, `npm test` passed 43 tests: 22 backend, 10 frontend and 11 deployment-helper checks. Backend tests use controlled model responses for deterministic bounds, evidence-validation and error paths. They do not establish that production credentials, the real Google model or a public deployment work. The final browser walkthrough must independently verify real organization, explicit save/cancel, consent, citations and failure recovery.

## Google Cloud deployment

Use the [deployment and live-verification guide](docs/cloud-run-deployment.md) for the offline plan, read-only prerequisites, isolated source upload and four real-model smoke cases. The helper does not enable billing or create service-account keys.

Deploy the isolated directory as one Cloud Run service using the included Dockerfile. It uses Node.js 22, installs the locked production dependencies, copies only the server and static client, and runs as the non-root `node` user. The service listens on the platform's `PORT` at `0.0.0.0`, serves client and API from the same public origin, and must remain reachable throughout evaluation. Root-owned deployment scripts and the final service URL belong to the release evidence, not to an invented example link.

Prefer Vertex AI with Application Default Credentials and a dedicated service account authorized for the configured model. For local testing, the backend may support a server-side Gemini API key. Keep credentials out of source control, build arguments, static files, screenshots and client-visible responses. A configuration flag or a health response is not evidence of a successful model call.

The runtime is stateless with respect to user notes. Current defaults permit three concurrent AI requests, 12 requests per IP per minute, and 60 requests per process per minute; these are configured limits, not throughput measurements. In-memory rate limits are scoped to each process and are not a substitute for authenticated quotas across multiple instances. Budget, access, model availability and abuse protections must be configured for the actual public deployment.

## Submission materials

- [Project description](docs/project-description.md)
- [Demo shot plan and narration, target 2:45](docs/demo-script.md)
- [Content to transfer into the official pitch template](docs/pitch-content.md)
- [Required real links, team inputs and verification evidence](docs/submission-checklist.md)

The proposed theme is **Future of Work & Enterprise Productivity**. The official [requirements](https://aibuildercup.com/themes.html) and [FAQs](https://aibuildercup.com/Faqs.html) govern the submission. The submitter must verify registered-team eligibility and project timing. No team member, metric, deployed URL, live-AI result or submission receipt is fabricated in these materials.
