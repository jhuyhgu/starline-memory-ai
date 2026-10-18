# Starline Memory — competition prototype contract

This is a new, isolated prototype created on 18 October 2026 for AI Builder Cup. Do not copy or publish the existing identity service, private app data, signing material, or chat databases. The existing iOS work continues separately.

## Product flow

Capture a note → explicitly ask Google Gemini to organize it → review and edit extracted facts → save locally → ask a question over selected saved memories → open cited original records. No automatic save and no automatic upload of the vault. English is the default UI and submission language. Use clearly fictional sample notes.

Google Cloud deployment: one Node.js 22+ Cloud Run service serves the static client and two JSON endpoints. Vertex AI with application default credentials is preferred; a server-side Gemini API key may be supported for local testing. Never put credentials in client code or Git. No mock AI success in production: if unavailable return a clear error and keep manual capture/save available.

## Shared API contract

GET /api/health → {ok:true, aiConfigured:boolean, provider:"Google Gemini", model:string|null}. Do not reveal credential or account details.

POST /api/organize accepts {text:string, language:"en"|"zh"}. text length 2–6000 characters. Returns {memory:{title:string,summary:string,category:string,tags:string[],fields:[{label:string,value:string,quote:string}],dates:[{label:string,date:string,quote:string}],originalText:string},provider:"Google Gemini",model:string}. Quotes must occur verbatim in the input. Omit unsupported facts. Dates require evidence and user confirmation; do not infer medical/legal facts or expiry dates. All values remain editable before saving.

POST /api/ask accepts {question:string,memories:[{id:string,title:string,text:string,fields:[{label:string,value:string}]}]}. question up to 1000 chars, max 12 memories, max combined memory text 24000 chars. Returns {answer:string,found:boolean,citations:[{id:string,quote:string}],provider:"Google Gemini",model:string}. Citation IDs must belong to the supplied records and quotes must appear in their supplied original text or fields. An unsupported answer must be found:false with no fabricated citation. Frontend clearly asks permission before sending selected records to Google Gemini. This is lookup over user records, not professional advice.

API errors use {error:{code:string,message:string}} with appropriate 400/413/429/503 status. No request text logging or server persistence. Same-origin client only; request limits and concurrency/rate protection are required for the public prototype. Root will configure public deployment and credentials.

## Client ownership and data

Frontend files: public/index.html, public/app.js, public/styles.css, public/vault.js and frontend tests. No external UI CDN dependencies. Vanilla JS modules are acceptable. Responsive desktop and mobile. Existing Starline black logo, restrained white surfaces, thin consistent inline SVG icons, no decorative emoji, no dark dashboard template, no excessive divider lines. Focus on an actual workspace, not a landing page.

Saved memories stay in an IndexedDB vault encrypted with WebCrypto AES-GCM and a per-origin non-extractable CryptoKey persisted in IndexedDB. Describe this boundary honestly: local browser encryption, no cross-device sync or end-to-end cloud vault claim. Do not use localStorage for plaintext notes. Allow delete and export; exporting is an explicit user action. Manual capture/save works when AI is unavailable. Samples are clearly marked sample data, optionally loaded by the user, never represented as real personal records. Never use innerHTML with model/user content; textContent or safe element construction.

Backend ownership: package.json/package-lock.json, server.mjs, ai.mjs, Dockerfile, .dockerignore, backend tests, .env.example. Frontend and backend must honor this exact API. Root owns deployment scripts and repository publication. Documentation agent owns docs/ submission text and README; do not invent deployed URLs, metric claims, team details, model success, or submission success.

## Required verification

Backend unit and real HTTP tests for bounds, model failure, citation validation, and no credential exposure. Frontend vault encryption round-trip and cancel/manual-save behavior. Actual browser walkthrough against live Gemini after credentials are configured. Public URL must remain available through evaluation. Demo video under 3 minutes; pitch PDF must use the organizer template once obtained; public GitHub contains only this isolated prototype.
