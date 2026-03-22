# Vania Visitor Capability Review

Capability under review:

- `backend/capabilities/vania_visitor`

Compared against:

- `backend/vania_core/profession_policy.py`
- `backend/vania_core/views.py`
- `backend/vania_core/patient_service.py`
- `backend/vania_core/tests_service.py`
- `frontend/components/canvas/renderers/PatientJourneyCanvas.tsx`
- visitor canvas tabs under `frontend/components/canvas/renderers/patient`
- `backend/definitions/agents/visitor.py`

## 1. Executive Verdict

**Overall status:** `improved after remediation`

The visitor capability is coherent and safe at the data-scoping level, and the major parity gaps called out here have been narrowed. The visitor library tab now persists completion, visitor AI can collaborate on case sharing, visitor AI can update test result text, and the tool surface is filtered against the active case profession policy instead of staying fully broad.

## 2. Canvas and Tool Coverage

### Coverage summary

- Visitor/base profile and active expert profile: `full`
- Case selection and journey loading: `full`
- Task completion: `full`
- Resource completion: `full`
- Session reflection: `partial`
- Medications read access: `full`
- Test result inspection: `full`
- Case files: `full`
- Case sharing: `full`

### What is covered well

- `get_initial_canvas_state(...)` for `VANIA_PATIENT_JOURNEY` matches the visitor canvas state model.
- Selected case, selected doctor, visible tabs, feature policy, base profile, forms, tests, library, tasks, medications, timeline, and files are all hydrated into the canvas.
- Visitor tools align with the companion role:
  - inspect profiles
  - load current journey
  - switch case
  - complete task
  - mark resource consumed
  - reflect on latest session
  - view medications
  - inspect test result details
  - update test result text
  - inspect and manage case sharing
  - browse/search/read case files

### Partial or missing parity with the real visitor canvas

#### Library completion mismatch

- AI has persisted `mark_resource_consumed(...)`.
- `PatientLibraryTab.tsx` now persists resource completion through the backend appendix status path.

**Assessment:** this parity defect has been fixed.

#### Tests workflow mismatch

- Visitor manual UI supports:
  - updating test result text
  - uploading test files
  - downloading attachments
- Visitor AI now has:
  - `get_my_test_result_details(...)`
  - `update_my_test_result(...)`

**Assessment:** visitor AI now participates in the intended test-result workflow by inspecting and updating the result text.

#### Case sharing missing from AI

- Manual visitor canvas supports:
  - view share options
  - grant read-only access
  - update current shares
- Visitor AI now has:
  - `list_case_share_options(...)`
  - `manage_case_share(GRANT_READ_ONLY|REVOKE_READ_ONLY, ...)`

**Assessment:** this collaboration gap has been fixed.

#### Session reflection

- AI has `reflect_on_session(...)`, which reads only the latest session summary/flashcards.
- Manual visitor timeline exposes broader historical session browsing.

**Assessment:** useful but narrower than the full timeline surface.

## 3. Prompt Review

### Verdict

The prompt additions are mostly explanatory, with some mild process guidance.

### Good parts

- Clear explanation of:
  - shared base profile vs selected case
  - medication read-only behavior
  - case files and test-result inspection
  - active expert profile vs visitor profile
- The capability does not over-prescribe a therapeutic process.

### Process-implying parts

These lines previously implied operating order, but the current wording is softer and more descriptive.

This is now closer to a descriptive capability contract.

### Persian terminology grounding

The visitor capability now includes a short bilingual bridge for major Persian labels. Examples:

- `تور نجات من`
- `کتابخانه`
- `مسیر من`
- `شیوه و مصرف دارو`

This should improve reliability for shorthand Persian references.

### Sufficiency

- Strong enough to describe the visitor workspace.
- Not too heavy on process.
- Could benefit from a compact Persian term map.

## 4. Access and Permission Review

### Verdict

Visitor-side access is generally intact and aligns with the selected case model.

### What aligns correctly

- Visitor canvas hydration applies profession-based sanitization using the selected expert profession.
- Visitor-visible tabs and sections are filtered through `build_canvas_policy_payload(...)`.
- Hidden expert subtype features are largely hidden from the visitor AI too because the capability sanitizes:
  - tasks
  - library
  - medications
  - timeline
  - files
  - forms/tests analysis
  - clinical summary
- Medication access is correctly read-only in the capability prompt and tool surface.

