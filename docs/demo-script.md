# Starline Memory — demo script

Target duration: **3 minutes 15 seconds (195 seconds)**. The actual signed-in submission form specifies **3–4 minutes**; that specific form takes precedence over the older general FAQ wording. Narration is in English. Record the functioning prototype using fictional notes only. This is a shot plan, not a transcript of an observed model response.

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
| 0:00–0:20 | Show the workspace and project name. | “This is Starline Memory, a work-memory prototype. It helps you recover decisions and commitments from your own notes, with the original evidence still in reach. This is an individual workspace, not a connection to a company's private systems.” |
| 0:20–0:40 | Paste the fictional sample into capture. Show the sample label and empty vault. | “These notes are fictional. They contain an owner, one confirmed deadline, and several things that are still undecided. Loading the sample creates a draft; it does not save a memory.” |
| 0:40–1:10 | Explicitly choose the Gemini organization action. Show the actual returned draft and its source quotes. | “Organizing is an explicit choice. Only this note is sent to Google Gemini. The returned structure remains a draft for review, and each retained extracted fact must have evidence in the original note.” |
| 1:10–1:35 | Inspect a fact quote, edit the title or summary, and confirm the explicit deadline if proposed. Save. | “I can edit the draft and confirm dates before saving. Tuesday is a preference, not a confirmed calendar date. Saving keeps the record in this browser's encrypted local vault.” |
| 1:35–1:55 | Select this saved record. Enter: “Who will send the onboarding checklist, and by when?” Show the transmission-consent step, then ask. | “For a question, I select which records may be sent to Gemini and approve this specific request. The whole vault is not uploaded automatically.” |
| 1:55–2:25 | Show the actual supported answer. Open a citation, pause on its exact quote and original note. | “Answers use exact excerpts from validated source quotes. Here I can open the cited record and compare it with the original. The quote makes the source inspectable; it does not prove that every statement in the original note is true.” |
| 2:25–2:50 | Ask: “Which videoconferencing tool has been approved?” using the same selected record. Show the real unsupported-result behavior. | “This note says nothing about an approved meeting tool. An unsupported or unverifiable answer should return not found, with no invented citation. Missing information should stay visible.” |
| 2:50–3:15 | Return to the vault; show manual capture, privacy information and export warning without exposing real records. End on the workspace. | “Manual capture remains available if AI is unavailable. Export is a readable file that I must protect. The implementation connects through Google's Gemini SDK; Google Cloud Run is the intended hosting target. There is no background collection or cross-device sync.” |

## What must be verified rather than narrated as a promise

- The organize request reaches the configured Google model and the displayed draft is that response.
- The edit is retained in the saved local record.
- Saving requires an explicit action; canceling does not save a generated draft.
- The question uses only the checked records and requires explicit permission to send them.
- The citation opens the intended original record and its quote is present in the supplied evidence.
- The unsupported question has no fabricated answer or citation. If this test fails, fix the prototype before recording that segment.
- The public deployment opens without the developer's authenticated browser session.
- The final exported video is 3–4 minutes as required by the actual submission form; target 195 seconds. Its public link must play without requesting access.

At this draft's update, SDK sign-in and Application Default Credentials setup have completed, but both available active Google Cloud projects have billing disabled. Billing activation, a successful real Gemini request and public deployment remain pending. The final narration must reflect the actual state observed during recording; describe Cloud Run as deployed only after verifying its public URL.

## If AI is unavailable during recording

Show the actual service-unavailable error and the still-working manual save path. That can document graceful failure, but it does **not** demonstrate the required live AI workflow. Keep the submission's live-AI verification pending and do not use a manually written response as if Gemini produced it.
