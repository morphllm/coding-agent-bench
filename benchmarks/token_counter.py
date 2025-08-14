import json
import re
from typing import Dict, Tuple
import tiktoken

def get_tokenizer(model_name: str):
    if "claude" in model_name.lower():
        return tiktoken.get_encoding("cl100k_base")
    elif "gpt" in model_name.lower():
        return tiktoken.get_encoding("cl100k_base")
    else:
        return tiktoken.get_encoding("cl100k_base")

def count_tokens(text: str, model_name: str) -> int:
    tokenizer = get_tokenizer(model_name)
    return len(tokenizer.encode(text))

def calculate_redundant_tokens_morph(response: dict, model_name: str) -> Tuple[int, int]:
    code_edit = response.get("code_edit", "")
    instructions = response.get("instructions", "")
    
    total_tokens = count_tokens(json.dumps(response), model_name)
    
    existing_code_pattern = r"//\s*\.\.\.\s*existing\s+code\s*\.\.\."
    redundant_parts = re.findall(existing_code_pattern, code_edit)
    redundant_text = "".join(redundant_parts)
    
    json_overhead = json.dumps({"instructions": instructions, "code_edit": ""})
    redundant_tokens = count_tokens(redundant_text, model_name) + count_tokens(json_overhead, model_name)
    
    return redundant_tokens, total_tokens

def calculate_redundant_tokens_sr(response: dict, model_name: str) -> Tuple[int, int]:
    edits = response.get("edits", [])
    
    total_tokens = count_tokens(json.dumps(response), model_name)
    
    redundant_tokens = 0
    for edit in edits:
        old_string = edit.get("old_string", "")
        new_string = edit.get("new_string", "")
        
        redundant_tokens += count_tokens(old_string, model_name)
        
        old_lines = old_string.split('\n')
        new_lines = new_string.split('\n')
        
        common_lines = 0
        for old_line, new_line in zip(old_lines, new_lines):
            if old_line.strip() == new_line.strip():
                common_lines += 1
        
        if common_lines > 0:
            common_text = '\n'.join(new_lines[:common_lines])
            redundant_tokens += count_tokens(common_text, model_name)
    
    json_structure = json.dumps({"edits": [{"old_string": "", "new_string": ""}]})
    redundant_tokens += count_tokens(json_structure, model_name)
    
    return redundant_tokens, total_tokens
