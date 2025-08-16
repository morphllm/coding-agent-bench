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
    redundant_tokens: int
    time_generate_ms: float
    time_apply_ms: float
    total_tokens: int
    timestamp: str
    query_prompt: str
    response_data: str
    is_correct: bool = False

class MetricsCollector:
    def __init__(self, output_dir: str = "results/"):
        self.output_dir = output_dir
        self.results: List[BenchmarkResult] = []
        # Thread-safe append with a lock ensures consistency when used from multiple threads
        self._lock = threading.Lock()
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(os.path.join(output_dir, "logs"), exist_ok=True)
    
    def add_result(self, result: BenchmarkResult):
        """Thread-safe addition of a result record."""
        with self._lock:
            self.results.append(result)
    
    def save_to_csv(self, filename: str = None):
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"benchmark_{timestamp}.csv"
        
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', newline='') as csvfile:
            fieldnames = [
                'benchmark_id', 'model', 'file', 'query_id', 'method',
                'redundant_tokens', 'time_generate_ms', 'time_apply_ms',
                'total_tokens', 'timestamp', 'is_correct'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for result in self.results:
                row = asdict(result)
                row.pop('query_prompt')
                row.pop('response_data')
                writer.writerow(row)
        
        return filepath
    
    def save_detailed_logs(self):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = os.path.join(self.output_dir, "logs", f"detailed_{timestamp}.json")
        
        with open(log_file, 'w') as f:
            json.dump([asdict(r) for r in self.results], f, indent=2)
        
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
                        "avg_redundant_tokens": sum(r.redundant_tokens for r in method_results) / len(method_results),
                        "avg_time_generate_ms": sum(r.time_generate_ms for r in method_results) / len(method_results),
                        "avg_time_apply_ms": sum(r.time_apply_ms for r in method_results) / len(method_results),
                        "avg_total_tokens": sum(r.total_tokens for r in method_results) / len(method_results),
                        "num_samples": len(method_results)
                    }
        
        comparison = {}
        for model in models:
            if "morph" in summary[model] and "search_replace" in summary[model]:
                morph_data = summary[model]["morph"]
                sr_data = summary[model]["search_replace"]
                
                comparison[model] = {
                    "redundant_tokens_ratio": morph_data["avg_redundant_tokens"] / sr_data["avg_redundant_tokens"] if sr_data["avg_redundant_tokens"] > 0 else 0,
                    "time_generate_ratio": morph_data["avg_time_generate_ms"] / sr_data["avg_time_generate_ms"] if sr_data["avg_time_generate_ms"] > 0 else 0,
                    "time_apply_ratio": morph_data["avg_time_apply_ms"] / sr_data["avg_time_apply_ms"] if sr_data["avg_time_apply_ms"] > 0 else 0,
                    "total_tokens_ratio": morph_data["avg_total_tokens"] / sr_data["avg_total_tokens"] if sr_data["avg_total_tokens"] > 0 else 0
                }
        
        return {
            "summary": summary,
            "comparison": comparison
        }

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
