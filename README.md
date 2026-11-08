# smart-charge-demo

Tamara-styled demo UI for Collectus Smart Autocharge.

## Screens

- **Login** — demo customers, each with their card (network · type · wallet)
- **Shop** — partner products, Pay in 3/4 checkout
- **My payments** — installment timeline per purchase, Pay now; snapshot shows the card on file and scheme declines left this month (Mada 3, Visa/Mastercard 6)
- **Payment history** — manual repayments, Smart autocharge (event + AI) and normal cron autocharge; the ⓘ panel shows the AI decision: charge/skip, card, declines left, P(success) bar with the threshold, drivers and next best action
- **Why AI?** — 30-day backtest from the AI service: KPI tiles, recovered % and failed-attempt charts, table view, impact calculator and "What the model learned"
- **Try Smart Autocharge** — playground: set any customer's card, history and amounts (repayment or cron day) and the live model decides; nothing is charged or saved

## Quick start

```bash
cd smart-charge-demo
cp .env.example .env
npm install
npm run dev
```

Requires backend at `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`).
