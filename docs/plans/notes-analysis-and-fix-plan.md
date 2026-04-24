# Notes Analysis And Fix Plan

## Purpose

This document consolidates the reported product notes, the later clarification note, and the code-level interpretation of what they most likely mean in the current Vania V2 implementation.

This is not an implementation document yet. It is a clean diagnosis and planning artifact that separates:

- confirmed issues
- likely UX/responsive issues
- policy or product-model decisions
- notes that were clarified and should not be interpreted literally anymore

## Source Notes

### Earlier notes

1. `در بخش تنظیمات ، مکان متخصص تمام استان ها و شهرها گنجانده نشده`
2. `بخش حقوقی کامل بررسی شد موارد برای تمام بخش ها مکان متخصص شامل تمام شهر ها شود فایل فعلی فقط تهران را شمال می شود`
3. `بعد ارسال فایل حقوقی توسط متخصص برای کاربر در بخش متخصصان ظاهر شد اما در مسیر متن روند فعالیت وکیل مانند نمونه دادخواست دیده نشده و یا امکان بارگذاری مدارک مورد نیاز برای وکیل از طریق موکل وجود ندارد و همچنان وکیل باید مدارک را خود بارگذاری نماید اگر امکان بارگذاری مدارک توسط موکل وجود داشته باشد بیشتر استقبال خواهد شد`
4. `در بخش روانپزشکی جلسه دارو درمانی بسیار عالی بود فایل و تجویز دارو به خوبی انجام شد ولی برای مراجع ارسال نشده است ؛ در بخش مسیر من همانند مسیر روانشناس باید برای خدمات حقوقی ، روانپزشکی و متخصصان هر کدام به صورت مجزا مسیر مشخص شود تا مراجع امکان مطالعه و دسترسی به آنها را داشته باشد`
5. `در بخش پرونده مراجع یا مسیر من امکان دیدن خدمت و یا توصیه هر متخصص به صورت جداگانه وجود داشته باشد حال وقتی با بخش پرونده مراجع چث می کنم هست ولی دسترسی به خدمت رو ندارم نکات لازم برای فایل ارسالی متخصص روانشناس شامل فایل پشتیبان جلسه، تور نجات ، تست های ارجاعی و پیوست اندیشه است ؛ برای وکیل شامل دادخواست یا متن ارسالی به دادگاه ، توصیه وکیل ، فایل های درخواستی وکیل که توسط موکل باید بارگذاری شود ؛ برای روانپزشک شامل نسخه ، شیوه مصرف دارو ، توصیه ها ؛ برای هر پزشک شامل نسخه ، شیوه مصرف دارو و توصیه ها همه موارد هست ولی در گوشی قابل دیدن نیست چون با سایز گوشی فیکس نمیشه`
6. `بعد از هر با ضبط اتوماتیک ران میشه و امکان گفتگوی طولانی چند سوال را در زمان مصاحبه و جلسه فراهم نمی کنه در گام واسط ما حداقل چند سوال می پرسیم و با تایپ یا ضبط های دو دقیقه ای بعد ارسال می کنیم و گام واسط تحلیل میشه و بر اساس آن وارد مرحله دوم میشیم این به محض توقف دکمه ضبط و دوباره استارت آن گام واسط را شروع می‌کنه`

### Clarification note

