# Starline Memory — content for the official pitch template

This file supplies text only. **It is not a pitch deck, an organizer template or a finished PDF.** Preserve the organizer's actual slide order, headings and required fields when transferring this content. The root agent is obtaining that template; no substitute template should be presented as official.

## Cover / project identity

**Project:** Starline Memory  
**Theme:** Future of Work & Enterprise Productivity  
**Line:** Recover work context. Inspect the evidence.

Team name and member details must come from the registered team. Do not infer them from fictional demo notes or from the Starline company name.

## Problem

- Owners, commitments and pending decisions are easy to lose inside unstructured work notes.
- Keyword search finds text but still leaves the user reconstructing context.
- Unsupported AI answers can turn missing information into false certainty.

**Target user:** an individual worker managing their own meeting notes and project follow-ups.

## Solution

**Capture → explicitly organize with Gemini → review and edit → save locally → ask over selected records → inspect the cited original.**

- Save manually when AI is unavailable.
- Review extracted facts and confirm dates before saving.
- Choose which records can be sent for each question.
- Follow answer citations back to the source record.

## Google AI implementation

- Google Gemini organizes a text note into editable fields with source quotes.
- Gemini answers a question using only the supplied record selection.
- Server-side checks validate quote text and citation IDs.
- Unsupported results must not contain invented citations.
- Actual deployed model name: fill from a verified live API response.

This is structured extraction and bounded question answering, with review built into the workflow. Quote validation is not a proof that all generated content is correct.

## Architecture

```text
Browser workspace
  ├─ WebCrypto AES-GCM + IndexedDB: local saved records and browser-held key
  └─ Explicit organize / selected-record question request
       → Same-origin Node.js API on Google Cloud Run
       → Google Gemini through the server-side Google SDK
       → Validated draft or answer + original-record citations
```

No client-side AI credentials. No application server persistence of note text. No automatic full-vault upload.

## Product experience / demo

Use actual screenshots from the final running prototype:

1. Capture the explicitly fictional handoff note.
2. Review a proposed field beside its exact source quote.
3. Edit and save the record.
4. Select it for a question and approve transmission.
5. Open the answer's citation in the original note.
6. Show a real unsupported-result case.

Use the shot plan in `demo-script.md`. Do not use a generated mockup as evidence that the implementation works.

## Impact and differentiation

**Intended value:** help a worker recover commitments and context with less re-reading, while keeping uncertainty and source inspection visible.

**Design choices:** explicit AI transmission, editable extraction before save, local browser storage, and evidence-linked retrieval.

**Evidence to report:** only the actual test results, successful live AI interaction, and functioning public deployment verified for this build. No adoption, accuracy, time-saving or revenue numbers are claimed.

## Feasibility, scale and next steps

The prototype uses one stateless Cloud Run application and bounded AI requests. Local records do not require a hosted vault database. This is a deliberately small evaluation surface, not a production enterprise deployment.

Future work: test retrieval with more records, evaluate answer support with a documented dataset, improve accessibility through user testing, and design authenticated quotas and recovery before adding cloud sync. Mark all of these as future work.

## Limitations and privacy

- Text notes only; no background collection or account integrations.
- Up to 12 selected records and 24,000 combined text characters per question.
- Local encryption keeps notes encrypted in IndexedDB; its key lives in the same browser origin. It does not prevent the open app or same-origin script from accessing records.
- The explicit request sends the chosen note or record selection to Google for processing.
- No cross-device sync or end-to-end cloud-vault claim.
- A citation is inspectable evidence, not a guarantee against hallucination or professional advice.

## Closing / evaluation links

Fill only verified values from `submission-checklist.md`:

- Public prototype URL
- Public GitHub repository
- Public demo video, under three minutes
- Final official-template PDF
- Registered team information

Do not show placeholder URLs in the exported deck. Remove draft-only instructions after the real template fields and assets are populated.
