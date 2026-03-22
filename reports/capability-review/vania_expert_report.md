# Vania Expert Capability Review

Capability under review:

- `backend/capabilities/vania_expert`

Compared against:

- `backend/vania_core/profession_policy.py`
- `backend/vania_core/views.py`
- `backend/vania_core/services.py`
- `backend/vania_core/tests_service.py`
- `frontend/components/canvas/renderers/PatientManagerCanvas.tsx`
- expert canvas tabs and dialogs under `frontend/components/canvas/renderers/tabs`
- `backend/definitions/agents/expert.py`

## 1. Executive Verdict

**Overall status:** `improved after remediation`

The capability remains structurally sound, and the main parity gaps called out in this review have now been narrowed materially. Expert tools now cover roadmap active-session selection plus session deletion, rescue-net management is no longer add-only, the manual medications tab now persists through an explicit backend contract, and test attachments can now be linked to tests from existing case files through the expert tool surface.

## 2. Canvas and Tool Coverage

### Coverage summary

- Shared base profile: `full`
- Case creation/select/rename/delete: `full`
- Clinical summary and forms/tests analysis: `full`
- Forms: `mostly full`
- Tests: `partial`
- Roadmap and sessions: `partial`
- Rescue net tasks: `partial`
- Appendix/library: `partial`
- Medications: `partial`
- Case files: `full`

### What is covered well

- The capability correctly distinguishes shared base profile from case-scoped data in `capability.py`.
- Initial canvas hydration for `VANIA_PATIENT_MANAGER` matches the main expert canvas shape and includes policy payload, selected case, base profile, forms, tests, files, roadmap, tasks, appendix, and medications.
- Tool families are broad enough for an expert agent to do real work in the canvas:
  - profiles
  - case management
  - clinical summary
  - roadmap
  - rescue net
  - appendix
  - medications
  - forms
  - tests
  - files
  - analysis

### Partial or missing parity with the real expert canvas

#### Roadmap and sessions

- AI now has:
  - `manage_roadmap(SET_PHASE, ADD_SESSION, UPDATE_STRATEGY, SET_ACTIVE_SESSION, DELETE_SESSION)`
  - `finalize_session_report(...)`
- Manual canvas still additionally supports:
  - reorder sessions locally in `RoadmapTab.tsx`

**Assessment:** major parity gap closed. Remaining difference is local reorder behavior, which is still not a persisted shared contract.

#### Rescue net

- AI now has:
  - `add_rescue_task(...)`
  - `manage_rescue_task(ADD, UPDATE, SET_STATUS, TOGGLE_STATUS, DELETE)`
- Manual canvas supports the same practical set:
  - add task
  - edit task
  - delete task
  - toggle status

**Assessment:** parity gap closed for the real rescue-net editing workflow.

#### Appendix

- AI has `prescribe_resource(...)`.
- Manual canvas supports adding resources.
- Visitor canvas allows marking resources consumed, but expert-side manual management does not appear to expose edit/delete either.

**Assessment:** adequate for prescribing, but still limited as a full editor surface.

#### Medications

- AI has persisted actions through `manage_medications(ADD, UPDATE, DELETE, REPLACE)` and read via `get_current_medications`.
- Manual `MedicationsTab.tsx` now uses explicit backend endpoints for create/update/delete and updates local canvas state from persisted responses.

**Assessment:** the earlier trust/state mismatch has been closed. AI and manual edits now operate through aligned persisted behavior.

#### Tests and attachments

- AI can add/update/delete tests and read test result bundles.
- AI can now also:
  - attach an existing case file to a test via `manage_clinical_tests(ATTACH_CASE_FILE, ...)`
  - remove a test attachment via `manage_clinical_tests(DELETE_ATTACHMENT, ...)`

**Assessment:** parity is materially improved for the supported shared workflow. The capability can now manage test attachments through the case-file surface without introducing a separate agent-side upload path.

## 3. Prompt Review

### Verdict

The capability prompt additions are mostly explanatory, but not purely explanatory.

### Good parts

- The prompt clearly explains:
  - shared base profile vs case data
  - visibility/privacy model
  - when files should be explored with file tools
  - profession-scoped access
- The prompt additions are aligned with actual data scoping in code.

### Process-implying parts

These lines go beyond explanation and encode flow guidance:

- “If no case is selected yet, create/select one before doing case work.”
- “Always use tools to keep canvas state synchronized.”
- “Use `list_case_files` or `search_case_files` before `read_case_file`.”
- “Read only the minimum relevant excerpts from files...”

These are reasonable safety and state-consistency constraints, but they are still workflow nudges. If your design goal is that capabilities should only describe the workspace and never guide order-of-operations, these lines should move upward into agent system prompts or common runtime guidance.

### Missing vocabulary support

The prompt is English-first and does not explicitly map important Persian UI labels such as:

- `تور نجات`
- `پیوست اندیشه`
- `شیوه و مصرف دارو`
- `علت مراجع و مشاهدات`

The model can still infer some of these from form titles, canvas data, and user context, but explicit bilingual anchoring is incomplete.

### Sufficiency

- Not too thin for system semantics.
- Slightly too prescriptive for a “capability only explains what exists” philosophy.
- Missing a small bilingual vocabulary bridge for high-frequency Persian canvas labels.

## 4. Access and Permission Review

### Verdict

Access control is mostly intact and thoughtfully centralized.

### What aligns correctly

