"""
file to dump functions, keep runner clean
"""

import os
import anthropic
import dotenv
from anthropic.types import ToolParam
import json
from openai import OpenAI
import time


dotenv.load_dotenv()
api_key = os.getenv("ANTHROPIC_API_KEY")

client = anthropic.Anthropic(api_key=api_key)

client_openai = OpenAI(
    api_key=os.getenv("MORPH_API_KEY"),
    base_url="https://api.morphllm.com/v1",
)

MORPH_TOOL: ToolParam = {
    "name": "edit_file",
    "description": "Use this tool to make an edit to an existing file.\n\nThis will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.\nWhen writing the edit, you should specify each edit in sequence, with the special comment // ... existing code ... to represent unchanged code in between edited lines.\n\nFor example:\n\n// ... existing code ...\nFIRST_EDIT\n// ... existing code ...\nSECOND_EDIT\n// ... existing code ...\nTHIRD_EDIT\n// ... existing code ...\n\nYou should still bias towards repeating as few lines of the original file as possible to convey the change.\nBut, each edit should contain minimally sufficient context of unchanged lines around the code you're editing to resolve ambiguity.\nDO NOT omit spans of pre-existing code (or comments) without using the // ... existing code ... comment to indicate its absence. If you omit the existing code comment, the model may inadvertently delete these lines.\nIf you plan on deleting a section, you must provide context before and after to delete it. If the initial code is ```code \\n Block 1 \\n Block 2 \\n Block 3 \\n code```, and you want to remove Block 2, you would output ```// ... existing code ... \\n Block 1 \\n  Block 3 \\n // ... existing code ...```.\nMake sure it is clear what the edit should be, and where it should be applied.\nMake edits to a file in a single edit_file call instead of multiple edit_file calls to the same file. The apply model can handle many distinct edits at once.",
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
    "type": "text_editor_20250728",
    "name": "str_replace_based_edit_tool",
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
            print(f"Copied {src_file} to {dest_file}")


def get_edit(file_contents, request, edit_type):
    """based on a defined edit_type, instruction and file contents, get an llm to generate an edit"""
    stream_start = time.time()
    stream = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=10000,
        tools=[MORPH_TOOL],
        messages=[
            {
                "role": "user",
                "content": f"instruction: {request}\n\n file: {file_contents}",
            }
        ],
        stream=True,
    )

    json_string = ""

    try:
        for event in stream:
            # Only print actual content/tool-input deltas
            delta = getattr(event, "delta", None)
            if delta is None:
                continue

            # Text tokens from the assistant
            text = getattr(delta, "text", None)
            if text is not None:
                # print(text, end="", flush=True)
                continue

            # JSON chunks for tool input (e.g., InputJSONDelta)
            partial_json = getattr(delta, "partial_json", None)
            if partial_json is not None:
                # print(partial_json, end="", flush=True)
                json_string += partial_json
                continue
    finally:
        stream_end = time.time()
        print(f"Stream completed in {stream_end - stream_start:.2f} seconds")
        print("response parsed")

    tool_call = json.loads(json_string)
    # print(tool_call)
    return tool_call


def apply_morph_edit(edit, initial_code):
    instructions = edit["instructions"]
    code_edit = edit["code_edit"]

    with open("edit.txt", "w") as f:
        f.write(code_edit)

    edit_start = time.time()

    response = client_openai.chat.completions.create(
        model="morph-v3-large",
        messages=[
            {
                "role": "user",
                "content": f"<instruction>{instructions}</instruction>\n<code>{initial_code}</code>\n<update>{code_edit}</update>",
            }
        ],
    )

    edit_end = time.time()

    print(response)

    print(f"Edit applied in {edit_end - edit_start:.2f} seconds")

    # Extract and return the edited content from the response
    edited_content = response.choices[0].message.content
    return edited_content


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

    print(f"Written edited content to {file_path}")
    return file_path

