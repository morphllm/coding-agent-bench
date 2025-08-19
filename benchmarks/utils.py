"""
Utility functions for the benchmarking system.
Contains functions for running edits, calculating tokens, and verifying results.
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
from benchmarks.prompts import JUDGMENT_PROMPT, get_full_file_prompt
from google import genai
from google.genai import types
import tiktoken


dotenv.load_dotenv()
api_key = os.getenv("ANTHROPIC_API_KEY")

client = anthropic.Anthropic(api_key=api_key)

def count_tokens(text: str) -> int:
    """
    Count tokens in text using tiktoken.
    Uses cl100k_base encoding for consistent counting across all models.
    """
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        return len(text) // 4

client_morph = OpenAI(
    api_key=os.getenv("MORPH_API_KEY"),
    base_url="https://api.morphllm.com/v1",
)

MORPH_TOOL: ToolParam = {
    "name": "edit_file",
    "description": "Use this tool to make an edit to an existing file.\n\nThis will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.\nWhen writing the edit, you should specify each edit in sequence, with the special comment // ... existing code ... to represent unchanged code in between edited lines.\n\nFor example:\n\n// ... existing code ...\nFIRST_EDIT\n// ... existing code ...\nSECOND_EDIT\n// ... existing code ...\nTHIRD_EDIT\n// ... existing code ...\n\nYou must output as few unchanged lines as possible.\nBut, each edit should contain minimally sufficient context of unchanged lines around the code you're editing to resolve ambiguity.\nDO NOT omit spans of pre-existing code (or comments) without using the // ... existing code ... comment to indicate its absence. If you omit the existing code comment, the model may inadvertently delete these lines, so make sure you use the // ... existing code ...\nIf you plan on deleting a section, you must provide context before and after to delete it. If the initial code is ```code \\n Block 1 \\n Block 2 \\n Block 3 \\n code```, and you want to remove Block 2, you would output ```// ... existing code ... \\n Block 1 \\n  Block 3 \\n // ... existing code ...```.\n Be very lazy with the code you write, the more you write the longer the user has to wait. Make the location of the edits clear with some surrounding lines but be as lazy as possible, writing minimal code.\nMake edits to a file in a single edit_file call instead of multiple edit_file calls to the same file. The apply model can handle many distinct edits at once.",
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


# Multi-turn tool definitions
MORPH_TOOL_MULTI: ToolParam = {
    "name": "edit_file",
    "description": "Use this tool to make an edit to an existing file.\n\nThis will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.\nWhen writing the edit, you should specify each edit in sequence, with the special comment // ... existing code ... to represent unchanged code in between edited lines.\n\nFor example:\n\n// ... existing code ...\nFIRST_EDIT\n// ... existing code ...\nSECOND_EDIT\n// ... existing code ...\nTHIRD_EDIT\n// ... existing code ...\n\nYou must output as few unchanged lines as possible.\nBut, each edit should contain minimally sufficient context of unchanged lines around the code you're editing to resolve ambiguity.\nDO NOT omit spans of pre-existing code (or comments) without using the // ... existing code ... comment to indicate its absence. If you omit the existing code comment, the model may inadvertently delete these lines, so make sure you use the // ... existing code ...\nIf you plan on deleting a section, you must provide context before and after to delete it. If the initial code is ```code \\n Block 1 \\n Block 2 \\n Block 3 \\n code```, and you want to remove Block 2, you would output ```// ... existing code ... \\n Block 1 \\n  Block 3 \\n // ... existing code ...```.\n Be very lazy with the code you write, the more you write the longer the user has to wait. Make the location of the edits clear with some surrounding lines but be as lazy as possible, writing minimal code.\nMake edits to a file in a single edit_file call instead of multiple edit_file calls to the same file. The apply model can handle many distinct edits at once.",
    "input_schema": {
        "type": "object",
        "properties": {
            "target_file": {
                "type": "string",
                "description": "The target file to modify.",
            },
            "instructions": {
                "type": "string",
                "description": "A single sentence instruction describing what you are going to do for the sketched edit.",
            },
            "code_edit": {
                "type": "string",
                "description": "Specify ONLY the precise lines of code that you wish to edit. Use // ... existing code ... for unchanged code.",
            },
        },
        "required": ["target_file", "instructions", "code_edit"],
    },
}

SR_TOOL_MULTI: ToolParam = {
    "name": "edit_file",
    "description": "Edit the file by making exactly one replacement per call. Provide a single old_string and new_string. To make multiple edits, call this tool again.",
    "input_schema": {
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


def _convert_tool_for_gemini(tool_def: dict) -> dict:
    """Convert our existing tool spec to Gemini function declaration format."""
    return {
        "name": tool_def["name"],
        "description": tool_def["description"],
        "parameters": tool_def["input_schema"],
    }


def get_single_turn_morph_edit(
    file_contents, request, model_id="claude-sonnet-4-20250514"
):
    """Get an LLM to generate a single-turn morph edit.
    This is only used for single-turn benchmarks comparing morph vs full file generation."""
    tool = MORPH_TOOL
    prompt = f"instruction: {request}\n\n file name: day.tsx \n\n file content: {file_contents}"

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

        response, wait_time_ms = _retry_on_429(
            openai_client.chat.completions.create,
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
            tools=[openai_tool],
            tool_choice="required",
        )

        stream_end = time.time()
        # Subtract wait time from total time
        actual_time = (stream_end - stream_start) * 1000 - wait_time_ms

        if response.choices[0].message.tool_calls:
            tool_call = json.loads(
                response.choices[0].message.tool_calls[0].function.arguments
            )
            # Count tokens in the visible output (the tool call JSON)
            token_count = count_tokens(json.dumps(tool_call))
            return tool_call, token_count
        else:
            raise ValueError("No tool call in OpenAI response")
    elif "gemini" in model_id:
        # ------------------------------------------------------------------
        # Google Gemini path
        # ------------------------------------------------------------------
        tool = MORPH_TOOL

        function_declarations = [_convert_tool_for_gemini(tool)]
        gemini_tool = types.Tool(function_declarations=function_declarations)
        config = types.GenerateContentConfig(tools=[gemini_tool])

        genai_client = genai.Client()

        response, wait_time_ms = _retry_on_429(
            genai_client.models.generate_content,
            model=model_id,
            contents=prompt,
            config=config,
        )

        stream_end = time.time()
        # Subtract wait time from total time
        actual_time = (stream_end - stream_start) * 1000 - wait_time_ms

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
            # Count tokens in the visible output (the tool call JSON)
            token_count = count_tokens(json.dumps(args))
            return args, token_count
        raise ValueError("No tool call in Gemini response")
    else:
        stream, wait_time_ms = _retry_on_429(
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
            # Subtract wait time from total time
            actual_time = (stream_end - stream_start) * 1000 - wait_time_ms

        tool_call = json.loads(json_string)
        # Count tokens in the visible output (the tool call JSON)
        token_count = count_tokens(json.dumps(tool_call))
        return tool_call, token_count


def apply_morph_edit(edit, initial_code):
    """Apply a morph edit using the Morph API.
    Returns: (edited_content, actual_apply_time_ms_excluding_wait)"""
    instructions = edit["instructions"]
    code_edit = edit["code_edit"]

    edit_start = time.time()

    response, wait_time_ms = _retry_on_429(
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
    actual_apply_time = (edit_end - edit_start) * 1000 - wait_time_ms

    # Extract and return the edited content from the response
    edited_content = response.choices[0].message.content
    return edited_content, actual_apply_time


def apply_sr_edit_multi_turn(edit: dict, initial_code: str):
    """Apply a single search-replace edit for multi-turn mode.
    In multi-turn SR, each turn makes exactly one replacement."""
    if (
        not isinstance(edit, dict)
        or "old_string" not in edit
        or "new_string" not in edit
    ):
        return initial_code, False

    old_str = edit["old_string"]
    new_str = edit["new_string"]

    occurrences = initial_code.count(old_str)
    if occurrences != 1:
        return initial_code, False

    return initial_code.replace(old_str, new_str, 1), True


def run_multi_turn_edits(
    original_code: str, request: str, edit_type: str, model_id: str
):
    """Run multi-turn editing process, returning edited code and metrics."""
    current_code = original_code
    iteration = 0
    total_generation_time = 0
    total_apply_time = 0
    total_tokens = 0
    all_responses = []

    while iteration < 10:  # Max 10 iterations to prevent infinite loops
        iteration += 1
        is_first = iteration == 1

        # Get edit from model (get_multi_turn_edit now returns actual time excluding wait)
        tool_call, tokens, gen_time = get_multi_turn_edit(
            current_code, request, edit_type, model_id, iteration, is_first
        )

        # If no tool call, we're done
        if tool_call is None:
            break

        all_responses.append(tool_call)
        total_tokens += tokens

        # Don't count the last confirmation turn
        if iteration < 10:  # Assuming we won't hit the limit
            total_generation_time += gen_time

        # Apply the edit
        if edit_type == "morph":
            updated_code, apply_time = apply_morph_edit(tool_call, current_code)
            if not updated_code or updated_code == current_code:
                break
            current_code = updated_code
        else:  # sr
            apply_start = time.time()
            updated_code, success = apply_sr_edit_multi_turn(tool_call, current_code)
            if not success:
                break
            current_code = updated_code
            apply_time = (
                time.time() - apply_start
            ) * 1000  # SR apply doesn't use API, so no wait time

        total_apply_time += apply_time

    return {
        "edited_code": current_code,
        "total_generation_time_ms": total_generation_time,
        "total_apply_time_ms": total_apply_time,
        "total_tokens": total_tokens,
        "iterations": iteration,
        "responses": all_responses,
    }


def get_full_file_generation(
    file_contents: str, request: str, model_id: str = "claude-sonnet-4-20250514"
):
    """Get full file generation from model without using any editing tools."""
    prompt = get_full_file_prompt(file_contents, request)

    generation_start = time.time()

    # Handle different model types
    if model_id.startswith("o") or "gpt" in model_id:
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Some models (o3, o4-mini) don't support temperature=0
        kwargs = {
            "model": model_id,
            "messages": [{"role": "user", "content": prompt}],
        }
        # Only set temperature for models that support it
        if not (model_id in ["o3", "o4-mini", "gpt-5"]):
            kwargs["temperature"] = 0

        response, wait_time_ms = _retry_on_429(
            openai_client.chat.completions.create, **kwargs
        )

        generation_time = (
            time.time() - generation_start
        ) * 1000 - wait_time_ms  # ms, excluding wait time
        edited_content = response.choices[0].message.content
        # Count tokens in the visible output (generated file content)
        total_tokens = count_tokens(edited_content)

    elif "gemini" in model_id:
        genai_client = genai.Client()

        response, wait_time_ms = _retry_on_429(
            genai_client.models.generate_content,
            model=model_id,
            contents=prompt,
        )

        generation_time = (
            time.time() - generation_start
        ) * 1000 - wait_time_ms  # ms, excluding wait time
        edited_content = (
            response.text
            if hasattr(response, "text")
            else response.candidates[0].content.parts[0].text
        )
        # Count tokens in the visible output (generated file content)
        total_tokens = count_tokens(edited_content)

    else:  # Claude - use streaming for full file generation
        edited_content = ""

        # Use streaming to avoid timeout for long responses
        stream, wait_time_ms = _retry_on_429(
            client.messages.create,
            model=model_id,
            max_tokens=10000,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )

        for event in stream:
            if hasattr(event, "delta"):
                delta = event.delta
                if hasattr(delta, "text") and delta.text:
                    edited_content += delta.text

        generation_time = (
            time.time() - generation_start
        ) * 1000 - wait_time_ms  # ms, excluding wait time

        # Count tokens in the visible output (generated file content)
        total_tokens = count_tokens(edited_content)

    return {
        "edited_content": edited_content,
        "generation_time_ms": generation_time,
        "total_tokens": total_tokens,
        "response_data": {
            "full_file_output": edited_content[:500] + "..."
            if len(edited_content) > 500
            else edited_content
        },
    }


def verify_update(original_code, edited_code, update_instruction):
    """Verify if the update was correctly applied.

    For full file generation, the diff might be very large since the entire file
    is regenerated. The judge looks at both versions and the user request.
    """
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

    # For very large diffs (full file generation), truncate to avoid token limits
    max_diff_lines = 500
    diff_lines_list = unified_diff.split("\n")
    if len(diff_lines_list) > max_diff_lines:
        # Keep first and last parts of diff
        truncated_diff = (
            "\n".join(diff_lines_list[: max_diff_lines // 2])
            + "\n\n... [diff truncated - "
            + str(len(diff_lines_list) - max_diff_lines)
            + " lines omitted] ...\n\n"
            + "\n".join(diff_lines_list[-max_diff_lines // 2 :])
        )
        unified_diff = truncated_diff

    prompt = JUDGMENT_PROMPT.format(
        originalCode=original_code,
        updatedCode=edited_code,
        unifiedDiff=unified_diff,
        updateInstructions=update_instruction,
    )

    try:
        response, _ = _retry_on_429(
            client.messages.create,
            model="claude-3-7-sonnet-20250219",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )

        verdict = response.content[0].text.strip().lower()
        return verdict.startswith("true")

    except Exception:
        return False


def _retry_on_429(callable_fn, *args, **kwargs):
    """Invoke *callable_fn* with retry on HTTP 429.

    Returns tuple: (result, wait_time_ms) where wait_time_ms is the total time spent waiting for rate limits.
    """
    total_wait_time = 0

    while True:
        try:
            result = callable_fn(*args, **kwargs)
            return result, total_wait_time * 1000  # Convert to ms
        except Exception as exc:
            status = getattr(exc, "status_code", None)
            if status == 429 or exc.__class__.__name__ == "RateLimitError":
                delay = random.randint(120, 180)
                print(f"Rate-limit (429) hit – sleeping {delay}s then retrying…")
                time.sleep(delay)
                total_wait_time += delay
                continue
            raise


def get_multi_turn_edit(
    file_contents,
    request,
    edit_type,
    model_id="claude-sonnet-4-20250514",
    iteration=1,
    is_first=True,
):
    """Get an LLM to generate a multi-turn edit (morph or SR).
    Used in multi-turn mode for iterative editing with conversation context.
    Returns: (tool_call, tokens, generation_time_ms_excluding_wait)"""
    if edit_type == "morph":
        tool = MORPH_TOOL
        if is_first:
            system_prompt = (
                "You will produce a comprehensive edit to satisfy the user's prompt.\n"
                "Make all necessary changes in a SINGLE edit_file tool call with a code_edit that addresses all parts of the user prompt, failing to do this will result in the user waiting longer\n"
                "Aim to make all edits required to satisfy the users request. The file will be shown to you again for verification/further edits regardless\n\n"
            )
            prompt = f"User prompt: {request}\n\nFile content:\n{file_contents}"
        else:
            system_prompt = (
                "Verify if the file now satisfies the user's prompt.\n"
                "If further edits are necessary, make them in a single tool call.\n"
                "If the minimum requirement is met, do not call any tool.\n\n"
            )
            prompt = f"Here is the updated file, please verify.\n\nUser prompt (unchanged): {request}\n\nFile content:\n{file_contents}"
    elif edit_type == "sr":
        tool = SR_TOOL_MULTI
        if is_first:
            system_prompt = (
                "Apply the following edit based on the user prompt to the provided file.\n"
                "Use the edit_file tool to make exactly one replacement per call (one old_string and one new_string).\n"
                "Plan to satisfy the prompt with the minimum number of calls.\n"
                "If the minimum requirement is already satisfied by the current file, do not call any tool.\n\n"
            )
            prompt = f"User prompt: {request}\n\nFile content:\n{file_contents}"
        else:
            system_prompt = (
                "Continue applying edits if necessary.\n"
                "Use the edit_file tool to make exactly one replacement per call.\n"
                "If the minimum requirement is already satisfied, do not call any tool.\n\n"
            )
            prompt = f"Here is the updated file, please continue.\n\nUser prompt (unchanged): {request}\n\nFile content:\n{file_contents}"
    else:
        raise ValueError(f"Unknown edit_type: {edit_type}")

    # Track start time for timing calculations
    start_time = time.time()

    # Handle different model types
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

        response, wait_time_ms = _retry_on_429(
            openai_client.chat.completions.create,
            model=model_id,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            tools=[openai_tool],
            tool_choice="auto",
        )

        actual_time = (time.time() - start_time) * 1000 - wait_time_ms

        if response.choices[0].message.tool_calls:
            tool_call = json.loads(
                response.choices[0].message.tool_calls[0].function.arguments
            )
            # Count tokens in the visible output
            token_count = count_tokens(json.dumps(tool_call))
            return (
                tool_call,
                token_count,
                actual_time,
            )
        else:
            return (
                None,
                0,
                actual_time,
            )

    elif "gemini" in model_id:
        function_declarations = [_convert_tool_for_gemini(tool)]
        gemini_tool = types.Tool(function_declarations=function_declarations)
        config = types.GenerateContentConfig(tools=[gemini_tool])

        genai_client = genai.Client()
        full_prompt = system_prompt + "\n\n" + prompt

        response, wait_time_ms = _retry_on_429(
            genai_client.models.generate_content,
            model=model_id,
            contents=full_prompt,
            config=config,
        )

        parts = response.candidates[0].content.parts
        if parts and hasattr(parts[0], "function_call") and parts[0].function_call:
            fc = parts[0].function_call
            args = fc.args
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    pass
            # Count tokens in the visible output
            token_count = count_tokens(json.dumps(args))
            actual_time = (time.time() - start_time) * 1000 - wait_time_ms
            return args, token_count, actual_time
        actual_time = (time.time() - start_time) * 1000 - wait_time_ms
        return None, 0, actual_time

    else:  # Claude
        stream, wait_time_ms = _retry_on_429(
            client.messages.create,
            model=model_id,
            max_tokens=10000,
            tools=[tool],
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )

        json_string = ""

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

        actual_time = (time.time() - start_time) * 1000 - wait_time_ms

        if json_string:
            tool_call = json.loads(json_string)
            # Count tokens in the visible output
            token_count = count_tokens(json.dumps(tool_call))
            return tool_call, token_count, actual_time
        return None, 0, actual_time
