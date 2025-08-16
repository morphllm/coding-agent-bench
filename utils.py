"""
file to dump functions, keep runner clean
"""

import os
import difflib
import anthropic
import dotenv
from anthropic.types import ToolParam
import json
from openai import OpenAI
import time
import random
from benchmarks.prompts import JUDGMENT_PROMPT
from google import genai
from google.genai import types


dotenv.load_dotenv()
api_key = os.getenv("ANTHROPIC_API_KEY")

client = anthropic.Anthropic(api_key=api_key)

client_morph = OpenAI(
    api_key=os.getenv("MORPH_API_KEY"),
    base_url="https://api.morphllm.com/v1",
)

MORPH_TOOL: ToolParam = {
    "name": "edit_file",
    "description": "Use this tool to make an edit to an existing file.\n\nThis will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.\nWhen writing the edit, you should specify each edit in sequence, with the special comment // ... existing code ... to represent unchanged code in between edited lines.\n\nFor example:\n\n// ... existing code ...\nFIRST_EDIT\n// ... existing code ...\nSECOND_EDIT\n// ... existing code ...\nTHIRD_EDIT\n// ... existing code ...\n\nYou must output as few unchanged lines as possible.\nBut, each edit should contain minimally sufficient context of unchanged lines around the code you're editing to resolve ambiguity, shoot for no more than 1-3 lines above and below the edit but use your discretion.\nDO NOT omit spans of pre-existing code (or comments) without using the // ... existing code ... comment to indicate its absence. If you omit the existing code comment, the model may inadvertently delete these lines, so make sure you use the // ... existing code ...\nIf you plan on deleting a section, you must provide context before and after to delete it. If the initial code is ```code \\n Block 1 \\n Block 2 \\n Block 3 \\n code```, and you want to remove Block 2, you would output ```// ... existing code ... \\n Block 1 \\n  Block 3 \\n // ... existing code ...```.\nMake sure it is clear what the edit should be, and where it should be applied.\nMake edits to a file in a single edit_file call instead of multiple edit_file calls to the same file. The apply model can handle many distinct edits at once.",
    "input_schema": {
        "type": "object",
        "properties": {
            "target_file": {
                "type": "string",
                "description": "The target file to modify.",
            },
            "instructions": {
                "type": "string",
                "description": "A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit. Use the first person to describe what you are going to do. Use it to disambiguate uncertainty in the edit.",
            },
            "code_edit": {
                "type": "string",
                "description": "Specify ONLY the precise lines of code that you wish to edit. NEVER specify or write out unchanged code. Instead, represent all unchanged code using the comment of the language you're editing in - example: // ... existing code ...",
            },
        },
        "required": ["target_file", "instructions", "code_edit"],
    },
}
SR_TOOL: ToolParam = {
    "name": "edit_file",
    "description": "Edit the file by making replacements. CRITICAL: You get ONLY ONE CHANCE to edit - no follow-ups, no corrections. You MUST provide ALL edits as a list of old_string/new_string pairs in a SINGLE tool call. The file will NOT be shown to you again after your edits. Each edit is applied sequentially, so later edits see the results of earlier ones.",
    "input_schema": {
        "type": "object",
        "properties": {
            "edits": {
                "type": "array",
                "description": "List of ALL edits to make. Each edit is applied in order.",
                "items": {
                    "type": "object",
                    "properties": {
                        "old_string": {
                            "type": "string",
                            "description": "The exact string to find and replace. Must be unique and include enough context.",
                        },
                        "new_string": {
                            "type": "string",
                            "description": "The replacement string.",
                        },
                    },
                    "required": ["old_string", "new_string"],
                },
            }
        },
        "required": ["edits"],
    },
}

# ---------------------------------------------------------------------------
# Gemini helpers
# ---------------------------------------------------------------------------

def _convert_tool_for_gemini(tool_def: dict) -> dict:
    """Convert our existing tool spec to Gemini function declaration format."""
    return {
        "name": tool_def["name"],
        "description": tool_def["description"],
        "parameters": tool_def["input_schema"],
    }


