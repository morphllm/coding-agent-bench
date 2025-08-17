#!/usr/bin/env python3
"""
Test script to verify full file generation functionality
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils import get_full_file_generation, calculate_redundant_tokens_full_file, verify_update


def test_full_file_generation():
    # Read a sample file from corpus
    corpus_file = Path("corpus/visualizer.cc")
    if not corpus_file.exists():
        print(f"Error: {corpus_file} not found")
        return
    
    with open(corpus_file, 'r') as f:
        file_contents = f.read()
    
    # Test prompt
    test_prompt = "Add an FPS counter to the HUD text, updated once per frame."
    
    print("Testing Full File Generation")
    print("=" * 60)
    
    # Test with Claude (if API key exists)
    if os.getenv("ANTHROPIC_API_KEY"):
        print("\n[Claude] Testing full file generation...")
        result = get_full_file_generation(
            file_contents[:2000],  # Use smaller content for testing
            test_prompt,
            "claude-sonnet-4-20250514"
        )
        
        print(f"  Generation time: {result['generation_time_ms']:.1f} ms")
        print(f"  Total tokens: {result['total_tokens']}")
        print(f"  Output length: {len(result['edited_content'])} chars")
        
        # Test redundant token calculation
        redundant, total = calculate_redundant_tokens_full_file(
            {"full_file_output": result['edited_content']},
            file_contents[:2000],
            "claude-sonnet-4"
        )
        print(f"  Redundant tokens: {redundant}")
        print(f"  Total tokens (calculated): {total}")
        
        # Test verification
        is_correct = verify_update(
            file_contents[:2000],
            result['edited_content'],
            test_prompt
        )
        print(f"  Verification: {'PASSED' if is_correct else 'FAILED'}")
    
    # Test with OpenAI (if API key exists)
    if os.getenv("OPENAI_API_KEY"):
        print("\n[OpenAI] Testing full file generation...")
        result = get_full_file_generation(
            file_contents[:500],  # Use even smaller content for testing
            "Add a comment at the top",
            "gpt-4o-2024-11-20"
        )
        print(f"  Generation time: {result['generation_time_ms']:.1f} ms")
        print(f"  Total tokens: {result['total_tokens']}")
        print(f"  Output length: {len(result['edited_content'])} chars")
    
    # Test with Gemini (if API key exists)
    if os.getenv("GOOGLE_API_KEY"):
        print("\n[Gemini] Testing full file generation...")
        result = get_full_file_generation(
            file_contents[:500],  # Use smaller content for testing
            "Add a comment at the top",
            "gemini-2.5-flash"
        )
        print(f"  Generation time: {result['generation_time_ms']:.1f} ms")
        print(f"  Total tokens: {result['total_tokens']}")
        print(f"  Output length: {len(result['edited_content'])} chars")
    
    print("\n" + "=" * 60)
    print("Full file generation test complete!")


if __name__ == "__main__":
    test_full_file_generation()