1. `تایتل "روانشناس" بشه "روانشناس و مشاور" هر جایی که داریم`
2. `پی دی اف بعضی وقتا اپلود نمیشه یا خونده نمیشه ولی بعضی وقتا هم اوکیه`
3. `جایی که عکس اپلود میکنیم پریویوی عکس رو نشون میدیم ولی پی دی اف رو نه، پریویوی پی دی اف رو هم نشون بدیم`
4. `برای بحث "بعد از هر با ضبط اتوماتیک ران میشه و امکان گفتگوی طولانی چند سوال را در زمان مصاحبه و جلسه فراهم نمی کنه" منظور اینه که شبیه به مودال "علت مراجع و مشاهدات" که میشه چند تا ویس ضبط کرد و تبدیل به متن کرد، توی خود قسمت چت با ایجنت ها هم یه همچین حالتی باشه که بشه چند تا ویس ریکورد کرد و تبدیل به متن کرد و متن رو هم ویرایش کرد و بعدش وا ارسال کنیم به ایجنت`
5. `تو بخش تمامی متخصصان به جای اینکه فقط منطقه های تهران رو داشته باشیم که ناقص هم هست، کامل تر بشه و بتونه تمام استان ها و شهر های ایران رو هم ساپورت بکنه.`
6. `وقتی سرمایه گفتگو تموم میشه یه پاپ اپی چیزی نمایش داده بشه که به طرف بگه تموم شده شارژت و بفرستتش توی صفحه بیلینگ که اعتبار بخره.`
7. `برای بخش هایی که گفته شده مثلا وکیل میتونه فایل اپلود کنه ولی مراجع نمیتونه، در واقع منظور این بوده که صفحه و کانواس مسیر من توی بخش مراجع ریسپانسیو نیست و توی موبایل دیده نمیشه اون فیچر ها، پس اگر فیچرش رو داشتیم مطمئن شو مشکل ریسپانسیو نداریم توی موبایل.`

## Executive Summary

The notes map to six main issue groups:

1. specialist location data is incomplete and Tehran-only
2. chat voice input lacks a multi-record, editable draft flow
3. PDF handling is inconsistent and PDF preview is missing
4. credit exhaustion UX is weak or inconsistent
5. some specialist-specific visitor expectations are blocked by current profession policy
6. several "missing feature" reports are likely mobile responsiveness and discoverability problems, not total feature absence

## What Was Checked

The following areas were inspected to interpret the notes:

- expert canvas and visitor canvas renderers
- `علت مراجع و مشاهدات` modal and audio recorder flow
- chat voice input flow
- profession-specific visitor/expert feature policy
- specialist location source data
- file upload and PDF handling
- billing and usage limit UX paths

Key files that informed this analysis:

- [PatientManagerCanvas.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/PatientManagerCanvas.tsx)
- [ProfileTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/tabs/ProfileTab.tsx)
- [use-audio-recorder.ts](/d:/Projects/VaniaV2/frontend/hooks/use-audio-recorder.ts)
- [voice-input.tsx](/d:/Projects/VaniaV2/frontend/components/assistant-ui/voice-input.tsx)
- [PatientJourneyCanvas.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/PatientJourneyCanvas.tsx)
- [CaseFilesTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/shared/CaseFilesTab.tsx)
- [PatientTestsTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/patient/PatientTestsTab.tsx)
- [attachment.tsx](/d:/Projects/VaniaV2/frontend/components/assistant-ui/attachment.tsx)
- [SimpleThreadAdapters.ts](/d:/Projects/VaniaV2/frontend/lib/SimpleThreadAdapters.ts)
- [thread.tsx](/d:/Projects/VaniaV2/frontend/components/assistant-ui/thread.tsx)
- [billing-utils.ts](/d:/Projects/VaniaV2/frontend/lib/billing-utils.ts)
- [sync.py](/d:/Projects/VaniaV2/backend/definitions/sync.py)
- [profession_policy.py](/d:/Projects/VaniaV2/backend/vania_core/profession_policy.py)
- [patient_service.py](/d:/Projects/VaniaV2/backend/vania_core/patient_service.py)
- [views.py](/d:/Projects/VaniaV2/backend/vania_core/views.py)
- [routes.py](/d:/Projects/VaniaV2/backend/agents/routes.py)

## Issue Group 1: Specialist Location Data Is Incomplete

### Status

Confirmed.

### What exists now

The location list is seeded from a hardcoded set of values in [sync.py](/d:/Projects/VaniaV2/backend/definitions/sync.py). The current `VANIA_LOCATIONS` list only contains Tehran regions and neighborhoods.