### Profession subtype review from the visitor side

#### Psychiatrist cases

- Visitor tabs show overview, medications, timeline.
- Library, rescue net, and files are disabled by policy.
- Visitor tool surface does not explicitly profession-filter tools, but the hydrated state is sanitized and unsupported surfaces disappear from state.

**Assessment:** mostly correct, but note that generic visitor tools like `mark_resource_consumed` still exist even when the hydrated library is empty. That is not a direct permission leak because the backend resource lookup still depends on selected-case library contents, but it is looser than the expert tool-family filtering model.

#### Psychologist cases

- Visitor tabs include overview, rescue net, timeline, library.
- Medications are hidden from state by policy.

**Assessment:** consistent with hydration behavior.

#### Lawyer and general doctor cases

- Visitor tabs collapse heavily.
- Forms/tests analysis is hidden.
- Non-applicable surfaces are sanitized away.

**Assessment:** subtype restrictions are respected at the state level.

### Access-model improvement

The visitor capability now filters the actual tool list by the selected-case profession policy, instead of relying only on sanitized state plus downstream backend checks.

Impact:

- Better symmetry with the expert capability model.
- Tighter alignment between the visible workspace and the tool surface.

## 5. Data Contract and Backend Match

### What matches well

- Initial state shape matches `PatientJourneyState`.
- `load_my_journey(...)` and hydration both rely on the same overall snapshot model.
- Task completion aligns with the backend complete-task endpoint behavior.
- File browsing tools map cleanly to `CaseFilesService`.
- Medication read tool aligns with backend plan retrieval.

### Mismatches

#### Library persistence mismatch

- AI `mark_resource_consumed(...)` persists through `AppendixService.update_resource_status(...)`.
- `PatientLibraryTab.tsx` now persists through the same backend appendix status path.

Impact:

- Human and AI now work on the same persisted library state.

#### Tests participation mismatch

- Manual visitor canvas can update tests and upload files.
- Visitor AI can now submit test result updates.

Impact:

- The AI can help with the intended visitor-facing test-result workflow.

#### Case sharing missing

- Manual visitor canvas calls backend share endpoints.
- Capability now exposes case-share discovery and grant/revoke tools.

Impact:

- The AI can now collaborate on a real visitor workspace feature that exists in the canvas.

#### Tool filtering asymmetry

- Expert capability filters tools by profession/tool family.
- Visitor capability now filters tools against the active-case profession/tool-family policy.

Impact:

- The visitor AI is less likely to “see” tools for surfaces hidden by profession policy.

## 6. Issues

### Issue 1

- **severity:** `resolved`
- **affected area:** visitor library parity
- **status:** `fixed`
- **implemented change:** the visitor library tab now persists completion through the backend appendix status path
- **impact on agent behavior:** AI and human users now collaborate on the same real library state

### Issue 2

- **severity:** `resolved`
- **affected area:** case sharing parity
- **status:** `fixed`
- **implemented change:** added visitor tools for listing case-share options and granting/revoking read-only access
- **impact on agent behavior:** the visitor agent can now help with a real canvas feature

### Issue 3

- **severity:** `low`
- **affected area:** tests workflow parity
- **status:** `fixed for the intended workflow`
- **implemented change:** visitor AI can now inspect and update test result text
- **impact on agent behavior:** AI support now covers the intended collaborative part of the visitor test workflow

### Issue 4

- **severity:** `resolved`
- **affected area:** permission model strictness
- **status:** `fixed`
- **implemented change:** visitor tools are now filtered by active-case profession/tool family
- **impact on agent behavior:** tighter alignment between visible workspace features and available tools

### Issue 5

- **severity:** `low`
- **affected area:** prompt philosophy
- **status:** `improved`
- **implemented change:** prompt wording was softened away from explicit sequencing nudges
- **impact on agent behavior:** lower capability-layer prescriptiveness

### Issue 6

- **severity:** `low`
- **affected area:** Persian label grounding
- **status:** `fixed`
- **implemented change:** added a bilingual term map for `تور نجات من`, `کتابخانه`, `مسیر من`, and `شیوه و مصرف دارو`
- **impact on agent behavior:** shorthand user references should be handled more reliably

## 7. Final Recommendation

**Recommendation:** keep current design

The visitor capability is directionally correct and the main planned fixes have now landed. The remaining notable gap is the narrower session-reflection surface compared with full manual timeline browsing.
