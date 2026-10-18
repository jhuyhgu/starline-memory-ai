# Submission status and exact missing inputs

Prepared on 18 October 2026. The team's working deadline supplied in this conversation is **19 October 2026 at 02:29, Asia/Shanghai (UTC+08:00)**. Confirm the organizer dashboard's actual cutoff and time zone separately; this document does not establish that external deadline.

## Official rule references

[Themes and requirements](https://aibuildercup.com/themes.html): use Google AI and deploy to Cloud Run or Firebase, prepare English materials, and demonstrate a functioning prototype. The selected theme is **Future of Work & Enterprise Productivity**. Judging weights are technical/Gen AI 40%, alignment/impact 25%, innovation 25%, and experience/design 10%.

[Official FAQs](https://aibuildercup.com/Faqs.html): provide a deployed link, public source repository, deck and public demo shorter than three minutes. The project must be fresh work from the hackathon period. Teams have 2–4 members; participants must meet the 21+, JAPAC and non-student requirements. Registration/team-formation windows are closed according to the page. The registered team and project timing therefore require confirmation, not an inferred eligibility declaration.

The themes page also contains a category list that differs from its six theme headings. Use the actual registered theme field in the organizer dashboard; do not invent a second category or submit under multiple themes.

## Known project values

| Field | Value |
| --- | --- |
| Project title | Starline Memory |
| Chosen theme | Future of Work & Enterprise Productivity |
| Submission language | English |
| Package scope | Only the new isolated `memory-cup/` prototype |
| Proposed hosting | Google Cloud Run |
| AI provider | Google Gemini |
| Public source | https://github.com/jhuyhgu/starline-memory-ai |
| Project description | `project-description.md` |
| Video shot plan | `demo-script.md`, target 2:45 |
| Pitch source text | `pitch-content.md`; must be transferred into the official template |

## Required values and evidence still to obtain

An empty value below is intentional. It is not a usable link or a claim of completion.

| Exact field / evidence | Current status | Source needed |
| --- | --- | --- |
| Registered team name and application/team ID | Not supplied | Organizer dashboard |
| Each registered member's name, role and required contact fields | Not supplied | Actual registered members; do not use fictional demo characters |
| Eligibility and project timing confirmation | Not established here | Submitter's truthful confirmation against the official rules |
| Dashboard deadline and time zone | Not independently confirmed | Organizer dashboard |
| Official pitch template file and required sections | Being obtained by root agent | Organizer-provided file or dashboard download |
| Google Cloud project and deployment region | Not supplied | Root agent's actual deployment |
| Authentication method and enabled model | Not verified | Deployed server configuration and successful live request; no secret values in this file |
| Public prototype URL | Not supplied | Successful Google Cloud deployment and unauthenticated browser check |
| Public GitHub repository URL | Published and public visibility verified on 18 October | https://github.com/jhuyhgu/starline-memory-ai; isolated prototype only |
| Commit/build used in demo and final tests | Initial public source commit `7e8a115`; final demo build still pending | Reconfirm the exact commit after final live verification |
| Actual automated test results | 43 passed, 0 failed, 0 skipped on 18 October | `npm test`; includes 22 backend, 10 frontend and 11 deployment-helper tests; controlled responses do not prove a live model call |
| Real organize and cited-answer walkthrough | Pending credentials and running implementation | Actual Google model interaction and original-record citation check |
| Public video URL and final duration | Not supplied | Final upload with playback checked without a private session; duration <180 seconds |
| Final pitch PDF in official template | Not produced | Filled organizer template, rendered inspection and actual PDF file |
| Final form receipt/status | Not submitted by this documentation task | Organizer confirmation after authorized submission |

## Final inspection sequence

1. Check the registered team, theme, project timing and organizer cutoff. Do not substitute assumptions for an eligibility answer.
2. Run the implemented test commands documented in the README. Save actual results; do not copy projected counts into the form.
3. Configure real Gemini server credentials and verify both organize and selected-record question flows in the browser.
4. Verify a generated date requires user review, cancel does not save, and manual saving remains usable when AI is unavailable.
5. Verify a cited original can be opened, unsupported questions do not fabricate evidence, and no private data or credentials appear in screenshots/logs.
6. Deploy the isolated prototype to Google Cloud and check its public URL without relying on an authenticated developer session. Keep it available during evaluation.
7. Publish only the prototype repository. Exclude the parent repository, identity service, private records, certificates, secrets and local environment files.
8. Record the real prototype using `demo-script.md`; export a video under 180 seconds and verify public playback permissions.
9. Fill the organizer's official pitch template with the prepared text and actual screenshots. Export and visually inspect its PDF; do not submit a self-designed template as official.
10. Populate real evaluation links and the exact required dashboard fields. Inspect the complete form before final submission; retain the actual receipt separately.

## Claim ledger

| Claim | Allowed evidence / boundary |
| --- | --- |
| “Google Gemini is integrated” | Code plus an observed successful real model request; provider configuration alone is insufficient |
| “Deployed on Google Cloud” | Actual deployed service and reachable public URL |
| “Encrypted local vault” | Verified WebCrypto/IndexedDB implementation; browser-held key boundary disclosed |
| “Source-linked answer” | Real response with valid record IDs/quotes and a working original-record interaction |
| “Tested” | Exact commands and observed results for the submitted build |
| “Submitted” | Organizer confirmation, not an open form or uploaded asset |
| Measured savings, accuracy, adoption or business results | Do not claim; no such measurements have been supplied |