Examples from the current seed:

- `تهران - شمال`
- `تهران - مرکز`
- `تهران - شرق`
- `تهران - غرب`
- `سعادت‌آباد / شهرک غرب`
- `پاسداران / دروس`

This location data is used by:

- the public specialist search page
- the expert profile settings modal

Relevant consumers:

- [frontend/app/(dashboard)/dashboard/doctors/find/page.tsx](/d:/Projects/VaniaV2/frontend/app/(dashboard)/dashboard/doctors/find/page.tsx)
- [frontend/components/settings/DoctorProfileModal.tsx](/d:/Projects/VaniaV2/frontend/components/settings/DoctorProfileModal.tsx)
- [backend/vania_core/views.py](/d:/Projects/VaniaV2/backend/vania_core/views.py)

### Root cause

This is primarily a data and UX modeling issue, not a prompt issue.

The backend currently models `Location` as a flat list of names and seeds only a small Tehran-only dataset.

### What needs to change

1. replace the current seed set with a full Iran-wide location dataset
2. decide whether the product should keep a flat list or move to province plus city hierarchy
3. update the expert settings UI and public search UI to support the larger dataset cleanly

### Recommended fix direction

- minimum fix:
  - replace `VANIA_LOCATIONS` with a complete province and city list
- better long-term fix:
  - add province and city as separate fields or at least structured seed data
  - improve search/filter UX for large location sets

## Issue Group 2: Chat Voice UX Needs Multi-Record Drafting

### Status

Confirmed as a product/UX gap.

### Important clarification

The original note sounded like the `علت مراجع و مشاهدات` modal itself was prematurely starting some stage logic. After the clarification, the intent is much clearer:

The request is to bring a similar multi-record workflow into the chat composer itself.

### What exists now

In `علت مراجع و مشاهدات`:

- the user can record multiple voice notes
- each voice note is saved
- each saved note can be transcribed manually
- the transcribed text is appended into the text area
- the combined text can be edited before saving

This flow exists in:

- [ProfileTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/tabs/ProfileTab.tsx)

In chat:

- user records one clip
- stopping recording immediately triggers transcription
- the result is appended to the composer text
- there is no explicit multi-record draft tray or staged send flow

This flow exists in:

- [voice-input.tsx](/d:/Projects/VaniaV2/frontend/components/assistant-ui/voice-input.tsx)

### Root cause

The chat composer voice input is currently designed as a one-shot transcription helper, not as a multi-step interview drafting tool.

The problem is not mainly prompt wording. The missing concept is a draft-oriented voice workflow in chat.

### What needs to change

1. add a chat-side multi-record voice note workflow
2. allow several short recordings to be accumulated before send
3. transcribe each chunk without auto-sending
4. let the user edit the combined text before sending to the agent

### Recommended fix direction

- introduce a "voice draft" composer mode in chat
- separate these actions:
  - start recording
  - stop recording
  - save chunk
  - transcribe chunk
  - edit full draft
  - send final message

### Prompt impact

Prompt change is not the first fix.

Only consider prompt changes later if, after the UX fix, the agent still behaves as if each partial note is enough to move to the next treatment stage.

## Issue Group 3: PDF Handling

This breaks into two separate issues.

### 3A. PDF Preview Is Missing

#### Status

Confirmed.

#### What exists now

In chat attachments:

- images receive a visible preview tile and preview dialog
- PDFs are allowed, but they render as generic file tiles

Relevant files:

- [SimpleThreadAdapters.ts](/d:/Projects/VaniaV2/frontend/lib/SimpleThreadAdapters.ts)
- [attachment.tsx](/d:/Projects/VaniaV2/frontend/components/assistant-ui/attachment.tsx)

#### Root cause

The attachment UI only supports visual preview behavior for `image` attachments. PDFs are treated as generic files.

#### What needs to change

1. add PDF preview representation in the composer and message history
2. show at least a recognizable PDF tile with filename and type
3. optionally support embedded first-page or dialog preview

