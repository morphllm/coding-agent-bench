def get_morph_prompt(file_contents: str, filename: str, query: str) -> str:
    return f"instruction: {query}\n\nfile name: {filename}\n\nfile content: {file_contents}"

def get_sr_prompt(file_contents: str, query: str) -> str:
    return (
        f"Call the edit_file tool to make the required changes. You have been shown the ENTIRE file content.\n"
        f"CRITICAL INSTRUCTIONS:\n"
        f"1. You have ONLY ONE CHANCE to edit - no follow-ups, no corrections\n"
        f"2. You MUST provide ALL necessary edits in a SINGLE tool call, do not stop until all required edits have been provided\n"
        f"3. Use the 'edits' array to specify all changes as old_string/new_string pairs\n"
        f"4. The file will NOT be shown to you again after your edits, do not look for confirmation\n"
        f"5. Each edit is applied sequentially, so later edits see the results of earlier ones\n\n"
        f"instruction: {query}\n\n"
        f"file content:\n{file_contents}"
    )

JUDGMENT_PROMPT = """You are an expert code reviewer and judge. Your task is to evaluate whether a code update was applied correctly based on the given instructions.

You will be provided with:
1. **Original Code**: The starting code
2. **Update Instructions**: What changes were requested
3. **Unified Diff**: The exact changes made (showing additions and deletions)

**Your job is to determine if the update was applied correctly and completely.**

## Evaluation Criteria:
- **Correctness**: Does the `Unified Diff` perfectly and completely implement every change described in the `update_snippet`?
- **Precision**: Are ONLY the changes requested in the update instructions applied, nothing else?
- **Code Quality**: Do the changes maintain syntactic correctness?
- **Preservation**: Are unrelated parts of the code left untouched?

## Response Format:
You MUST respond with a JSON object containing:
- **reasoning**: string (detailed explanation of your assessment)
- **language**: string ("python", "typescript", "javascript", ...)
- **difficulty**: number (0-100, your assessment of the difficulty of the code application task)
- **issues**: list of strings (categorizing any specific issues found). If the update is correct, this should be an empty list. If incorrect, choose from the suggested list, or create a new descriptive tag if none apply: `logic-error`, `footer-truncation`, `extraneous-code`, `syntax-error`, `breaking-change`, `import-error`, `misinterpretation`, `malformed-output`, `deletion-error`, `incomplete-logic`.
- **isCorrect**: boolean (true if update was applied correctly)
- **confidence**: number (0-100, your confidence level)
- **feedback**: string (specific feedback on what was done well or what needs improvement)

## Examples of Correct Updates:
- All requested changes are visible in the diff
- Only the specified modifications are made
- Code syntax remains valid after changes
- Logic flow is maintained
- No unintended side effects
- Respect all changes shown in `update_snippet` which might be missed by the `user_instruction`

## Examples of Incorrect Updates:
- Missing requested changes (not shown in diff)
- Extra unrelated changes in the diff
- Syntax errors introduced by the changes
- Logic broken by the modifications
- Partial implementation of instructions

Be thorough but concise in your analysis. Focus on whether the diff accurately reflects the requested changes.
Remember you are ONLY evaluating the correctness of the final output code, not the "quality" of the update snippet - which may be noisy.
---

**Original Code:**
```
{originalCode}
```

**Update Instructions:**
{updateInstructions}

**Unified Diff:**
```diff
{unifiedDiff}
```

Evaluate this update and respond with the JSON object as specified above."""