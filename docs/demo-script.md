# Starline Memory — demo script

Target duration: **2 minutes 45 seconds**, leaving 15 seconds below the organizer's strict three-minute limit. Narration is in English. Record the functioning prototype using fictional notes only. This is a shot plan, not a transcript of an observed model response.

Before recording, verify the real Google AI configuration, deployed URL and source-link interaction. Remove credentials, unrelated tabs and personal records from view. It is acceptable to trim idle waiting; do not fabricate responses, replace a failed response with a mock, or edit the recording to imply an action succeeded when it did not.

## Fictional sample note

Use this text as an explicitly labelled sample:

```text
FICTIONAL SAMPLE — work handoff
On 18 October 2026, the demo team agreed that Maya will send the onboarding checklist by 23 October 2026.
The client prefers a Tuesday product walkthrough, but no date has been confirmed.
Budget approval is still pending. No final launch date has been agreed.
```

Maya and the demo team are fictional characters, not a statement about the competition team's members. The exact 23 October date is supported. A date for Tuesday's walkthrough is not confirmed and must not be invented.

## Recording sequence and narration

| Time | On-screen action | Suggested narration |
| --- | --- | --- |
| 0:00–0:15 | Show the workspace and project name. | “This is Starline Memory, a work-memory prototype. It helps you recover decisions and commitments from your own notes, with the original evidence still in reach.” |
| 0:15–0:30 | Paste the fictional sample into capture. Show the sample label. | “These notes are fictional. They contain an owner, one confirmed deadline, and several things that are still undecided.” |
| 0:30–0:55 | Explicitly choose the Gemini organization action. Show the actual returned draft. | “Organizing is an explicit choice. Google Gemini proposes a structure, and I review it before anything is saved. Each extracted fact has a quote from the note.” |
| 0:55–1:15 | Inspect a fact quote, edit the title or summary, and confirm the explicit deadline if proposed. Save. | “I can edit the draft and confirm dates. An unconfirmed preference should stay unconfirmed. Saving keeps the record in this browser's encrypted local vault.” |
| 1:15–1:40 | Select this saved record. Enter: “Who will send the onboarding checklist, and by when?” Show the transmission-consent step, then ask. | “For a question, I select which records may be sent to Gemini. The whole vault is not uploaded automatically.” |
| 1:40–2:00 | Show the actual supported answer. Open a citation and its original note. | “Here I can open the cited record and compare the answer with the exact source. Evidence is part of the interaction, not a separate search.” |
| 2:00–2:20 | Ask: “Which videoconferencing tool has been approved?” using the same selected record. Show the real unsupported-result behavior. | “This note says nothing about an approved meeting tool. The system should make that gap visible instead of inventing a decision.” |
| 2:20–2:45 | Return to the vault; show manual capture or delete/export controls without exposing real records. End on the workspace. | “Manual capture remains available if AI is unavailable. This prototype uses Google Gemini and Google Cloud Run. It has no background collection, account sync or shared enterprise vault. The aim is a small, reviewable workflow for remembering what was actually agreed.” |

## What must be verified rather than narrated as a promise

- The organize request reaches the configured Google model and the displayed draft is that response.
- The edit is retained in the saved local record.
- Saving requires an explicit action; canceling does not save a generated draft.
- The question uses only the checked records and requires explicit permission to send them.
- The citation opens the intended original record and its quote is present in the supplied evidence.
- The unsupported question has no fabricated answer or citation. If this test fails, fix the prototype before recording that segment.
- The public deployment opens without the developer's authenticated browser session.
- The final exported video is less than 180 seconds and its public link plays without requesting access.

## If AI is unavailable during recording

Show the actual service-unavailable error and the still-working manual save path. That can document graceful failure, but it does **not** demonstrate the required live AI workflow. Keep the submission's live-AI verification pending and do not use a manually written response as if Gemini produced it.