### 3B. PDF Upload Or Read Reliability Is Inconsistent

#### Status

Likely real and should be treated as an actual reliability bug.

#### What exists now

There are multiple PDF paths in the system:

- chat attachment preparation:
  - [backend/agents/routes.py](/d:/Projects/VaniaV2/backend/agents/routes.py)
- case file extraction:
  - [backend/vania_core/case_files_service.py](/d:/Projects/VaniaV2/backend/vania_core/case_files_service.py)
- test attachment extraction:
  - [backend/vania_core/tests_service.py](/d:/Projects/VaniaV2/backend/vania_core/tests_service.py)

Different code paths use different extraction or ingestion workflows.

#### Root cause

This likely is not one single bug. It may involve:

- malformed PDFs
- extraction fallback differences
- ingestion/storage failure
- content-type validation mismatch
- inconsistent user feedback between upload success and readable extraction success

#### What needs to change

1. investigate PDF failure reasons separately per pipeline
2. improve logging and user-visible error messages
3. distinguish:
  - upload failed
  - upload succeeded but extraction failed
  - upload succeeded and file is only downloadable, not readable

## Issue Group 4: Credit Exhaustion UX

### Status

Likely real.

### What exists now

There are already some limit and billing UX pieces:

- demo-limit banner in chat:
  - [thread.tsx](/d:/Projects/VaniaV2/frontend/components/assistant-ui/thread.tsx)
- generic billing error toast helper for `402`:
  - [billing-utils.ts](/d:/Projects/VaniaV2/frontend/lib/billing-utils.ts)
- transcription endpoint returns `402` when credits are insufficient:
  - [routes.py](/d:/Projects/VaniaV2/backend/agents/routes.py)

### Root cause

The product appears to have some billing/usage handling, but not a single clear and universal "your credits are finished" UX flow in active chat usage.

The user note specifically asks for a popup-like intervention that sends the user to billing.

### What needs to change

1. define a unified credit-exhausted UX
2. trigger it consistently for `402` paths
3. include clear CTA to `/dashboard/billing`

### Recommended fix direction

- show a modal or prominent dialog on credit exhaustion
- use the same pattern for:
  - chat usage exhaustion
  - transcription exhaustion
  - possibly other paid tool actions

## Issue Group 5: Profession Labels And Naming

### Status

Confirmed as a naming and consistency change.

### Clarified request

`روانشناس` should become `روانشناس و مشاور` everywhere it is used as the visible title.

### What exists now

The synced profession source in [sync.py](/d:/Projects/VaniaV2/backend/definitions/sync.py) currently seeds the `psychologist` profession as `روان شناس`.

There are also other scattered UI references to psychologist labels or examples.

### Root cause

This is not an agent-behavior problem. It is a display-label and content consistency problem.

### What needs to change

1. update the synced expert profession display name
2. audit user-facing UI labels and placeholders that say `روانشناس`
3. keep slug and backend logic stable unless there is a larger coordinated rename

### Recommended fix direction

- change visible labels, not slugs
- avoid changing prompts unless the business meaning changes

## Issue Group 6: Visitor Path And Specialist-Specific Visibility

### Status

Mixed.

Some reported gaps are real product limitations. Others are likely current policy behavior. Others are probably responsive-discoverability problems.

### What exists now

Visitor canvas behavior is driven by profession-specific policy in:

- [profession_policy.py](/d:/Projects/VaniaV2/backend/vania_core/profession_policy.py)

Current visitor behavior by profession:

- psychologist:
  - `CASE_OVERVIEW`, `RESCUENET`, `TIMELINE`, `LIBRARY`
  - files disabled
  - medications disabled
- psychiatrist:
  - `CASE_OVERVIEW`, `MEDICATIONS`, `TIMELINE`
  - files disabled
  - rescue net disabled
  - library disabled
