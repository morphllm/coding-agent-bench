# Morph Benchmark Suite

A comprehensive benchmarking system designed to evaluate Morph's intelligent code editing capabilities against traditional approaches across different models and editing methods.

## Overview

This benchmark evaluates how Morph's apply model compares with search-and-replace and full file generation when users request code edits. The system tests editing performance across multiple programming languages and frameworks using real-world code samples.

## Comparison Methods

### 1. Single Turn Mode
Compares two approaches when a user requests an edit:
- **Morph Tool**: Uses Morph's intelligent merging to apply targeted edits
- **Full File Generation**: Regenerates the entire file with requested changes

### 2. Multi Turn Mode  
Compares iterative editing with self-verification:
- **Morph Tool**: Multi-step editing with intelligent context preservation
- **Search & Replace**: Traditional find-replace operations with verification loops

Both multi-turn methods can perform multiple iterations to refine edits and verify correctness.

## Quick Start

### Installation
```bash
pip install -r requirements.txt
```

### Running Benchmarks
```bash
python main.py --config config/benchmark.yaml
```

## Project Structure

```
├── benchmarks/           # Core benchmarking logic
│   ├── runner.py        # Main benchmark orchestration
│   ├── utils.py         # Model integrations and edit applications
│   ├── metrics.py       # Results collection and analysis
│   └── prompts.py       # Prompt templates for different modes
├── config/
│   └── benchmark.yaml   # Configuration file
├── corpus/              # Test files for benchmarking
└── results/            # Generated benchmark results
```

## Adding Test Files

1. **Add your file** to the `corpus/` directory
2. **Configure tests** in `config/benchmark.yaml`:
   ```yaml
   test_files:
     - path: "corpus/your_file.ext"
       queries:
         - id: "unique_test_id"
           prompt: "Description of the edit to perform"
   ```
3. **Run the benchmark** with `python main.py`

## Adding New Models

The system supports Anthropic, OpenAI, and Google models out of the box. To add support for other providers:

1. **Add model configuration** in `config/benchmark.yaml`:
   ```yaml
   models:
     - name: "your-model"
       api_key_env: "YOUR_API_KEY_ENV_VAR"
       temperature: 0
       model_id: "actual-model-identifier"
   ```

2. **Implement model integration** in `benchmarks/utils.py`:
   - Add API client initialization
   - Implement request/response handling
   - Handle rate limiting and retries

## Benchmark Metrics

The system evaluates performance across four key dimensions:

### Core Metrics
- **Total Time**: End-to-end execution time including API calls and processing
- **Token Count**: Total visible tokens generated (excludes internal reasoning tokens)
- **Token Cost**: Calculated cost based on model pricing
- **Success Rate**: Percentage of edits that correctly implement the requested changes

### Multi-Turn Specific
- **Iterations**: Number of edit cycles required to complete the task
- **Verification Time**: Time spent on self-verification between edits
- **Context Overhead**: Additional time for re-uploading file contents across iterations

### Timing Details
- **Generation Time**: Time spent by LLM generating the edit
- **Apply Time**: Time spent applying the edit (Morph API calls or local processing)
- **Rate Limit Delays**: Excluded from performance calculations

## Results Structure

Each benchmark run creates a timestamped results directory:

```
results/benchmark_YYYYMMDD_HHMMSS_[single_turn|multi_turn]/
├── benchmark_YYYYMMDD_HHMMSS_[mode].csv    # Summary metrics
├── logs/
│   └── detailed_YYYYMMDD_HHMMSS_[mode].json # Complete execution logs
└── workspace/
    └── [model-name]/
        └── [file-name]/
            └── [query-id]_[method].[ext]    # All edited file versions
```

### Output Files
- **CSV**: Aggregated metrics for analysis and visualization
- **JSON Logs**: Detailed execution traces including prompts and responses  
- **Workspace**: Complete edited files organized by model, source file, and method

## Configuration Options

Key settings in `config/benchmark.yaml`:

```yaml
single_turn: false           # true = Morph vs Full File, false = Morph vs Search & Replace
models: [...]               # List of models to test
test_files: [...]           # Files and edit queries to benchmark
output_dir: "results/"      # Results output directory
```

The benchmark automatically handles concurrent execution, rate limiting, and result aggregation across all configured models and test cases.
