#!/usr/bin/env python3
"""
Test script to verify multi-turn functionality
"""

import os
import sys
import yaml
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils import run_multi_turn_edits


def test_multi_turn():
    # Read a sample file from corpus
    corpus_file = Path("corpus/visualizer.cc")
    if not corpus_file.exists():
        print(f"Error: {corpus_file} not found")
        return
    
    with open(corpus_file, 'r') as f:
        file_contents = f.read()
    
    # Test prompt
    test_prompt = "Add an FPS counter to the HUD text, updated once per frame."
    
    print("Testing Multi-turn Mode")
    print("=" * 60)
    
    # Test with Claude (if API key exists)
    if os.getenv("ANTHROPIC_API_KEY"):
        print("\n[Claude] Testing multi-turn SR...")
        result_sr = run_multi_turn_edits(
            file_contents, 
            test_prompt, 
            "sr", 
            "claude-sonnet-4-20250514"
        )
        print(f"  Iterations: {result_sr['iterations']}")
        print(f"  Generation time: {result_sr['total_generation_time_ms']:.1f} ms")
        print(f"  Apply time: {result_sr['total_apply_time_ms']:.1f} ms")
        print(f"  Total tokens: {result_sr['total_tokens']}")
        print(f"  Code changed: {result_sr['edited_code'] != file_contents}")
        
        print("\n[Claude] Testing multi-turn Morph...")
        result_morph = run_multi_turn_edits(
            file_contents,
            test_prompt,
            "morph",
            "claude-sonnet-4-20250514"
        )
        print(f"  Iterations: {result_morph['iterations']}")
        print(f"  Generation time: {result_morph['total_generation_time_ms']:.1f} ms")
        print(f"  Apply time: {result_morph['total_apply_time_ms']:.1f} ms")
        print(f"  Total tokens: {result_morph['total_tokens']}")
        print(f"  Code changed: {result_morph['edited_code'] != file_contents}")
    
    # Test with OpenAI (if API key exists)
    if os.getenv("OPENAI_API_KEY"):
        print("\n[OpenAI] Testing multi-turn SR...")
        result = run_multi_turn_edits(
            file_contents[:1000],  # Use smaller content for testing
            "Add a comment at the top",
            "sr",
            "gpt-4o-2024-11-20"
        )
        print(f"  Iterations: {result['iterations']}")
        print(f"  Code changed: {result['edited_code'] != file_contents[:1000]}")
    
    # Test with Gemini (if API key exists)
    if os.getenv("GOOGLE_API_KEY"):
        print("\n[Gemini] Testing multi-turn SR...")
        result = run_multi_turn_edits(
            file_contents[:1000],  # Use smaller content for testing
            "Add a comment at the top",
            "sr",
            "gemini-2.5-flash"
        )
        print(f"  Iterations: {result['iterations']}")
        print(f"  Code changed: {result['edited_code'] != file_contents[:1000]}")
    
    print("\n" + "=" * 60)
    print("Multi-turn test complete!")


if __name__ == "__main__":
    test_multi_turn()
