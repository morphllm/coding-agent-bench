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

from utils import get_edit, apply_morph_edit, apply_sr_edit, verify_update
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

        if summary['comparison']:
            print(f"\n{'='*60}")
            print("COMPARISON (Morph vs Search & Replace)")
            print(f"{'='*60}")

            for model, ratios in summary['comparison'].items():
                morph = summary['summary'][model]['morph']
                sr = summary['summary'][model]['search_replace']

                percent = ratios['redundant_tokens_ratio'] * 100 if ratios['redundant_tokens_ratio'] else 0

                print(f"\nModel: {model}")
                print(f"  Using Morph creates {percent:.1f}% the number of redundant tokens as Search & Replace.")
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
            self.run_morph_test(model, file_path, filename, file_contents, query)
            self.run_sr_test(model, file_path, filename, file_contents, query)
    
    def run_morph_test(self, model: Dict, file_path: str, 
                      filename: str, file_contents: str, query: Dict):
        
        try:
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
                is_correct=is_correct
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
            
            if success:
                # Only call expensive validation when edits applied cleanly
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
                is_correct=is_correct
            )
            
            self.metrics_collector.add_result(result)
            status_symbol = "✓" if success else "✗"
            print(
                f"{status_symbol} S&R edit completed: {filename} [{query['id']}] with model {model['name']} (success={success})"
            )
            
            
        except Exception as e:
            print(f"      ✗ S&R test failed: {str(e)}")
    

