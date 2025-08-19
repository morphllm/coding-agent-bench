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


def get_full_file_prompt(file_contents: str, query: str) -> str:
    return (
        f"You are given a file and a user request to modify it.\n"
        f"Your task is to output the COMPLETE file with the requested changes applied.\n\n"
        f"CRITICAL INSTRUCTIONS:\n"
        f"1. Output the ENTIRE file - do not skip or abbreviate any sections\n"
        f"2. Do not use ellipsis (...) or placeholders like 'rest of code unchanged'\n"
        f"3. Apply ONLY the changes requested by the user\n"
        f"4. Preserve all functionality that is not related to the user's request\n"
        f"5. Maintain the exact same formatting, style, and structure except where changes are needed\n"
        f"6. If a section is unrelated to the user's request, it must remain EXACTLY as it was\n\n"
        f"User request: {query}\n\n"
        f"Original file content:\n{file_contents}\n\n"
        f"Output the complete modified file below:"
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
