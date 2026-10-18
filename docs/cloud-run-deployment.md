# Cloud Run deployment and live verification

This guide deploys only the isolated [Starline Memory AI source](https://github.com/jhuyhgu/starline-memory-ai). No existing Starline App, identity service, signing material, chat database or browser vault belongs in the build. The helper never logs in, links billing, upgrades a payment plan, creates a service-account key, enables APIs, or grants IAM automatically.

The helper's default is an **offline plan**. `check` performs read-only cloud checks; `deploy` is an explicit cloud write and can incur build, registry, Cloud Run and Gemini charges. An existing billing-enabled project is required. Configure suitable budget alerts and Vertex quotas separately; a one-instance limit and budget alerts are not a spending cap.

## Deployment settings

| Setting | Value |
| --- | --- |
| Cloud Run region | `asia-northeast1` |
| Vertex AI model location | `global` |
| Model | `gemini-3.5-flash` |
| Service and revision scaling | minimum 0, maximum 1 |
| Container | 1 vCPU, 512 MiB, request-based CPU, startup CPU boost disabled |
| Cloud Run concurrency / timeout | 8 requests per instance / 60 seconds |
| Application AI protection | 3 concurrent requests, 12 requests/IP/minute, 60 requests/instance/minute; 128 KiB bodies; 45-second model timeout |
| Authentication to Google | attached dedicated runtime service account, Application Default Credentials |
| Public access | unauthenticated HTTPS, same-origin client and API |

The application limits AI work independently so static files and health requests can still be served. Limits are in memory, not distributed quotas. Scale-to-zero means the first evaluation request can cold-start. `global` is a model routing location, not a promise that all model processing stays in Japan.

## Prepare the explicit project

Use Node.js 22+ and an authenticated Google Cloud CLI. Flags were checked against **gcloud 589.0.0** using `version` and offline `--help`. The commands below are setup instructions for an authorized administrator; they have not been executed by writing this guide.

Set the actual project ID yourself; do not use an implicit active-project setting:

```sh
export PROJECT_ID='REPLACE_WITH_YOUR_EXISTING_PROJECT_ID'
```

Check the existing project and billing state before any resource changes:

```sh
gcloud projects describe "$PROJECT_ID" --project="$PROJECT_ID" --format='value(projectId,lifecycleState)'
gcloud billing projects describe "$PROJECT_ID" --project="$PROJECT_ID" --format='value(billingEnabled)'
```

Stop if the project is inaccessible, inactive or billing is disabled. The helper deliberately contains no billing-link or upgrade command. Ensure the selected project and its enabled payment arrangement are the ones the owner intends to use.

Review and enable only the needed APIs, as a separate administrator action:

```sh
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com iam.googleapis.com --project="$PROJECT_ID"
```

Create distinct runtime and source-build identities. Do not grant either Owner or Editor:

```sh
gcloud iam service-accounts create starline-memory-runtime --display-name='Starline Memory runtime' --project="$PROJECT_ID"
gcloud iam service-accounts create starline-memory-build --display-name='Starline Memory source build' --project="$PROJECT_ID"
```

The runtime calls `GenerateContent`; its custom role grants only prediction and service-use permissions. It does not need storage, account administration, signing keys or Secret Manager access:

```sh
gcloud iam roles create starlineMemoryGeminiCaller --project="$PROJECT_ID" --title='Starline Memory Gemini caller' --stage=GA --permissions=aiplatform.endpoints.predict,serviceusage.services.use
gcloud projects add-iam-policy-binding "$PROJECT_ID" --project="$PROJECT_ID" --member="serviceAccount:starline-memory-runtime@$PROJECT_ID.iam.gserviceaccount.com" --role="projects/$PROJECT_ID/roles/starlineMemoryGeminiCaller" --condition=None
gcloud projects add-iam-policy-binding "$PROJECT_ID" --project="$PROJECT_ID" --member="serviceAccount:starline-memory-build@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/run.builder --condition=None
```

Create the source-build Docker repository in the deployment region if it does not already exist:

```sh
gcloud artifacts repositories create cloud-run-source-deploy --repository-format=docker --location=asia-northeast1 --description='Starline Memory source builds' --project="$PROJECT_ID"
```

The human/deployer identity needs the permissions for source deployment, service usage, attaching both service accounts, and making this service public. Google's documented source-deployment roles include `roles/run.sourceDeveloper`, `roles/serviceusage.serviceUsageConsumer`, and `roles/iam.serviceAccountUser` on the relevant accounts. Public IAM binding changes and this helper's strict IAM-policy preflight may require an administrator with additional policy read/change permissions. Have that administrator review the exact project; do not broaden the runtime account to solve deployment permissions.

The helper accepts the dedicated project custom role with exactly the two listed permissions, explicit unconditional project bindings, and the dedicated build account's `roles/run.builder`. It stops on missing prerequisites rather than attempting grants. This deliberately strict preflight does not attempt to infer inherited organization grants or conditional IAM rules.

## Review, check, deploy

From the isolated repository root, inspect the complete command without contacting Google:

```sh
node scripts/deploy-cloud-run.mjs --project "$PROJECT_ID" --mode plan
```

For a CLI outside PATH, append `--gcloud /absolute/path/to/gcloud`, or set `GCLOUD_BIN`. No account or project is silently selected by the script.

Run read-only prerequisites:

```sh
node scripts/deploy-cloud-run.mjs --project "$PROJECT_ID" --mode check
```

A passed preflight proves the listed configuration exists. It does not prove model access, successful AI, a public deployment or submission. Once the owner has reviewed the plan and authorizes the cloud write:

```sh
node scripts/deploy-cloud-run.mjs --project "$PROJECT_ID" --mode deploy
```

Optional `--service`, `--runtime-service-account`, and `--build-service-account` values must remain explicit valid names within the same project. Runtime and build accounts must be distinct.

Before source upload, the helper creates a temporary **allowlisted build context** containing only `server.mjs`, `ai.mjs`, package/lock, Docker files and ordinary static files under `public/`. It never copies `.env`, dependency folders, docs, tests, Git history, local databases or another App. It rejects public symlinks and hidden files. The temporary context is removed after deployment or failure.

Deployment waits for the CLI result, then reads the actual ready revision and HTTPS `run.app` URL. It never invents a URL and explicitly reports AI as unverified. The service sets only non-secret project/location/model environment variables; the attached runtime identity supplies ADC. Do not set `GOOGLE_APPLICATION_CREDENTIALS` or upload a JSON key to Cloud Run.

## Real positive and negative smoke checks

After the real URL exists, run:

```sh
node scripts/live-smoke.mjs https://YOUR_ACTUAL_SERVICE.run.app
```

The runner first requires `aiConfigured:true` and the expected provider/model. It then makes **four real Google Gemini requests**, using clearly fictional text only:

1. Organize a rehearsal note; retain its exact original, evidence-backed reference code and explicit full date.
2. Organize an undated prop-key note; require no invented date.
3. Ask for the rehearsal reference code; require a supported extractive answer and exact citation into the selected fictional record.
4. Ask for a passport number absent from that record; require `found:false` and no citation.

The runner sends only those fictional records. It never reads local environment files, auth tokens or the browser vault, never saves credentials or notes, and prints only provider/model and non-sensitive pass/fail counts. It performs no automatic retries. HTTP failure, invalid evidence, unconfigured AI or any missing positive/negative behavior exits nonzero without claiming success. A model override, when deliberately deployed and verified, can be checked with `--expect-model MODEL_ID`.

Health alone is configuration evidence. A successful smoke run proves those four real API cases at that time; it does not replace browser acceptance of editing, cancel, explicit save, consent, source opening or vault encryption. Keep the actual public URL available through evaluation and record the real smoke result separately from unit-test fixtures.

## Local helper tests

These tests use fictional local files and controlled CLI/HTTP fixtures. They do not run cloud commands or prove real Gemini access:

```sh
node --test scripts/*.test.mjs
```

## Official references

- [Cloud Run deploy flags](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy) — service/revision limits, identities, resource and source flags.
- [Source deployment](https://docs.cloud.google.com/run/docs/deploying-source-code) — source build and build service-account requirements.
- [Service identity](https://docs.cloud.google.com/run/docs/configuring/services/service-identity) — attached identity and deployer account permissions.
- [Billing project describe](https://docs.cloud.google.com/sdk/gcloud/reference/billing/projects/describe) — read-only billing-state check.
- [GenerateContent IAM](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rpc/google.cloud.aiplatform.v1#google.cloud.aiplatform.v1.PredictionService) — `aiplatform.endpoints.predict` permission.
- [Gemini 3.5 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash) — model ID, supported structured output and global location.