- `profession_policy.py` drives:
  - visible tabs
  - available form keys
  - test mode
  - feature visibility
  - allowed tool families
- `VaniaExpertToolFactory.get_tools(...)` filters tools by allowed family.
- Canvas hydration sanitizes selected-case and base-profile payloads through profession-aware sanitizers.
- Mutating expert tools generally guard:
  - no active patient
  - case editability
  - profession tool-family restrictions

### Profession subtype review

#### Psychiatrist

- Tabs and tools align around summary, roadmap, medications, forms, tests.
- Files, rescue net, and appendix are hidden from both canvas and tool surface.

#### Psychologist

- Tabs and tools align around summary, roadmap, rescue net, appendix, forms, tests.
- Medications and files are hidden from both canvas and tool surface.
- `PSYCHIATRY_V1` is correctly filtered from forms.

#### Lawyer

- Policy is restrictive and mostly consistent:
  - tabs limited to overview and files
  - no tests visible
  - no roadmap/rescue net/appendix/medications
- Tool families permit `forms`, but feature policy disables forms in the canvas and allowed form keys collapse to `BASE_PROFILE_V1`.

**Assessment:** this is logically consistent if “forms” here means only shared base profile. The report should preserve that distinction to avoid a false positive.

#### General doctor

- Tabs limited to overview and files.
- Tests are visible in overview; forms are effectively base-profile only.
- `test_mode` is `exams_only`.
- `manage_clinical_tests` correctly blocks catalog-based tests when `catalog_id` is provided.

**Assessment:** subtype restriction is correctly implemented across policy, tool behavior, and canvas sanitization.

### Read-only shared cases

- Expert mutating tools check case editability through `_ensure_case_editable(...)`.
- Manual backend endpoints also enforce read-only behavior through `CaseService.expert_can_edit_case(...)` or `_resolve_expert_case_scope(...)`.

**Assessment:** read-only enforcement is one of the strongest parts of this capability.

## 5. Data Contract and Backend Match

### What matches well

- Canvas initial state shape matches `PatientManagerState`.
- Form schema tool output matches frontend dynamic-form expectations:
  - `name`
  - `label`
  - `type`
  - `options`
- `submit_clinical_form(...)` uses the same form definitions as the manual form handler flow.
- Test payloads line up with `ClinicalTestsService`.
- File tools line up well with `CaseFilesService`.

### Mismatches

#### Medication contract mismatch

- AI tool contract is persisted and action-based.
- Manual medications tab is local-state based and does not call the backend persistence layer directly.

Impact:

- AI and manual users are not operating against equivalent workflows.
- A human may think they updated medications in the same way the AI does, but current code paths differ.

#### Rescue task contract mismatch

- Manual canvas exposes edit/delete/status toggle.
- AI capability exposes add only.

Impact:

- Agent cannot fully operate as a peer editor of the same rescue-net surface.

#### Test attachment mismatch

- Manual canvas supports attachment upload/delete/download.
- AI can only read test result details, not mutate attachment state.

Impact:

- The agent cannot complete the full real-world clinical test workflow.

#### Roadmap action mismatch

- Manual UI supports active-session selection and session deletion.
- AI does not have equivalent tool actions.

Impact:

- Agent cannot fully manage the same roadmap object the expert can manually manage.

## 6. Issues

### Issue 1

- **severity:** `low`
- **affected area:** roadmap/session parity
- **status:** `mostly fixed`
- **current mismatch:** expert tools now support session deletion and active-session selection; remaining mismatch is manual-only session reorder with no persisted shared contract
- **impact on agent behavior:** minor; session ordering can still diverge if manual local reorder remains non-persisted
- **recommended fix:** either persist reorder as a shared roadmap action or remove/soften the local-only affordance

### Issue 2

- **severity:** `resolved`
- **affected area:** rescue net parity
- **status:** `fixed`
- **implemented change:** added `manage_rescue_task` covering update/delete/status actions while keeping `add_rescue_task` for compatibility
- **impact on agent behavior:** the agent can now act as a full peer on the rescue-net task surface

### Issue 3

- **severity:** `low`
- **affected area:** clinical test attachments
- **status:** `fixed for the intended workflow`
- **implemented change:** AI can now attach existing case files to tests and remove test attachments through the shared case-file workflow
- **impact on agent behavior:** the agent can now collaborate on the supported attachment-management flow without needing a separate upload surface

### Issue 4

- **severity:** `resolved`
- **affected area:** medications parity
- **status:** `fixed`
- **implemented change:** manual medications now persist through explicit backend create/update/delete endpoints
- **impact on agent behavior:** AI and manual edits are behaviorally aligned again

### Issue 5

- **severity:** `low`
- **affected area:** prompt philosophy
- **status:** `improved`
- **implemented change:** prompt wording was softened from procedural nudges toward descriptive constraints
- **impact on agent behavior:** lower risk of capability-layer over-prescription

### Issue 6

- **severity:** `resolved`
- **affected area:** Persian label grounding
- **status:** `fixed`
- **implemented change:** added a short bilingual term map for `تور نجات`, `پیوست اندیشه`, `شیوه و مصرف دارو`, and `علت مراجع و مشاهدات`
- **impact on agent behavior:** shorthand Persian references should now resolve more reliably

## 7. Final Recommendation

**Recommendation:** keep current design and close the last parity edge

The core design did not need a refactor, and the main planned fixes have now landed. The remaining expert-side follow-up worth considering is whether session reorder should become a persisted shared action.
