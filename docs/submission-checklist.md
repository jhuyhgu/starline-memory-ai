# Submission status and exact missing inputs

Updated on 18 October 2026. The actual organizer dashboard deadline observed by the root agent is **19 October 2026 at 02:29 CST, Asia/Shanghai (UTC+08:00)**. This is the current submission cutoff; an open form is not a submission receipt.

## Official rule references

[Themes and requirements](https://aibuildercup.com/themes.html): use Google AI and deploy to Cloud Run or Firebase, prepare English materials, and demonstrate a functioning prototype. The selected theme is **Future of Work & Enterprise Productivity**. Judging weights are technical/Gen AI 40%, alignment/impact 25%, innovation 25%, and experience/design 10%.

[The actual submission dashboard](https://hack2skill.com/event/aibuildercup2026/dashboard) specifies a **3–4 minute demo video**, a **pitch PDF no larger than 5 MB** and a **brief no longer than 1,024 characters**. These concrete form limits take precedence over the older [general FAQ](https://aibuildercup.com/Faqs.html) wording about a video shorter than three minutes. The script now targets 3:15.

The general FAQ also states that the project must be fresh work from the hackathon period, teams have 2–4 members, and participants must meet the 21+, JAPAC and non-student requirements. The team page currently shows no joined team and team formation has ended. Whether the submitter already belongs to a registered team is awaiting the user's answer; do not infer absence of a team, invent members, or declare eligibility.

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
| Implementation baseline | `882c5d9`; later documentation commits do not change the tested implementation baseline |
| Video shot plan | `demo-script.md`, target 3:15 within the form's 3–4 minute range |
| Brief | `project-description.md`, “Submission brief”; at most 1,024 characters |
| Official pitch template | Downloaded as `Submission Template _ AI Builder Cup.pptx`; Google Slides source ID `13rg7vW43mEH6DkpuusAE6fdoEylSFz8waNpE4RLzoUg` |
| Pitch source text | `pitch-content.md`; transfer into the downloaded official template, then export PDF ≤5 MB |

## Required values and evidence still to obtain

An empty value below is intentional. It is not a usable link or a claim of completion.

| Exact field / evidence | Current status | Source needed |
| --- | --- | --- |
| Registered team name and membership | Pending user's answer; dashboard currently shows no joined team and formation has ended | Actual existing registered team; do not invent a new team or members |
| Each registered member's name, role and required contact fields | Not supplied | Actual registered members; do not use fictional demo characters |
| Eligibility and project timing confirmation | Not established here | Submitter's truthful confirmation against the official rules |
| Dashboard deadline and time zone | Observed: 19 October 2026, 02:29 CST / Asia/Shanghai, UTC+08:00 | Actual submission dashboard |
| Official pitch template file and required sections | Official PPTX downloaded; content transfer and final PDF still pending | `Submission Template _ AI Builder Cup.pptx`; resulting PDF must be ≤5 MB |
| Google Cloud billing and deployment region | Both available ACTIVE projects currently have billing disabled; user is arranging activation; region/deployment still pending | Successful billing activation and root agent's actual deployment; no private project IDs recorded here |
| Authentication method and enabled model | SDK sign-in successful and ADC updated; model access and a real request remain unverified | Successful live request after required cloud setup; credentials are not copied into this file |
| Public prototype URL | Not supplied | Successful Google Cloud deployment and unauthenticated browser check |
| Public GitHub repository URL | Published and public visibility verified on 18 October | https://github.com/jhuyhgu/starline-memory-ai; isolated prototype only |
| Commit/build used in demo and final tests | Implementation baseline `882c5d9`; final recorded/demo build still pending | Record later documentation commits separately and reconfirm the exact demo commit after final live verification |
| Actual automated test results | 43 passed, 0 failed, 0 skipped on 18 October | `npm test`; includes 22 backend, 10 frontend and 11 deployment-helper tests; controlled responses do not prove a live model call |
| Real organize and cited-answer walkthrough | Pending billing activation and successful real-model requests; SDK sign-in/ADC setup alone do not establish success | Actual Google model interaction and original-record citation check |
| Public video URL and final duration | Not supplied | Final upload with public playback checked; 3–4 minutes, script target 195 seconds |
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
8. Record the real prototype using `demo-script.md`; export a 3–4 minute video, target 3:15, and verify public playback permissions.
9. Fill the downloaded official pitch template with the prepared text and actual screenshots. Export and visually inspect a PDF no larger than 5 MB; check the brief is at most 1,024 characters. Do not substitute a self-designed deck for the official template.
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