- lawyer:
  - `CASE_OVERVIEW`, `FILES`
  - timeline disabled
  - library disabled
- general doctor:
  - `CASE_OVERVIEW`, `FILES`
  - timeline disabled
  - library disabled

Visitor snapshot composition comes from:

- [patient_service.py](/d:/Projects/VaniaV2/backend/vania_core/patient_service.py)

Visitor UI rendering is primarily in:

- [PatientJourneyCanvas.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/PatientJourneyCanvas.tsx)

### Root cause

Several notes assume each specialty should expose a richer visitor-facing "path" or structured artifact area. The current backend profession policy does not yet support that in some specialties.

This means some things are not "broken" in the current implementation. They are simply not modeled or intentionally hidden.

### What needs clarification before coding

The product team needs to decide whether current specialist-specific visitor visibility is correct.

Examples:

- should lawyer cases have a visible legal process timeline or path, not just summary plus files?
- should psychiatrist cases expose more structured visitor-facing materials beyond medications and timeline?
- should psychologist and psychiatrist visitor cases expose shared files, or should files stay disabled?

### What needs to change if product intent stays the same

If current policy is correct, then focus on:

1. improving visitor UI discoverability
2. improving case separation by specialist
3. making outputs easier to find on mobile

### What needs to change if product intent changes

If the business expects richer per-specialty visitor experiences, then:

1. update profession policy
2. add specialty-specific structured artifacts
3. expand visitor canvas tabs and payloads accordingly

## Issue Group 7: Lawyer Uploads, Visitor Uploads, And Mobile Misinterpretation

### Status

Clarified.

### Important clarification

The later note indicates that at least part of the earlier complaint was not "feature absent" but "feature not usable or visible in mobile visitor canvas".

### What exists now

Case files are already supported in the shared file tab:

- [CaseFilesTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/shared/CaseFilesTab.tsx)

Visitor side can access `FILES` when profession policy enables it.

For lawyer and general doctor, visitor `FILES` is enabled.

### Root cause

The likely issue here is:

- mobile layout
- poor discoverability
- tab/action access on small screens

not necessarily missing backend upload capability

### What needs to change

1. verify file upload and download flows on mobile visitor canvas
2. ensure the `FILES` tab is accessible and readable on small screens
3. make sure action buttons remain visible and usable

### Important nuance

For psychologist and psychiatrist visitor cases, file access is currently intentionally disabled by policy. That is a product rule question, not a responsive bug.

## Issue Group 8: Psychiatry Outputs Not Visible To Visitor

### Status

Needs targeted verification, but likely partly a visibility or discoverability issue.

### What exists now

Psychiatrist visitor policy includes:

- case overview
- medications
- timeline

Patient dashboard snapshots include medication data and timeline data:

- [patient_service.py](/d:/Projects/VaniaV2/backend/vania_core/patient_service.py)

Canvas refresh hooks exist after relevant updates:

- [views.py](/d:/Projects/VaniaV2/backend/vania_core/views.py)

### Likely interpretations

The note may mean one of these:

1. the data exists but the visitor cannot find it
2. the user expected a different artifact type than what is currently modeled
3. the mobile UI hides or compresses the relevant content too much
4. the wrong case or doctor context is active

### What needs to change

1. verify psychiatry outputs land in the correct visitor case
2. improve visibility of psychiatry-specific outputs
3. if needed, add clearer per-specialty naming for visitor-facing artifacts

## Issue Group 9: Mobile Responsiveness Of Canvas Features

### Status

Highly likely and probably a major root cause behind multiple notes.

### What exists now

The app supports mobile chat/canvas switching at the page level, but many canvas tabs and dialogs are content-dense and look desktop-oriented.

Potentially affected areas:

