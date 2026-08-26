---
name: pandas-data
description: "Manipulate and transform DataFrames efficiently — cleaning, aggregation, groupby, merges, and time series. Use for pandas data wrangling, joining tables, resampling, or optimizing large datasets."
domain: ai-ml
role: task
order: 3
load_when: dataframe work is in scope
guidance: vectorize over loops | clean at the boundary | assert output shape

metadata:
  author: guava-os
  version: "0.1.0"
---

## Pandas Data

Vectorize everything, set dtypes deliberately, and validate shape/null counts
before declaring a transform done.

## Workflow

1. **Assess** — `dtypes`, `memory_usage(deep=True)`, `isna().sum()`, `describe(include="all")`.
2. **Design** — plan vectorized ops; identify the indexing strategy.
3. **Implement** — vectorized methods, method chaining, `.loc`/`.iloc`.
4. **Validate** — assert shapes, dtypes, null counts, and row counts.
5. **Optimize** — categorical dtypes, numeric downcasting, chunking for large data.

## Patterns

- **Vectorize, loop as last resort** — `df['tax'] = df['price'] * 0.2`, never `iterrows` for arithmetic.
- **Safe subset mutation** — `.loc[mask].copy()` then mutate; avoid chained indexing `df['A']['B']`.
- **GroupBy with `observed=True`** — then `.agg(named_aggs=('col','func'))` and `.reset_index()`.
- **Merge with validation** — `pd.merge(..., how='left', validate='m:1', indicator=True)` then inspect `_merge`.
- **Missing values** — forward-fill/linear-interpolate numerics; mode for categoricals, median for numerics; never silently drop.
- **Time series** — `set_index()` then `.resample('D').agg(...).fillna(0)`.
- **Pivot** — `pivot_table(values, index, columns, aggfunc, fill_value=0, margins=True)`.
- **Memory** — `astype('category')` for low-cardinality strings; `pd.to_numeric(..., downcast='integer'/'float')`.

## Rules

DO:
- Check `memory_usage(deep=True)` on large frames.
- Handle missing values explicitly.
- Preserve index integrity through operations.
- Use `pd.concat()` over deprecated `.append()`.

DON'T:
- Iterate with `.iterrows()` unless unavoidable.
- Ignore `SettingWithCopyWarning`.
- Load entire large datasets without chunking.
- Assume data is clean without validation.

## Uses

- Data cleaning, aggregation, and transformation tasks
- Joining/merging tables and reshaping (pivot, crosstab)
- Time-series resampling and memory/performance tuning

## Source

Upstream: Jeffallan/claude-skills — `skills/pandas-pro`