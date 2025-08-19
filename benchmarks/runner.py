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

from benchmarks.utils import (
    get_single_turn_morph_edit,
    apply_morph_edit,
    verify_update,
    run_multi_turn_edits,
    get_full_file_generation,
)
from benchmarks.metrics import MetricsCollector, BenchmarkResult, Timer
from benchmarks.prompts import get_morph_prompt, get_sr_prompt


class BenchmarkRunner:
    def __init__(self, config_path: str):
        with open(config_path, "r") as f:
            self.config = yaml.safe_load(f)

        self.metrics_collector = MetricsCollector(
            output_dir=self.config.get("output_dir", "results/")
        )

        self.corpus_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.single_turn = self.config.get("single_turn", False)

    def run_all_benchmarks(self):
        models = self.config.get("models", [])
        test_files = self.config.get("test_files", [])

        # Build batches of (model, file, query) so each query can run in parallel
        batches = []  # List[Tuple[dict(test_file), dict(model), dict(query)]]
        for test_file in test_files:
            for model in models:
                for query in test_file["queries"]:
                    batches.append((test_file, model, query))

        max_threads = self.config.get("num_threads", min(32, os.cpu_count() or 8))

        print(
            f"Running benchmarks with {len(batches)} batches using {max_threads} threads..."
        )

        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            future_to_batch = {
                executor.submit(self._process_batch, tf, mdl, qry): (tf["path"], mdl["name"], qry["id"])
                for tf, mdl, qry in batches
            }

            # Track progress as each batch finishes
            for idx, future in enumerate(as_completed(future_to_batch), 1):
                path, model_name, query_id = future_to_batch[future]
                try:
                    future.result()
                    print(
                        f"✓ Completed {path} [{query_id}] with model {model_name} ({idx}/{len(future_to_batch)})"
                    )
                except Exception as e:
                    print(f"✗ Error processing {path} [{query_id}] with model {model_name}: {e}")

        # Aggregate & output results once all threads are done
        csv_file = self.metrics_collector.save_to_csv()
        log_file = self.metrics_collector.save_detailed_logs()

        summary = self.metrics_collector.generate_summary()

        if self.single_turn:
            # Single-turn mode: Morph vs Full File Generation
            print(f"\n{'=' * 60}")
            print("SINGLE-TURN COMPARISON (Morph vs Full File Generation)")
            print(f"{'=' * 60}")

            for model in summary["summary"]:
                if (
                    "morph" in summary["summary"][model]
                    and "full_file_generation" in summary["summary"][model]
                ):
                    morph = summary["summary"][model]["morph"]
                    ffg = summary["summary"][model]["full_file_generation"]
                    print(f"\nModel: {model}")
                    print(
                        f"  Morph – Total Tokens: {morph['avg_total_tokens']:.1f}, Gen Time: {morph['avg_time_generate_ms']:.1f} ms, Apply Time: {morph['avg_time_apply_ms']:.1f} ms, Success: {morph['success_rate'] * 100:.1f}%"
                    )
                    print(
                        f"  Full File – Total Tokens: {ffg['avg_total_tokens']:.1f}, Gen Time: {ffg['avg_time_generate_ms']:.1f} ms, Success: {ffg['success_rate'] * 100:.1f}%"
                    )
        elif summary["comparison"]:
            print(f"\n{'=' * 60}")
            print("MULTI-TURN COMPARISON (Morph vs Search & Replace)")
            print(f"{'=' * 60}")

            for model, ratios in summary["comparison"].items():
                morph = summary["summary"][model]["morph"]
                sr = summary["summary"][model]["search_replace"]

                print(f"\nModel: {model}")

                # Multi-turn mode always shows iterations
                print(
                    f"  Morph – Avg Iterations: {morph.get('avg_iterations', 1):.1f}, Total Tokens: {morph['avg_total_tokens']:.1f}, Gen Time: {morph['avg_time_generate_ms']:.1f} ms, Apply Time: {morph['avg_time_apply_ms']:.1f} ms, Success: {morph['success_rate'] * 100:.1f}%"
                )
                print(
                    f"  S&R  – Avg Iterations: {sr.get('avg_iterations', 1):.1f}, Total Tokens: {sr['avg_total_tokens']:.1f}, Gen Time: {sr['avg_time_generate_ms']:.1f} ms, Apply Time: {sr['avg_time_apply_ms']:.1f} ms, Success: {sr['success_rate'] * 100:.1f}%"
                )

        print(f"\n{'=' * 60}")
        print(f"Results saved to: {csv_file}")
        print(f"Detailed logs saved to: {log_file}")
        print(f"{'=' * 60}\n")

        return csv_file, log_file, summary

    def _process_batch(self, test_file: Dict, model: Dict, query: Dict):
        """Process a single (file, model, query) batch."""
        file_path = os.path.join(self.corpus_dir, test_file["path"])

        if not os.path.exists(file_path):
            print(f"Warning: File {file_path} not found, skipping batch...")
            return

        with open(file_path, "r") as f:
            file_contents = f.read()

        filename = os.path.basename(file_path)

        if self.single_turn:
            # Single-turn mode: morph vs full file generation
            self.run_morph_test(model, file_path, filename, file_contents, query)
            self.run_full_file_test(
                model, file_path, filename, file_contents, query
            )
        else:
            # Multi-turn mode: morph vs search-replace (both multi-turn)
            self.run_morph_test(model, file_path, filename, file_contents, query)
            self.run_sr_test(model, file_path, filename, file_contents, query)

    def run_morph_test(
        self,
        model: Dict,
        file_path: str,
        filename: str,
        file_contents: str,
        query: Dict,
    ):
        try:
            if not self.single_turn:
                # Multi-turn mode
                result = run_multi_turn_edits(
                    file_contents, query["prompt"], "morph", model["model_id"]
                )

                edited_content = result["edited_code"]
                generation_time = result["total_generation_time_ms"]
                apply_time = result["total_apply_time_ms"]
                iterations = result["iterations"]

                total_tokens = result["total_tokens"]

                edit_response = {
                    "multi_turn_responses": result["responses"],
                    "iterations": result["iterations"],
                }
            else:
                # Single-turn mode (existing behavior)
                generation_timer = Timer()
                generation_timer.start()

                edit_response = get_single_turn_morph_edit(
                    file_contents, query["prompt"], model["model_id"]
                )

                generation_timer.stop()
                generation_time = generation_timer.get_duration_ms()

                # Apply morph edit - returns actual time excluding rate limit waits
                edited_content, apply_time = apply_morph_edit(
                    edit_response, file_contents
                )

                # Get total tokens from the response if available, else estimate
                total_tokens = len(json.dumps(edit_response)) // 4  # Rough estimate
                iterations = 1  # Single-turn mode has 1 iteration

            # Verification only runs once after all edits are complete
            is_correct = verify_update(file_contents, edited_content, query["prompt"])

            result = BenchmarkResult(
                benchmark_id="benchmark",
                model=model["name"],
                file=file_path,
                query_id=query["id"],
                method="morph",
                time_generate_ms=generation_time,
                time_apply_ms=apply_time,
                total_tokens=total_tokens,
                timestamp=datetime.now().isoformat(),
                query_prompt=query["prompt"],
                response_data=json.dumps(edit_response),
                is_correct=is_correct,
                iterations=iterations,
            )

            self.metrics_collector.add_result(result)
            verification_symbol = "✓" if is_correct else "✗"
            print(
                f"{verification_symbol} Morph edit completed: {filename} [{query['id']}] with model {model['name']} (verified: {is_correct})"
            )

        except Exception as e:
            print(f"      ✗ Morph test failed: {str(e)}")

    def run_sr_test(
        self,
        model: Dict,
        file_path: str,
        filename: str,
        file_contents: str,
        query: Dict,
    ):
        try:
            # SR is only used in multi-turn mode
            if not self.single_turn:
                result = run_multi_turn_edits(
                    file_contents, query["prompt"], "sr", model["model_id"]
                )

                edited_content = result["edited_code"]
                generation_time = result["total_generation_time_ms"]
                apply_time = result["total_apply_time_ms"]
                iterations = result["iterations"]
                success = (
                    edited_content != file_contents
                )  # Check if any edits were made

                total_tokens = result["total_tokens"]

                edit_response = {
                    "multi_turn_responses": result["responses"],
                    "iterations": result["iterations"],
                }
            else:
                # This should never happen - SR is not used in single-turn mode
                raise ValueError("Search-replace is not supported in single-turn mode")

            if success:
                # Verification only runs once after all edits are complete
                is_correct = verify_update(
                    file_contents, edited_content, query["prompt"]
                )
            else:
                # Mark as incorrect without validation
                is_correct = False

            result = BenchmarkResult(
                benchmark_id="benchmark",
                model=model["name"],
                file=file_path,
                query_id=query["id"],
                method="search_replace",
                time_generate_ms=generation_time,
                time_apply_ms=apply_time,
                total_tokens=total_tokens,
                timestamp=datetime.now().isoformat(),
                query_prompt=query["prompt"],
                response_data=json.dumps(edit_response),
                is_correct=is_correct,
                iterations=iterations,
            )

            self.metrics_collector.add_result(result)
            # Show both: whether edit was applied AND whether it was verified correct
            apply_symbol = "✓" if success else "✗"
            verify_symbol = "✓" if is_correct else "✗"
            print(
                f"{apply_symbol}/{verify_symbol} S&R edit completed: {filename} [{query['id']}] with model {model['name']} (applied: {success}, verified: {is_correct})"
            )

        except Exception as e:
            print(f"      ✗ S&R test failed: {str(e)}")

    def run_full_file_test(
        self,
        model: Dict,
        file_path: str,
        filename: str,
        file_contents: str,
        query: Dict,
    ):
        try:
            # Get full file generation from model
            result = get_full_file_generation(
                file_contents, query["prompt"], model["model_id"]
            )

            edited_content = result["edited_content"]
            generation_time = result["generation_time_ms"]
            total_tokens = result["total_tokens"]

            # No apply time for full file generation (the generation IS the application)
            apply_time = 0

            # Verify the changes are correct
            is_correct = verify_update(file_contents, edited_content, query["prompt"])

            result_obj = BenchmarkResult(
                benchmark_id="benchmark",
                model=model["name"],
                file=file_path,
                query_id=query["id"],
                method="full_file_generation",
                time_generate_ms=generation_time,
                time_apply_ms=apply_time,
                total_tokens=total_tokens,
                timestamp=datetime.now().isoformat(),
                query_prompt=query["prompt"],
                response_data=json.dumps(result["response_data"]),
                is_correct=is_correct,
                iterations=1,  # Full file generation is always single-turn
            )

            self.metrics_collector.add_result(result_obj)
            verification_symbol = "✓" if is_correct else "✗"
            print(
                f"{verification_symbol} Full file generation completed: {filename} [{query['id']}] with model {model['name']} (verified: {is_correct})"
            )

        except Exception as e:
            print(f"      ✗ Full file generation test failed: {str(e)}")