- [PatientJourneyCanvas.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/PatientJourneyCanvas.tsx)
- [PatientManagerCanvas.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/PatientManagerCanvas.tsx)
- [CaseFilesTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/shared/CaseFilesTab.tsx)
- [PatientTestsTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/patient/PatientTestsTab.tsx)
- [PatientTimelineTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/patient/PatientTimelineTab.tsx)
- [PatientLibraryTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/patient/PatientLibraryTab.tsx)
- [PatientMedicationsTab.tsx](/d:/Projects/VaniaV2/frontend/components/canvas/renderers/patient/PatientMedicationsTab.tsx)

### Root cause

Multiple notes explicitly say features are there but cannot be seen or used properly on the phone.

### What needs to change

Run a mobile responsiveness and usability pass for canvas flows, especially:

1. tab discoverability
2. action buttons wrapping or overflow
3. dialogs on mobile height
4. upload panels and file lists
5. specialty-specific content readability

## Issue Group 10: Legal Path Or Legal Process View

### Status

Likely a product gap rather than a simple UI bug.

### What the note suggests

The user expects legal cases to expose a more structured progression, similar to how therapy-related specialist outputs can feel like part of a visible path or journey.

### What exists now

Lawyer visitor policy currently exposes:

- case overview
- files

There is no dedicated legal process timeline or structured legal-case progression view in the visitor canvas.

### Root cause

The current product model appears to treat legal outputs primarily as summary plus files. The note suggests that is not enough.

### What needs to change

This needs a product decision:

1. keep legal cases simple as summary plus files
2. or introduce a structured legal path/process tab for the visitor

If option 2 is desired, implementation will need:

- backend payload design
- visitor canvas rendering
- profession policy expansion

## Confirmed Versus Clarified Items

### Confirmed directly in code

- location data is Tehran-only
- chat does not have the same multi-record voice drafting model as the summary modal
- PDF preview is missing in chat attachments
- specialist visibility is heavily controlled by profession policy
- visitor file access exists in some specialties and is disabled in others

### Clarified by the later note

- the voice issue is mainly about chat UX, not about prompt staging alone
- some "visitor cannot upload files" complaints are likely really mobile responsiveness problems
- the location complaint is not just about missing entries, but about full Iran coverage

### Needs product decision before coding

- should lawyer visitors get a structured process/path tab?
- should psychiatrist and psychologist visitor cases expose more or different artifacts?
- should files be enabled for more specialties than they currently are?

## Recommended Implementation Backlog

### Tier 1: High-confidence fixes

1. replace location seed data with full Iran-wide support
2. add chat multi-record voice drafting flow
3. add PDF preview UI
4. harden PDF upload and read reliability
5. add unified credit-exhausted modal or popup with billing redirect
6. update visible label `روانشناس` to `روانشناس و مشاور`
7. run mobile responsiveness pass on visitor and expert canvas flows

### Tier 2: Needs lightweight product confirmation

1. confirm per-specialty visitor visibility expectations
2. confirm whether legal cases need a structured process/path view
3. confirm whether file visibility should expand for psychologist or psychiatrist workflows

## Suggested Ticket Breakdown

### Ticket 1

`Locations: expand specialist location support from Tehran-only to all Iran provinces/cities`

### Ticket 2

`Chat composer: add multi-record voice draft workflow with editable combined text before send`

### Ticket 3

`Attachments: add PDF preview support in composer and message history`

### Ticket 4

`PDF reliability: investigate intermittent upload/read failures across chat, case files, and test attachments`

### Ticket 5

`Billing UX: show unified credit-exhausted popup and route users to billing`

### Ticket 6

`Content consistency: rename visible psychologist label to روانشناس و مشاور`

### Ticket 7

`Canvas mobile audit: fix visitor and expert canvas responsiveness on small screens`

### Ticket 8

`Product decision: define visitor-facing specialty outputs and legal process visibility`

## Final Recommendation

Start implementation with the items that are clearly confirmed and low-risk:

- locations
- chat voice draft UX
- PDF preview and reliability
- billing exhaustion UX
- mobile responsiveness
- visible title rename

Then do a short product clarification pass on specialty-specific visitor visibility before changing profession-policy behavior.
