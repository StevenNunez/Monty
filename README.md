# Monty — Controla tus ingresos diarios

App PWA para conductores de plataformas (Uber, Didi) que permite trackear ingresos diarios, gestionar gastos fijos y alcanzar metas financieras mensuales.

## Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 + Framer Motion
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Build:** Vite 6
- **PWA:** vite-plugin-pwa (service worker + manifest)
- **Deploy:** Vercel

## Funcionalidades

- Registro de ingresos diarios por plataforma (bruto / costos / neto)
- Meta mensual dinámica: calcula cuánto necesitas ganar cada día laboral restante
- Gastos planificados por categoría con presupuesto mensual
- Gastos con **día de pago** → sección "Próximos Pagos" con estado pagado/pendiente y toggle mes actual/siguiente
- Ingresos extra (bonos, ventas, devolución de impuestos)
- Historial navegable por mes
- Prompt de bencina post-registro de ingreso
- PWA instalable en Android e iPhone

## Base de datos (Supabase)

