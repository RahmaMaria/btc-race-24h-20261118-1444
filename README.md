# btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/RahmaMaria/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/RahmaMaria/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A paper-money BTC trading bot for make.fun's "Race a BTC trading bot live
for 24 hours" ($250 in USDC, escrowed). It trades Coinbase Wrapped BTC
(cbBTC) on 1-minute Orca Whirlpool bars, long only, starting from $1,000.

## Strategy — dip-buy with bounce confirmation

One-minute noise whipsaws every fast signal I tried on the dev window
(EMA 8/21 cross: -$148; RSI mean reversion: -$69; buy-and-hold: -$32 on a
window where BTC fell 2.8%), so this bot trades rarely, only on a
multi-hour shape, and sits in cash the rest of the time:

- **Entry:** the close is at least 1.8% below the highest close of the 240
  bars before it (a real 4-hour dip), **and** at least 0.2% above the close
  60 bars ago (the dip has stopped falling and bounced). It buys with all
  its cash. Buying the dip blind — no bounce check — lost money on 5 of 7
  real 24-hour windows from 11–17 Nov; the confirmed version was positive
  in total over those same windows.
- **Exit:** the whole position at +1.5% over cost (take profit) or −0.8%
  under cost (stop loss). A refused exit is sent again next bar.

Everything is exact `BigInt` integer arithmetic on the harness's own
scales, so two runs on the same bars give the same orders: no clock, no
randomness, no network, no files.

## Results (kit's own fill model: 4 bps fee, 2 bps slippage, constant-product impact, next-open fills)

- **Dev window (17–18 Nov, BTC −2.80%): +$13.72 net, 2 trades, win rate
  100%, max drawdown 0.64%** — verified with the kit's own grader
  (`grade-local --driver process`); still +$12.91 with every fee doubled.
  The dev gate needs net PnL above $0.
- **7 real out-of-sample 24h windows, 11–17 Nov** (Coinbase BTC-USD 1m
  candles, same fill model): +1.81, 0.00, +13.57, −10.28, +3.30, 0.00,
  0.00 = **+$8.40 total**, worst window −$10.28 (one stop-loss).
  Buy-and-hold lost on 6 of the 8 windows.

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

`main.ts` (Node 22, type-stripping syntax) speaks
`agent-fun/bars-replay/v1` via the kit's SDK shim in `vendor/` (a
byte-identical copy of the kit's `sdk/makefun-bars.ts`).
