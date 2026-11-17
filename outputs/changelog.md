# Nimbus AI — Data Cleaning Changelog

Generated: 2026-11-17 15:55:43

## Summary

- Initiatives processed: 6
- Usage records processed: 18
- Finance records processed: 6
- Data-quality corrections logged: 14

## Corrections

- Initiatives: normalized ID ' cp-02' to 'CP-02'.
- Initiatives CP-02: standardized date '15/08/2026' to '2026-08-15'.
- Initiatives PM-01: standardized date '15/03/2026' to '2026-03-15'.
- Usage CP-02, week 1: standardized metric 'weekly_active_users' to 'WAU'.
- Usage CP-02, week 2: standardized metric 'weekly_active_users' to 'WAU'.
- Usage CP-02, week 3: standardized metric 'weekly_active_users' to 'WAU'.
- Usage BOT-01, week 1: standardized metric 'active_users_wk' to 'WAU'.
- Usage BOT-01, week 2: standardized metric 'active_users_wk' to 'WAU'.
- Usage BOT-01, week 3: standardized metric 'active_users_wk' to 'WAU'.
- Usage BOT-02, week 2: removed duplicate record.
- Usage PM-02, week 2: imputed missing WAU as 95 by linear interpolation.
- Finance CP-01: converted INR lakh values to INR.
- Finance BOT-01: corrected negative cost sign; used absolute value.
- Finance BOT-02: converted INR lakh values to INR.

## Output Files

- data/clean/initiatives.csv
- data/clean/usage.csv
- data/clean/finance.csv

All financial values are standardized to INR.