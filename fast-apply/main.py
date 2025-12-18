#!/usr/bin/env python3

import sys
import os
import argparse
from pathlib import Path

from benchmarks.runner import BenchmarkRunner


def main():
    parser = argparse.ArgumentParser(description="Run code editing benchmarks")
    parser.add_argument(
        "--config",
        type=str,
        default="config/benchmark.yaml",
        help="Path to the benchmark configuration YAML file",
    )
    parser.add_argument(
        "--output-dir", type=str, default="results/", help="Directory to save results"
    )

    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Error: Configuration file '{config_path}' not found.")
        sys.exit(1)

    try:
        runner = BenchmarkRunner(str(config_path))
        csv_file, log_file, summary = runner.run_all_benchmarks()

        print("\nBenchmark completed successfully!")

    except KeyboardInterrupt:
        print("\n\nBenchmark interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nBenchmark failed: {str(e)}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