def copy_corpus_files(src_dir, dest_dir):
    """
    Copies all files from the source directory to the destination directory.
    """
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            src_file = os.path.join(root, file)
            dest_file = os.path.join(dest_dir, os.path.relpath(src_file, src_dir))
            os.makedirs(os.path.dirname(dest_file), exist_ok=True)
            os.system(f"cp {src_file} {dest_file}")


def get_edit(file_contents, request, edit_type, model_id="claude-sonnet-4-20250514"):
    """based on a defined edit_type, instruction and file contents, get an llm to generate an edit"""
    if edit_type == "morph":
        tool = MORPH_TOOL
        prompt = f"instruction: {request}\n\n file name: day.tsx \n\n file content: {file_contents}"
    elif edit_type == "sr":
        tool = SR_TOOL
        prompt = (
            f"Call the edit_file tool to make the required changes. You have been shown the ENTIRE file content.\n"
            f"CRITICAL INSTRUCTIONS:\n"
            f"1. You have ONLY ONE CHANCE to edit - no follow-ups, no corrections\n"
            f"2. You MUST provide ALL necessary edits in a SINGLE tool call\n"
            f"3. Use the 'edits' array to specify all changes as old_string/new_string pairs\n"
            f"4. The file will NOT be shown to you again after your edits\n"
            f"5. Each edit is applied sequentially, so later edits see the results of earlier ones\n\n"
            f"instruction: {request}\n\n"
            f"file content:\n{file_contents}"
        )
    else:
        raise ValueError(f"Unknown edit_type: {edit_type}")

    stream_start = time.time()

    # Treat OpenAI models that are either prefixed with 'gpt' or shorthand like 'o3', 'o4-mini', this is some questionable code that might cause issues
    if model_id.startswith("o") or "gpt" in model_id:
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        openai_tool = {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["input_schema"],
            },
        }

        response = _retry_on_429(
            openai_client.chat.completions.create,
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
            tools=[openai_tool],
            tool_choice="required",
        )

        stream_end = time.time()

        if response.choices[0].message.tool_calls:
            tool_call = json.loads(
                response.choices[0].message.tool_calls[0].function.arguments
            )
            return tool_call
        else:
            raise ValueError("No tool call in OpenAI response")
    elif "gemini" in model_id:
        # ------------------------------------------------------------------
        # Google Gemini path
        # ------------------------------------------------------------------
        tool = MORPH_TOOL if edit_type == "morph" else SR_TOOL

        function_declarations = [_convert_tool_for_gemini(tool)]
        gemini_tool = types.Tool(function_declarations=function_declarations)
        config = types.GenerateContentConfig(tools=[gemini_tool])

        genai_client = genai.Client()

        response = _retry_on_429(
            genai_client.models.generate_content,
            model=model_id,
            contents=prompt,
            config=config,
        )

        # Gemini returns a list of parts; the first part may contain the function_call
        parts = response.candidates[0].content.parts  # type: ignore[attr-defined]
        if parts and hasattr(parts[0], "function_call") and parts[0].function_call:
            fc = parts[0].function_call  # type: ignore[attr-defined]
            args = fc.args  # May already be dict
            # If args is a string, attempt to parse JSON
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    pass
            return args
        raise ValueError("No tool call in Gemini response")
    else:
        stream = _retry_on_429(
            client.messages.create,
            model=model_id,
            max_tokens=10000,
            tools=[tool],
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            stream=True,
        )

        json_string = ""

        try:
            for event in stream:
                delta = getattr(event, "delta", None)
                if delta is None:
                    continue

                text = getattr(delta, "text", None)
                if text is not None:
                    continue

                partial_json = getattr(delta, "partial_json", None)
                if partial_json is not None:
                    json_string += partial_json
                    continue
        finally:
            stream_end = time.time()

        tool_call = json.loads(json_string)
        return tool_call


