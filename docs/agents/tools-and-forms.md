# Tools and Forms

Tools and form handlers let agents perform structured actions through capability domains.

## Tool Sources

Agents can receive tools from several sources:

| Source | Code path | Notes |
| --- | --- | --- |
| Static toolkits | `backend/services/tool_factory.py` | Configured by `AgentDef.static_tools` and synced to `AgentService.static_tools`. |
| Custom tools | `AgentService.custom_tools` and `AvailableTool.import_path` | Admin/database linked Python functions. |
| Global profile tools | `backend/agents/factory.py` | Added to all service agents by the factory. |
| Capability tools | `CapabilityRegistry.get_tools_for_domains(...)` | Domain-specific tools returned by active capabilities. |

## Static Tools

Supported static tool IDs include:

- `duckduckgo`
- `yfinance`
- `calculator`

The `python` static tool choice exists on the model, but do not assume it is runtime-enabled without checking `ToolFactory` and the agent factory.

## Core UI Tools

The `core` capability provides generic chat UI tools:

| Tool | Purpose |
| --- | --- |
| `generate_chart` | Render chart widgets for trends, comparisons, or statistics. |
| `show_data_table` | Render structured tabular data. |
| `show_media_card` | Render image, video, audio, or link cards. |
| `show_option_list` | Render interactive single/multi-choice lists. |

These tools return JSON matching frontend tool UI schemas.

## Vania Expert Tool Families

`vania_expert` tools are grouped by profession policy families. Current families include:

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

Representative expert tools:

- `get_my_expert_profile`
- `get_active_visitor_profile`
- `list_accessible_visitors`
- `select_visitor`
- `list_accessible_cases`
- `get_case_snapshot`
- `create_case`
- `rename_case`
- `delete_case`
- `select_case`
- `update_clinical_summary`
- `manage_roadmap`
- `finalize_session_report`
- `add_rescue_task`
- `manage_rescue_task`
- `prescribe_resource`
- `manage_medications`
- `get_current_medications`
- `get_form_schema`
- `submit_clinical_form`
- `manage_clinical_tests`
- `get_test_result_details`
- `get_test_attachment_details`
- `list_case_files`
- `search_case_files`
- `read_case_file`
- `get_case_file_details`
- `update_forms_tests_analysis`

The final tool list is filtered through profession policy. Do not document a tool as universally available to every expert.

## Vania Visitor Tool Families

`vania_visitor` tools are also filtered by the active case profession policy, with direct account test tools allowed separately.

Representative visitor tools:

- `get_my_visitor_profile`
- `get_active_expert_profile`
- `get_my_cases`
- `get_my_case_snapshot`
- `load_my_journey`
- `select_case`
- `mark_task_complete`
- `mark_resource_consumed`
- `reflect_on_session`
- `get_current_medications`
- `get_my_test_result_details`
- `get_my_test_attachment_details`
- `list_my_interactive_tests`
- `get_my_interactive_test_result`
- `update_my_test_result`
- `list_case_share_options`
- `manage_case_share`
- `list_case_files`
- `search_case_files`
- `read_case_file`
- `get_case_file_details`

## Canvas Updates From Tools

Tools that mutate case, visitor, task, roadmap, test, form, medication, or file state should emit or trigger canvas refresh state where appropriate. The frontend consumes `CANVAS_UPDATE` custom events through `useCanvasSync`.

Do not rely on chat text as the only confirmation for state-changing tool work. Persist the change, refresh canvas state, and then return a short user-facing result.

## Form Handlers

Form handlers are registered with `@register_form_handler` and resolved through `CapabilityRegistry.get_handler`.

Known handlers include:

| Handler | Purpose |
| --- | --- |
| `FeedbackHandler` | Generic feedback logging. |
| `GenericFormHandler` | Saves Vania clinical form submissions. |
| `MarriageAssessmentHandler` | Calculates and saves marriage compatibility assessment results. |

Form definitions reference handlers by name through fields like `handler` or `form_handle`.

## Form Submission Flow

```text
Frontend form
  -> POST /api/services/forms/submit/
  -> SubmitFormView
  -> CapabilityRegistry.get_handler(handler_key)
  -> handler.process(user, data, session_id, resource_id)
  -> structured response
```

`SubmitFormView` accepts `handler`, `form_handle`, or `definition.handler` and reads `resource_id` from `X-Target-Resource-ID` or the request body.

## Error Handling

Form handlers should raise `ValueError` for validation errors. The API returns:

- `400` for missing handler or validation failures.
- `404` when a handler is not registered.
- `500` for unexpected handler exceptions.

## Rules

- Validate tool inputs on the backend.
- Keep role and resource checks close to the action.
- Prefer structured data over free-form strings for state changes.
- Document any tool that mutates persistent data.
- Keep tool payload names stable because prompts and frontend tool surfaces may depend on them.
- Preserve exact enum/action values documented in capability prompts.
- Avoid test-only instructions in production prompts.

## Adding a Tool

1. Implement the tool near the domain it belongs to.
2. Add explicit parameters and a clear docstring.
3. Enforce role, resource, and profession access in code.
4. Add it to the relevant tool factory list.
5. Add it to `TOOL_FAMILY_BY_NAME` if policy filtering applies.
6. Emit canvas updates when persistent state changes.
7. Update capability prompt additions if the model needs exact action values.
8. Add or update tests for permission and payload behavior where feasible.
