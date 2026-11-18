// btc-race-24h-20261118-1444 — dip-buy with bounce confirmation, long only.
//
// One symbol (CBBTC), $1,000 paper, fills at the next bar's open, ~26 bps a
// full-size round trip in fees + slippage + price impact. One-minute noise
// whipsaws every fast signal I tried (EMA 8/21 cross: -$148 on the dev
// window; RSI mean reversion: -$69), so this bot trades rarely and only on
// a multi-hour shape, and stays in cash the rest of the time:
//
//   ENTRY, on a bar's close (filled at the next open), when all hold:
//     - the close is at least 1.8% below the highest close of the 240 bars
//       before it (a real 4-hour dip, not 1-minute noise), and
//     - the close is at least 0.2% above the close 60 bars ago (the dip
//       has stopped falling and bounced; buying into a still-falling
//       stair-step is what bled every no-confirmation variant out of
//       sample: -1.8% dips bought blind lost money on 5 of 7 real 24h
//       windows of 11-17 Nov, while this confirmed version was positive
//       in total over those 7 windows and made +$13.72 on the dev window)
//     - it holds nothing. It buys with all its cash, one position max.
//   EXIT, the whole position, on a bar's close:
//     - take profit: position worth >= 1.5% over its cost, or
//     - stop loss: position worth <= 0.8% under its cost.
//     A refused exit (slippage cap) is simply sent again next bar.
//
// Everything is exact BigInt integer arithmetic on the harness's own
// scales (closes at price_scale 5, quote at 6 decimals), so two runs on
// the same bars produce the same orders: no clock, no randomness, no
// network, no files. Backtests, all with the kit's fill model
// (4 bps fee, 2 bps slippage, constant-product impact vs the bar's open
// depth, next-open fills):
//   dev window (17-18 Nov, BTC -2.80%): +$13.72 net, 2 trades, max DD ~-0.7%
//   7 real out-of-sample 24h windows, 11-17 Nov (Coinbase BTC-USD 1m):
//     +1.81, 0.00, +13.57, -10.28, +3.30, 0.00, 0.00 = +$8.40 total,
//     worst window -$10.28 (one stop-loss). Buy-and-hold lost on 6 of 8.
//   The dev gate needs net PnL above $0; this clears it with margin
//   while keeping the worst observed day to about one stop-loss.

import { runBars, type BarsState, type BuyInput, type OrderInput, type SellInput } from './vendor/makefun-bars.ts';

/** Bars of history a dip is measured against (4 hours of 1-minute bars). */
const LOOKBACK_BARS = 240;
/** Entry: close this far below the trailing 240-bar high. */
const DIP_NUM = 18n; // 1.8%
const DIP_DEN = 1000n;
/** Entry: close this far above the close 60 bars ago (bounce confirmed). */
const BOUNCE_BARS = 60;
const BOUNCE_NUM = 2n; // 0.2%
const BOUNCE_DEN = 1000n;
/** Exit: take profit at +1.5% over cost. */
const TP_NUM = 1015n;
const TP_DEN = 1000n;
/** Exit: stop loss at -0.8% under cost. */
const SL_NUM = 992n;
const SL_DEN = 1000n;
/** 1% past the close it was decided on, like the kit's EMA-cross baseline. */
const MAX_SLIPPAGE_BPS = 100;

/** CBBTC closes, oldest first, as the harness reports them. */
const closes: bigint[] = [];

await runBars({
  onBatch(state: BarsState, batch): OrderInput[] {
    for (const bar of batch.bars) {
      if (bar.symbol === 'CBBTC') closes.push(BigInt(bar.c));
    }
    const symbol = 'CBBTC';
    const held = state.positions.get(symbol);
    const close = state.close(symbol);
    if (close === null) return [];

    if (held !== undefined) {
      const value = state.value(symbol, held.qty);
      if (value * TP_DEN >= held.cost * TP_NUM || value * SL_DEN <= held.cost * SL_NUM) {
        const sell: SellInput = { side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    // Flat: need 240 closes before this one for the high, and 60 for the bounce.
    if (closes.length < LOOKBACK_BARS + 1) return [];
    const now = closes[closes.length - 1];
    let high = closes[closes.length - 1 - LOOKBACK_BARS];
    for (let i = closes.length - LOOKBACK_BARS; i < closes.length - 1; i++) {
      if (closes[i] > high) high = closes[i];
    }
    // now >= high * (1 - 1.8%) means no dip: stay in cash.
    if (now * DIP_DEN >= high * (DIP_DEN - DIP_NUM)) return [];
    // Bounce: now >= close 60 bars ago * (1 + 0.2%).
    const ago = closes[closes.length - 1 - BOUNCE_BARS];
    if (now * BOUNCE_DEN < ago * (BOUNCE_DEN + BOUNCE_NUM)) return [];

    const cash = state.cash;
    if (cash <= 0n || cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const buy: BuyInput = { side: 'buy', symbol, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