def apply_morph_edit(edit, initial_code):
    instructions = edit["instructions"]
    code_edit = edit["code_edit"]

    edit_start = time.time()

    response = _retry_on_429(
        client_morph.chat.completions.create,
        model="morph-v3-large",
        messages=[
            {
                "role": "user",
                "content": f"<instruction>{instructions}</instruction>\n<code>{initial_code}</code>\n<update>{code_edit}</update>",
            }
        ],
    )

    edit_end = time.time()

    # Extract and return the edited content from the response
    edited_content = response.choices[0].message.content
    return edited_content


def apply_sr_edit(edit, initial_code):
    """Apply string-replacement edits returned by the search-and-replace LLM.

    The function attempts to apply **all** edits sequentially. It now also returns a
    *success* flag indicating whether **each** requested replacement was applied
    exactly once.  This allows the benchmark runner to skip the expensive LLM
    validation step whenever the edits could not be cleanly applied (e.g. when
    the *old_string* token is missing or appears more than once).

    Args:
        edit: Dict containing an ``edits`` array of objects with *old_string* and
              *new_string*.
        initial_code: Original file contents.

    Returns:
        Tuple[str, bool]: (updated_code, success) where *success* is ``True`` iff
        every edit was applied uniquely.
    """

    if "edits" not in edit or not isinstance(edit["edits"], list):
        return initial_code, False

    current_code = initial_code
    success = True

    for i, single_edit in enumerate(edit["edits"], 1):
        if "old_string" not in single_edit or "new_string" not in single_edit:
            print(
                f"Edit {i}: Missing required fields 'old_string' or 'new_string'. Marking as failure."
            )
            success = False
            break

        old_str = single_edit["old_string"]
        new_str = single_edit["new_string"]

        occurrences = current_code.count(old_str)

        if occurrences != 1:
            # Either zero or multiple occurrences – consider this a failure.
            print(
                f"Edit {i}: Expected exactly 1 occurrence of old_string, found {occurrences}. Marking as failure."
            )
            success = False
            break

        current_code = current_code.replace(old_str, new_str, 1)

    return current_code, success


def write_new_file(content, filename, workspace_dir="workspace/"):
    """
    Write the morph response content to a file in the workspace directory.

    Args:
        content: The text content to write to the file
        filename: The name of the file to write (e.g., 'day.tsx')
        workspace_dir: The directory to write the file to (default: 'workspace/')

    Returns:
        The full path of the written file
    """
    # Ensure the workspace directory exists
    os.makedirs(workspace_dir, exist_ok=True)

    # Construct the full file path
    file_path = os.path.join(workspace_dir, filename)

    # Write the content to the file
    with open(file_path, "w") as f:
        f.write(content)

    return file_path


def verify_update(original_code, edited_code, update_instruction):
    diff_lines = list(
        difflib.unified_diff(
            original_code.splitlines(keepends=True),
            edited_code.splitlines(keepends=True),
            fromfile="original",
            tofile="updated",
            lineterm="",
        )
    )
    unified_diff = "".join(diff_lines)

    prompt = JUDGMENT_PROMPT.format(
        originalCode=original_code,
        updatedCode=edited_code,
        unifiedDiff=unified_diff,
        updateInstructions=update_instruction,
    )

    try:
        response = _retry_on_429(
            client.messages.create,
            model="claude-3-7-sonnet-20250219",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )

        verdict = response.content[0].text.strip().lower()
        return verdict.startswith("true")

    except Exception:
        return False

###########################################################################
# Retry helper: wait 2–3 minutes on HTTP 429 (rate-limit) then retry
###########################################################################


def _retry_on_429(callable_fn, *args, **kwargs):
    """Invoke *callable_fn* with retry on HTTP 429.

    Sleeps a random 120-180 s before retrying. Retries indefinitely until a
    non-429 response or another exception occurs.
    """

    while True:
        try:
            return callable_fn(*args, **kwargs)
        except Exception as exc:  # OpenAI & Morph both raise OpenAI-style errors
            status = getattr(exc, "status_code", None)
            if status == 429 or exc.__class__.__name__ == "RateLimitError":
                delay = random.randint(120, 180)
                print(f"Rate-limit (429) hit – sleeping {delay}s then retrying…")
                time.sleep(delay)
                continue
            raise
