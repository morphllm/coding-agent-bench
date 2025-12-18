import time
import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Any
from dataclasses import dataclass, asdict
import threading

@dataclass
class BenchmarkResult:
    benchmark_id: str
    model: str
    file: str
    query_id: str
    method: str
    time_generate_ms: float
    time_apply_ms: float
    total_tokens: int
    timestamp: str
    query_prompt: str
    response_data: str
    is_correct: bool = False
    iterations: int = 1  # Number of turns in multi-turn mode, default 1 for single-turn
    edited_content: str = ""  # The actual edited file content

class MetricsCollector:
    def __init__(self, output_dir: str = "results/", test_type: str = "multi_turn"):
        self.test_type = test_type
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.timestamp = timestamp
        self.output_dir = os.path.join(output_dir, f"benchmark_{timestamp}_{test_type}")
        self.results: List[BenchmarkResult] = []
        # Thread-safe append with a lock ensures consistency when used from multiple threads
        self._lock = threading.Lock()
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "logs"), exist_ok=True)
        self.workspace_dir = os.path.join(self.output_dir, "workspace")
        os.makedirs(self.workspace_dir, exist_ok=True)
    
    def add_result(self, result: BenchmarkResult):
        """Thread-safe addition of a result record."""
        with self._lock:
            self.results.append(result)
            # Save the edited file to workspace
            if result.edited_content:
                self._save_edited_file(result)
    
    def save_to_csv(self, filename: str = None):
        if filename is None:
            filename = f"benchmark_{self.timestamp}_{self.test_type}.csv"
        
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', newline='') as csvfile:
            fieldnames = [
                'benchmark_id', 'model', 'file', 'query_id', 'method',
                'time_generate_ms', 'time_apply_ms',
                'total_tokens', 'timestamp', 'is_correct', 'iterations'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for result in self.results:
                row = asdict(result)
                row.pop('query_prompt')
                row.pop('response_data')
                # Ensure extra fields like edited_content are not written to CSV
                row.pop('edited_content', None)
                writer.writerow(row)
        
        return filepath
    
    def save_detailed_logs(self):
        log_file = os.path.join(self.output_dir, "logs", f"detailed_{self.timestamp}_{self.test_type}.json")
        
        # Create a copy of results without edited_content for the log
        log_results = []
        for r in self.results:
            r_dict = asdict(r)
            r_dict.pop('edited_content', None)  # Remove edited_content from logs
            log_results.append(r_dict)
        
        with open(log_file, 'w') as f:
            json.dump(log_results, f, indent=2)
        
        return log_file
    
    def generate_summary(self):
        if not self.results:
            return "No results to summarize"
        
        summary = {}
        
        methods = set(r.method for r in self.results)
        models = set(r.model for r in self.results)
        
        for model in models:
            summary[model] = {}
            for method in methods:
                method_results = [r for r in self.results if r.model == model and r.method == method]
                
                if method_results:
                    summary[model][method] = {
                        "avg_time_generate_ms": sum(r.time_generate_ms for r in method_results) / len(method_results),
                        "avg_time_apply_ms": sum(r.time_apply_ms for r in method_results) / len(method_results),
                        "avg_total_tokens": sum(r.total_tokens for r in method_results) / len(method_results),
                        "avg_iterations": sum(r.iterations for r in method_results) / len(method_results),
                        "success_rate": sum(1 for r in method_results if r.is_correct) / len(method_results),
                        "num_samples": len(method_results)
                    }
        
        comparison = {}
        for model in models:
            if "morph" in summary[model] and "search_replace" in summary[model]:
                morph_data = summary[model]["morph"]
                sr_data = summary[model]["search_replace"]
                
                comparison[model] = {
                    "time_generate_ratio": morph_data["avg_time_generate_ms"] / sr_data["avg_time_generate_ms"] if sr_data["avg_time_generate_ms"] > 0 else 0,
                    "time_apply_ratio": morph_data["avg_time_apply_ms"] / sr_data["avg_time_apply_ms"] if sr_data["avg_time_apply_ms"] > 0 else 0,
                    "total_tokens_ratio": morph_data["avg_total_tokens"] / sr_data["avg_total_tokens"] if sr_data["avg_total_tokens"] > 0 else 0
                }
        
        return {
            "summary": summary,
            "comparison": comparison
        }
    
    def _save_edited_file(self, result: BenchmarkResult):
        """Save the edited file content to the workspace directory."""
        # Extract base filename without path and extension
        import os.path
        base_name = os.path.basename(result.file)
        name_without_ext = os.path.splitext(base_name)[0]
        file_ext = os.path.splitext(base_name)[1]
        
        # Create model directory
        model_dir = os.path.join(self.workspace_dir, result.model)
        os.makedirs(model_dir, exist_ok=True)
        
        # Create file-specific directory (e.g., 'day', 'canvas', etc.)
        file_dir = os.path.join(model_dir, name_without_ext)
        os.makedirs(file_dir, exist_ok=True)
        
        # Determine file suffix based on method
        method_suffix = result.method
        if result.method == "full_file_generation":
            method_suffix = "full_file"
        elif result.method == "morph" and self.test_type == "single_turn":
            method_suffix = "morph_single"
        elif result.method == "morph" and self.test_type == "multi_turn":
            method_suffix = "morph_multi"
        elif result.method == "search_replace":
            method_suffix = "search_replace"
        
        # Create filename: query_id_method.extension
        output_filename = f"{result.query_id}_{method_suffix}{file_ext}"
        output_path = os.path.join(file_dir, output_filename)
        
        # Write the edited content
        with open(output_path, 'w') as f:
            f.write(result.edited_content)

class Timer:
    def __init__(self):
        self.start_time = None
        self.end_time = None
    
    def start(self):
        self.start_time = time.time()
    
    def stop(self):
        self.end_time = time.time()
    
    def get_duration_ms(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time) * 1000
        return 0
