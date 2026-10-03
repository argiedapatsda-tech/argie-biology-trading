# Argie Biology Trading

Rule-based signals, candle patterns and "what next" study notes for every instrument on XTB
(~8,000 stocks, ETFs, forex pairs, commodities, indices and cryptos).

**Website:** https://argiedapatsda-tech.github.io/argie-biology-trading

For learning and research only. Every list is made by fixed, visible rules from past prices.
It is not advice to buy or sell, and past results do not guarantee future ones.

## How it works

| Part | What it does |
|---|---|
| `scripts/build_universe.py` | Reads XTB International's specification tables (PDF) and matches every instrument to a Yahoo Finance symbol -> `universe.json` |
| `engine/data.py`, `engine/store.py` | Downloads candles from Yahoo. History is downloaded once and then only topped up, because Yahoo blocks big bursts of requests. Fixes Yahoo's broken daily forex candles. |
| `engine/indicators.py` | Moving averages, RSI, MACD, ATR, volume |
| `engine/score.py` | 0-100 buy-side / sell-side setup score; every point has a plain-English reason |
| `engine/patterns.py` | 17 candlestick patterns (with the trend context the textbooks require) |
| `engine/levels.py` | Support / resistance from swing highs and lows |
| `engine/backtest.py` | "How did this signal do in the past?" compared with a normal candle; refuses to call anything reliable unless it clearly beats luck |
| `engine/study.py` | If/then scenarios with confirmation and "wrong if" prices, and their current status |
| `run.py` | `full --max N`: daily/weekly scan of the N least-recently updated instruments. `fast`: 15m/1H/4H for the fast-watch list. |
| `site/` | The website (plain HTML/JS, no build step) |
| `.github/workflows/scan.yml` | Runs every 30 minutes on GitHub and publishes the site |

## Run locally

```
pip install -r requirements.txt
python tests/test_engine.py        # pattern / data unit tests
python tests/smoke_offline.py      # whole pipeline on fake prices (no internet)
python run.py full --max 50        # real scan of 50 instruments
python -m http.server -d site 8000 # then open http://localhost:8000
```
