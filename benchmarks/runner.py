import os
import sys
import yaml
import json
import shutil
import tempfile
from datetime import datetime
from typing import Dict, List, Any

# Progress bar library
from tqdm.auto import tqdm

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
        
        
        # Iterate over models with a progress bar
        for model in tqdm(models, desc="Models"):

            # Iterate over test files with a nested progress bar
            for test_file in tqdm(test_files, desc="Test Files", leave=False):
                file_path = os.path.join(self.corpus_dir, test_file['path'])
                
                if not os.path.exists(file_path):
                    print(f"Warning: File {file_path} not found, skipping...")
                    continue
                
                with open(file_path, 'r') as f:
                    file_contents = f.read()
                
                filename = os.path.basename(file_path)
                
                # Progress bar for queries inside each file
                for query in tqdm(test_file['queries'], desc=f"{filename} queries", leave=False):
                    
                    self.run_morph_test(
                        model, file_path, filename, 
                        file_contents, query
                    )
                    
                    self.run_sr_test(
                        model, file_path, filename,
                        file_contents, query
                    )
        
        csv_file = self.metrics_collector.save_to_csv()
        log_file = self.metrics_collector.save_detailed_logs()
        
        summary = self.metrics_collector.generate_summary()
        
                
        if summary['comparison']:
            print(f"\n{'='*60}")
            print("COMPARISON (Morph vs Search & Replace)")
            print(f"{'='*60}")
            
            for model, ratios in summary['comparison'].items():
                print(f"\nModel: {model}")
                print(f"  Redundant Tokens Ratio: {ratios['redundant_tokens_ratio']:.2f}x")
                print(f"  Generation Time Ratio: {ratios['time_generate_ratio']:.2f}x")
                print(f"  Apply Time Ratio: {ratios['time_apply_ratio']:.2f}x")
                print(f"  Total Tokens Ratio: {ratios['total_tokens_ratio']:.2f}x")
        
        print(f"\n{'='*60}")
        print(f"Results saved to: {csv_file}")
        print(f"Detailed logs saved to: {log_file}")
        print(f"{'='*60}\n")
        
        return csv_file, log_file, summary
    
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
            
            edited_content = apply_sr_edit(edit_response, file_contents)
            
            apply_timer.stop()
            apply_time = apply_timer.get_duration_ms()
            
            redundant_tokens, total_tokens = calculate_redundant_tokens_sr(
                edit_response, model['name']
            )
            
            is_correct = verify_update(file_contents, edited_content, query['prompt'])
            
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
            
            
        except Exception as e:
            print(f"      ✗ S&R test failed: {str(e)}")
    

