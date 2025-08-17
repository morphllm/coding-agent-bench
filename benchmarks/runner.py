import os
import sys
import yaml
import json
import shutil
import tempfile
from datetime import datetime
from typing import Dict, List, Any

# Concurrency
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import get_edit, apply_morph_edit, apply_sr_edit, verify_update, run_multi_turn_edits, get_full_file_generation, calculate_redundant_tokens_full_file
from benchmarks.metrics import MetricsCollector, BenchmarkResult, Timer
from benchmarks.token_counter import calculate_redundant_tokens_morph, calculate_redundant_tokens_sr
from benchmarks.prompts import get_morph_prompt, get_sr_prompt

class BenchmarkRunner:
    def __init__(self, config_path: str):
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.metrics_collector = MetricsCollector(
            output_dir=self.config.get('output_dir', 'results/')
        )
        
        self.workspace_dir = "workspace/"
        self.corpus_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.multi_turn = self.config.get('multi_turn', False)
        self.full_file_generation = self.config.get('full_file_generation', False)
    
    def run_all_benchmarks(self):
        models = self.config.get('models', [])
        test_files = self.config.get('test_files', [])

        # Build batches of (model, file) so work can be distributed more evenly
        batches = []  # List[Tuple[dict(test_file), dict(model)]]
        for test_file in test_files:
            for model in models:
                batches.append((test_file, model))

        max_threads = self.config.get('num_threads', min(32, os.cpu_count() or 8))

        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            future_to_batch = {
                executor.submit(self._process_batch, tf, mdl): (tf['path'], mdl['name'])
                for tf, mdl in batches
            }

            # Track progress as each batch finishes
            for idx, future in enumerate(as_completed(future_to_batch), 1):
                path, model_name = future_to_batch[future]
                try:
                    future.result()
                    print(
                        f"✓ Completed {path} with model {model_name} ({idx}/{len(future_to_batch)})"
                    )
                except Exception as e:
                    print(f"✗ Error processing {path} with model {model_name}: {e}")

        # Aggregate & output results once all threads are done
        csv_file = self.metrics_collector.save_to_csv()
        log_file = self.metrics_collector.save_detailed_logs()

        summary = self.metrics_collector.generate_summary()

        if self.full_file_generation:
            # Full file generation mode - show only those results
            print(f"\n{'='*60}")
            print("FULL FILE GENERATION RESULTS")
            print(f"{'='*60}")
            
            for model in summary['summary']:
                if 'full_file_generation' in summary['summary'][model]:
                    ffg = summary['summary'][model]['full_file_generation']
                    print(f"\nModel: {model}")
                    print(f"  Total Tokens: {ffg['avg_total_tokens']:.1f}, Redundant: {ffg['avg_redundant_tokens']:.1f}, Gen Time: {ffg['avg_time_generate_ms']:.1f} ms, Success: {ffg['success_rate']*100:.1f}%")
                    print(f"  (No apply time - generation outputs the complete file)")
        elif summary['comparison']:
            print(f"\n{'='*60}")
            print("COMPARISON (Morph vs Search & Replace)")
            print(f"{'='*60}")

            for model, ratios in summary['comparison'].items():
                morph = summary['summary'][model]['morph']
                sr = summary['summary'][model]['search_replace']

                percent = ratios['redundant_tokens_ratio'] * 100 if ratios['redundant_tokens_ratio'] else 0

                print(f"\nModel: {model}")
                print(f"  Using Morph creates {percent:.1f}% the number of redundant tokens as Search & Replace.")
                
                # Include iterations in output if in multi-turn mode
                if self.multi_turn:
                    print(f"  Morph – Avg Iterations: {morph.get('avg_iterations', 1):.1f}, Total Tokens: {morph['avg_total_tokens']:.1f}, Redundant: {morph['avg_redundant_tokens']:.1f}, Gen Time: {morph['avg_time_generate_ms']:.1f} ms, Apply Time: {morph['avg_time_apply_ms']:.1f} ms, Success: {morph['success_rate']*100:.1f}%")
                    print(f"  S&R  – Avg Iterations: {sr.get('avg_iterations', 1):.1f}, Total Tokens: {sr['avg_total_tokens']:.1f}, Redundant: {sr['avg_redundant_tokens']:.1f}, Gen Time: {sr['avg_time_generate_ms']:.1f} ms, Apply Time: {sr['avg_time_apply_ms']:.1f} ms, Success: {sr['success_rate']*100:.1f}%")
                else:
                    print(f"  Morph – Avg Total Tokens: {morph['avg_total_tokens']:.1f}, Redundant Tokens: {morph['avg_redundant_tokens']:.1f}, Generate Time: {morph['avg_time_generate_ms']:.1f} ms, Apply Time: {morph['avg_time_apply_ms']:.1f} ms, Success: {morph['success_rate']*100:.1f}%")
                    print(f"  S&R  – Avg Total Tokens: {sr['avg_total_tokens']:.1f}, Redundant Tokens: {sr['avg_redundant_tokens']:.1f}, Generate Time: {sr['avg_time_generate_ms']:.1f} ms, Apply Time: {sr['avg_time_apply_ms']:.1f} ms, Success: {sr['success_rate']*100:.1f}%")

        print(f"\n{'='*60}")
        print(f"Results saved to: {csv_file}")
        print(f"Detailed logs saved to: {log_file}")
        print(f"{'='*60}\n")

        return csv_file, log_file, summary

    def _process_batch(self, test_file: Dict, model: Dict):
        """Process a single (file, model) batch across all queries."""
        file_path = os.path.join(self.corpus_dir, test_file['path'])

        if not os.path.exists(file_path):
            print(f"Warning: File {file_path} not found, skipping batch...")
            return

        with open(file_path, 'r') as f:
            file_contents = f.read()

        filename = os.path.basename(file_path)

        for query in test_file['queries']:
            if self.full_file_generation:
                # In full file generation mode, run only the full file test
                self.run_full_file_test(model, file_path, filename, file_contents, query)
            else:
                # Normal mode: run both morph and SR tests
                self.run_morph_test(model, file_path, filename, file_contents, query)
                self.run_sr_test(model, file_path, filename, file_contents, query)
    
    def run_morph_test(self, model: Dict, file_path: str, 
                      filename: str, file_contents: str, query: Dict):
        
        try:
            if self.multi_turn:
                # Multi-turn mode
                result = run_multi_turn_edits(
                    file_contents, query['prompt'], "morph", model['model_id']
                )
                
                edited_content = result["edited_code"]
                generation_time = result["total_generation_time_ms"]
                apply_time = result["total_apply_time_ms"]
                iterations = result["iterations"]
                
                # Calculate redundant tokens across all responses
                redundant_tokens = 0
                total_tokens = result["total_tokens"]
                for response in result["responses"]:
                    r_tokens, _ = calculate_redundant_tokens_morph(response, model['name'])
                    redundant_tokens += r_tokens
                
                edit_response = {"multi_turn_responses": result["responses"], "iterations": result["iterations"]}
            else:
                # Single-turn mode (existing behavior)
                generation_timer = Timer()
                generation_timer.start()
                
                edit_response = get_edit(file_contents, query['prompt'], "morph", model['model_id'])
                
                generation_timer.stop()
                generation_time = generation_timer.get_duration_ms()
                
                apply_timer = Timer()
                apply_timer.start()
                
                edited_content = apply_morph_edit(edit_response, file_contents)
                
                apply_timer.stop()
                apply_time = apply_timer.get_duration_ms()
                
                redundant_tokens, total_tokens = calculate_redundant_tokens_morph(
                    edit_response, model['name']
                )
                iterations = 1  # Single-turn mode has 1 iteration
            
            # Verification only runs once after all edits are complete
            is_correct = verify_update(file_contents, edited_content, query['prompt'])
            
            result = BenchmarkResult(
                benchmark_id="benchmark",
                model=model['name'],
                file=file_path,
                query_id=query['id'],
                method="morph",
                redundant_tokens=redundant_tokens,
                time_generate_ms=generation_time,
                time_apply_ms=apply_time,
                total_tokens=total_tokens,
                timestamp=datetime.now().isoformat(),
                query_prompt=query['prompt'],
                response_data=json.dumps(edit_response),
                is_correct=is_correct,
                iterations=iterations
            )
            
            self.metrics_collector.add_result(result)
            print(
                f"✓ Morph edit completed: {filename} [{query['id']}] with model {model['name']}"
            )
            
            
        except Exception as e:
            print(f"      ✗ Morph test failed: {str(e)}")
    
    def run_sr_test(self, model: Dict, file_path: str,
                   filename: str, file_contents: str, query: Dict):
        
        try:
            if self.multi_turn:
                # Multi-turn mode
                result = run_multi_turn_edits(
                    file_contents, query['prompt'], "sr", model['model_id']
                )
                
                edited_content = result["edited_code"]
                generation_time = result["total_generation_time_ms"]
                apply_time = result["total_apply_time_ms"]
                iterations = result["iterations"]
                success = edited_content != file_contents  # Check if any edits were made
                
                # Calculate redundant tokens across all responses
                redundant_tokens = 0
                total_tokens = result["total_tokens"]
                
                # For multi-turn SR, each response is a single edit
                for response in result["responses"]:
                    # Wrap single edit in array format for token calculation
                    wrapped = {"edits": [response]}
                    r_tokens, _ = calculate_redundant_tokens_sr(wrapped, model['name'])
                    redundant_tokens += r_tokens
                
                edit_response = {"multi_turn_responses": result["responses"], "iterations": result["iterations"]}
            else:
                # Single-turn mode (existing behavior)
                generation_timer = Timer()
                generation_timer.start()
                
                edit_response = get_edit(file_contents, query['prompt'], "sr", model['model_id'])
                
                generation_timer.stop()
                generation_time = generation_timer.get_duration_ms()
                
                apply_timer = Timer()
                apply_timer.start()
                
                edited_content, success = apply_sr_edit(edit_response, file_contents)
                
                apply_timer.stop()
                apply_time = apply_timer.get_duration_ms()
                
                redundant_tokens, total_tokens = calculate_redundant_tokens_sr(
                    edit_response, model['name']
                )
                iterations = 1  # Single-turn mode has 1 iteration
            
            if success:
                # Verification only runs once after all edits are complete
                is_correct = verify_update(file_contents, edited_content, query['prompt'])
            else:
                # Mark as incorrect without validation
                is_correct = False
            
            result = BenchmarkResult(
                benchmark_id="benchmark",
                model=model['name'],
                file=file_path,
                query_id=query['id'],
                method="search_replace",
                redundant_tokens=redundant_tokens,
                time_generate_ms=generation_time,
                time_apply_ms=apply_time,
                total_tokens=total_tokens,
                timestamp=datetime.now().isoformat(),
                query_prompt=query['prompt'],
                response_data=json.dumps(edit_response),
                is_correct=is_correct,
                iterations=iterations
            )
            
            self.metrics_collector.add_result(result)
            status_symbol = "✓" if success else "✗"
            print(
                f"{status_symbol} S&R edit completed: {filename} [{query['id']}] with model {model['name']} (success={success})"
            )
            
            
        except Exception as e:
            print(f"      ✗ S&R test failed: {str(e)}")
    
    def run_full_file_test(self, model: Dict, file_path: str,
                          filename: str, file_contents: str, query: Dict):
        
        try:
            # Get full file generation from model
            result = get_full_file_generation(
                file_contents, query['prompt'], model['model_id']
            )
            
            edited_content = result["edited_content"]
            generation_time = result["generation_time_ms"]
            total_tokens = result["total_tokens"]
            
            # No apply time for full file generation (the generation IS the application)
            apply_time = 0
            
            # Calculate redundant tokens (unchanged portions)
            redundant_tokens, _ = calculate_redundant_tokens_full_file(
                result["response_data"], file_contents, model['name']
            )
            
            # Verify the changes are correct
            is_correct = verify_update(file_contents, edited_content, query['prompt'])
            
            result_obj = BenchmarkResult(
                benchmark_id="benchmark",
                model=model['name'],
                file=file_path,
                query_id=query['id'],
                method="full_file_generation",
                redundant_tokens=redundant_tokens,
                time_generate_ms=generation_time,
                time_apply_ms=apply_time,
                total_tokens=total_tokens,
                timestamp=datetime.now().isoformat(),
                query_prompt=query['prompt'],
                response_data=json.dumps(result["response_data"]),
                is_correct=is_correct,
                iterations=1  # Full file generation is always single-turn
            )
            
            self.metrics_collector.add_result(result_obj)
            print(
                f"✓ Full file generation completed: {filename} [{query['id']}] with model {model['name']}"
            )
            
        except Exception as e:
            print(f"      ✗ Full file generation test failed: {str(e)}")

