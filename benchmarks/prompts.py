def get_morph_prompt(file_contents: str, filename: str, query: str) -> str:
    return f"Call the morph tool to make the required changes. You must provide ALL edits in a SINGLE tool call. The file will NOT be shown to you again after your edits, do not look for confirmation or ask clarifications. Instruction: {query}\n\nfile name: {filename}\n\nfile content: {file_contents}"

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

JUDGMENT_PROMPT = """You are an expert code reviewer and judge.

Your task: Decide if a patch (shown as a unified diff) has been applied **correctly** to the original code and produced the updated code.
Use the **Update Instructions** only when the diff location or intent is ambiguous.

Output format:
Return ONLY one word on a single line:
TRUE  – if the update is correct.
FALSE – otherwise.
No additional text.

Inputs
------
UPDATE INSTRUCTIONS (for clarification only):
{updateInstructions}

ORIGINAL CODE:
```
{originalCode}
```

UPDATED CODE:
```
{updatedCode}
```

UNIFIED DIFF:
```diff
{unifiedDiff}
```
"""