# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Monty (MetaIngresos): PWA mobile-first para conductores de app (Uber/Didi) que trackea ingresos diarios, gastos, presupuestos, cuotas de crédito, grupos de gastos y préstamos, con meta mensual dinámica. Toda la UI y los textos están en español.

## Comandos

```bash
npm run dev        # Vite en puerto 3000 (host 0.0.0.0)
npm run build      # Build estático a dist/
npm run lint       # tsc --noEmit (no hay ESLint)
npm run preview    # Sirve el build local
npm run test       # Vitest (run único) — hoy solo cubre src/lib/calculations.ts
npm run test:watch # Vitest en modo watch
```

Para correr un solo test file: `npx vitest run src/lib/calculations.test.ts`. Config en `vitest.config.ts` (separado de `vite.config.ts` para no arrastrar el plugin PWA a los tests). `npm run clean` usa `rm -rf` (falla en PowerShell; usar Git Bash).

## Arquitectura

SPA de React 19 + TypeScript + Vite 6 + Tailwind CSS v4, sin router: `src/App.tsx` maneja auth (sesión de Supabase, modo password-recovery) y un estado de tab (`home | history | budget | settings`) que pasa a `Navigation` y `Dashboard`.

**`src/components/Dashboard.tsx` es el hub de datos.** Hace fetch en paralelo de todas las tablas del usuario (`goals`, `daily_entries`, `extra_income`, `expenses`, `budgets`, `credit_installments`, `expense_group_items`, `loans`), se suscribe a Supabase Realtime (`postgres_changes` por tabla, filtrado por `user_id`) y ante cualquier cambio vuelve a llamar `fetchData()`. Los demás componentes reciben datos por props o hacen sus propias mutaciones directas a Supabase; la UI se refresca vía Realtime, no por estado compartido.

**Lógica de negocio en `src/lib/calculations.ts`** (funciones puras, sin Supabase):
- Tres modos de ingreso (`goals.income_mode`): `driver` (meta de ingreso diaria), `salary` y `mixed` (sueldo fijo + apps). En salary/mixed la lógica se invierte: `monthly_target` se reinterpreta como **meta de ahorro**, y se calcula "cuánto puedo gastar hoy" (`spendAvailableToday`) en vez de "cuánto me falta ganar". El sueldo pendiente se asume como caja futura (`projectedSavings` lo incluye aunque no haya llegado); al llegar se registra como `extra_income` tipo `'salary'` con `affects_goal=false` (Dashboard lo pregunta el día de pago, patrón del prompt de bencina).
- Meta diaria dinámica (modo driver): `(meta mensual − acumulado − extras que afectan meta) / días laborales restantes`, según `working_days` del goal (en modo mixed significan "días que manejo").
- Distinción clave entre dos totales que no deben mezclarse:
  - `accumulatedIncome` (para la meta): solo `daily_entries` + extras con `affects_goal = true`.
  - `totalCashIn` (caja real / "En Bolsillo"): incluye TODO lo que entró (préstamos, extras sin `affects_goal`).
- "Saldo Libre" (`totalRemaining`) = `totalCashIn − presupuesto total asignado − gastos imprevistos − gastos de grupos`.
- Los gastos se clasifican como planificados/imprevistos comparando `category` contra las categorías de `budgets` (case-insensitive, con trim).

**Convenciones de datos:**
- `daily_entries.gross_income` es el campo canónico de ingreso (la bencina se registra como gasto separado; `net_income`/`operational_costs` son legacy).
- Las fechas se guardan como `DATE` (string `YYYY-MM-DD`) y se parsean SIEMPRE como medianoche local: `new Date(dateStr + 'T00:00:00')`. No usar `new Date(dateStr)` directo (desfase UTC).
- Los préstamos (`loans`) generan su contrapartida contable como `extra_income`/`expenses` para afectar la caja sin inflar la meta.
- `expense_group_items` puede no tener `date`; se usa `created_at` como fallback y, sin ninguna fecha, el ítem se incluye en el mes actual.

**Tipos en `src/types.ts`** reflejan 1:1 las tablas de Supabase más `DashboardStats` (salida de `calculateStats`).

## Supabase

- Cliente en `src/lib/supabase.ts` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (`.env`).
- Esquema completo en `supabase_schema.sql` (idempotente, seguro de re-ejecutar en el SQL Editor). Todas las tablas tienen RLS con política por `user_id`.
- Plantillas de email de auth en `supabase/emails/` (confirm-signup, invite, reset-password) — se pegan manualmente en el panel de Supabase.
- OJO: la URL del proyecto Supabase está hardcodeada en el `runtimeCaching` del PWA en `vite.config.ts`; si cambia el proyecto de Supabase hay que actualizarla ahí también.

## PWA y deploy

- `vite-plugin-pwa` con `registerType: 'autoUpdate'`; manifest definido en `vite.config.ts`.
- Deploy en Vercel como sitio estático; `vercel.json` solo tiene el rewrite SPA a `index.html`.
- Alias de import `@` apunta a la raíz del repo (no a `src/`).

## Notas

- Animaciones con `motion/react` (Framer Motion v12); modales con `AnimatePresence` y spring physics.
