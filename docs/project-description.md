# Starline Memory — submission copy

Working draft for the competition form. Replace no factual claim with an assumption: the deployed prototype, actual Google model response, public repository and final assets must be checked before submission. Delivery evidence is tracked in `submission-checklist.md`.

## Project name

Starline Memory

## Theme

Future of Work & Enterprise Productivity

## One-line description

A personal work-memory workspace that turns notes into editable records and answers questions with links to the original evidence.

## Short description

Starline Memory helps people recover decisions, commitments and context from their own work notes. Users explicitly send a note to Google Gemini, review the proposed structure and save an editable record in an encrypted local browser vault. They can then ask a question over selected records and inspect the quoted source behind an answer. Manual capture remains available when AI is unavailable.

## Submission brief — maximum 1,024 characters

Starline Memory is a work-memory prototype for capturing notes, reviewing facts and finding the original evidence. Its Google Gemini SDK integration is designed to turn a user-selected note into editable fields with verbatim quotes, then answer questions only from records the user selects and authorizes for that request. Supported answers must be exact excerpts from validated source quotes; unsupported results return not found. Saved records use WebCrypto AES-GCM in the browser's IndexedDB, with manual capture available when AI is unavailable. Local save, cancel, reload persistence and consent/error behavior have been checked; 43 automated tests pass. The isolated source is public. Live Gemini verification and the planned Google Cloud Run deployment remain pending billing activation. No private notes, credentials or existing app data are included.

## Problem

A small but recurring part of knowledge work is remembering what was actually agreed: who owns a follow-up, which date was confirmed, or whether a decision is still pending. Those details often sit inside unstructured personal notes. Search can find words without making the underlying commitment clear, while an unsupported AI answer can make an uncertain detail sound settled.

The prototype focuses on an individual worker's own notes. It does not assume access to a company's email, chat system or shared document store.

## Solution and user journey

1. Capture a work note. Saving manually does not require an AI service.
2. Choose to organize it with Google Gemini. The server requests a title, summary, category, tags, supported facts and explicit dates.
3. Review the draft. Extracted fields include exact source quotes. The user can edit the values and confirm any proposed dates before saving; an AI response is never saved automatically.
4. Save the record in the local browser vault.
5. Select the records that may be used for a question and explicitly approve sending that selection to Gemini.
6. Read the answer, follow a citation and inspect the original record. When the supplied records do not support an answer, the interface should report that limitation instead of inventing evidence.

## Meaningful use of Google AI

The organizing step converts free-form text into a reviewable record rather than merely generating a chat reply. The question step uses only the records the user selected for that request. Supported answers use verbatim excerpts: each answer line must come from a citation quote validated against the supplied original text or field values. Unsupported or unverifiable answers return a not-found result. These checks do not prove that the underlying record is true or that an excerpt has been interpreted correctly, so source inspection and user review remain part of the workflow.

The deployed model name must be taken from the live service response. Do not describe a successful live Gemini run until it has actually been observed.

## Technical approach

The isolated prototype uses a vanilla JavaScript client and a Node.js service. The intended deployment uses one Google Cloud Run service for the client and the same-origin JSON API. The server uses Google's Gemini SDK, preferring Vertex AI with Application Default Credentials for deployment. Credentials stay on the server. The application does not persist submitted note text on the server or intentionally log request bodies.

Saved records are encrypted in the browser using WebCrypto AES-GCM and stored in IndexedDB. The non-extractable key is also persisted in that browser's IndexedDB. This is local browser encryption: it is not an account-backed cloud vault, a password-unlock system, cross-device synchronization or a claim of end-to-end cloud encryption. Code running with the same origin, or someone with access to the open browser workspace, can still access the records through the application.

The public AI endpoints enforce input bounds and process-local rate/concurrency limits. A production service would need authenticated quotas, stronger abuse controls, operational monitoring and a separately designed recovery model.

## Value and differentiation

Starline Memory brings capture, evidence-linked review and retrieval into one short workflow. Its distinguishing choices are explicit AI transmission, editable extraction before saving, a local vault, and source-linked answers. The intended benefit is less manual re-reading and clearer recovery of work context. No time-saving percentage, customer adoption figure or measured accuracy is claimed for this prototype.

## Scope and limitations

The prototype accepts text notes. It does not provide background collection, document OCR, email or chat import, team sharing, cross-device sync or autonomous actions. A question can use at most 12 selected records and 24,000 combined characters of supplied text. Citation validation reduces one class of unsupported output; it is not a guarantee against hallucination. This is a lookup tool for user records, not professional medical, legal or financial advice.

Future work may evaluate retrieval over a larger vault, clearer uncertainty handling and a recovery approach designed with user research. Those items are a roadmap, not delivered features.

## Project origin

This competition prototype is developed separately in `memory-cup/`. The existing Starline iOS app, its identity service, signing assets and private data are outside the submission package. The submitter must independently confirm the organizer's project-timing and team-eligibility requirements; this document makes no declaration on the team's behalf.

## Links

Public source: [Starline Memory](https://github.com/jhuyhgu/starline-memory-ai), implementation baseline `882c5d9`. Later documentation commits do not change that implementation baseline. The live prototype URL, public video URL and completed official-template pitch PDF remain pending; record verified values in `submission-checklist.md` before pasting them into the form. The actual form requires a 3–4 minute video, a PDF no larger than 5 MB and a brief of at most 1,024 characters.
