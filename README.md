# Monty — Controla tus ingresos diarios

App PWA para conductores de plataformas (Uber, Didi) que permite trackear ingresos diarios, gestionar gastos, controlar préstamos y alcanzar metas financieras mensuales.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript |
| Estilos | Tailwind CSS v4 |
| Animaciones | Motion (Framer Motion) v12 |
| Íconos | Lucide React |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| Build | Vite 6 |
| PWA | vite-plugin-pwa |
| Deploy | Vercel |

---

## Funcionalidades

### Ingresos
- Registro de ingresos diarios por plataforma (Uber, Didi, u otras fuentes configurables)
- Ingresos extra: bonos, ventas, devoluciones de impuestos — con opción de que cuenten o no hacia la meta mensual
- Prompt automático de bencina después de registrar un ingreso

### Metas y progreso
- Tres modos de ingreso, configurables en Ajustes:
  - **Conductor:** meta bruta mensual desde las apps, con meta diaria dinámica según días laborales restantes.
  - **Sueldo:** sueldo fijo mensual (con día de pago) + meta de ahorro; Monty calcula cuánto puedes gastar cada día sin comprometerla.
  - **Mixto:** sueldo fijo que cubre el mes + ingresos de apps en tiempos libres, que aceleran la meta de ahorro.
- Meta diaria dinámica (modo Conductor): se recalcula automáticamente según los días laborales restantes del mes
- Días laborales / días de manejo personalizables (qué días de la semana trabajas o sales a manejar)
- Prompt automático el día de pago para registrar el sueldo del mes con un toque
- Barra de progreso mensual (o de ahorro proyectado) y proyección de cierre de mes
- Indicador de estado diario: "¡Vas bien!", "En camino" o "Bajo meta" (o "Gastando de más" en modo sueldo/mixto)

### Gastos
- Gastos planificados por categoría con presupuesto mensual asignado
- Gastos imprevistos (fuera del presupuesto)
- Grupos de gastos: agrupa varios ítems bajo un concepto (viaje, evento, proyecto)
  - Crea grupos nuevos con múltiples ítems
  - Agrega gastos a grupos existentes directamente desde el panel principal
  - Visualiza ítems y totales por grupo
- Cuotas de tarjeta de crédito: monto total, cuotas, mes de inicio, monto por cuota
- Alerta de pagos próximos (hasta 5 días antes) con notificaciones push opcionales

### Préstamos
- Registro de préstamos dados (presté dinero) y recibidos (me prestaron)
- Cada préstamo crea automáticamente la transacción contable correspondiente:
  - Préstamo dado → gasto inmediato, ingreso cuando te pagan
  - Préstamo recibido → ingreso inmediato, gasto cuando pagas
- Abonos parciales y pagos completos
- Estado por préstamo: pendiente, parcial, saldado
- Resumen en el dashboard: "Te deben" vs "Debes"
- Los préstamos afectan el saldo real de caja pero no inflan la meta mensual

### Saldo y cálculos
- **Saldo Libre:** ingreso total − presupuesto asignado − gastos imprevistos − grupos
- **En Bolsillo:** todo el dinero real que entró (incluyendo préstamos) − todo lo gastado
- Separación correcta entre ingresos que cuentan para la meta y dinero real disponible

### Historial
- Calendario navegable por mes con indicadores visuales de movimientos
- Vista de movimientos por día: ingresos, gastos, extras y grupos
- Vista de grupos con gestión completa: crear, renombrar, agregar/editar/eliminar ítems, eliminar grupo
- Edición y eliminación de cualquier registro
- **Análisis por período**, con selector Mes / 3 meses / Año / Todo y navegación entre períodos:
  - Comparativa vs período anterior (ingresos, gastos, neto) con variación porcentual
  - Evolución mensual de los últimos 6 meses (gráfico de barras)
  - Últimos 7 días, ingresos por plataforma y gastos por categoría
  - Promedios y récords: ingreso por día trabajado, gasto por día con gasto, mejor día, día más caro
  - Top 5 gastos del período
  - Resumen del período desglosado en Sueldo / Apps / Extras / Gastos
  - Exportar informe PDF del período seleccionado

### Configuración
- Gestión de fuentes de ingreso
- Configuración de presupuestos por categoría con día de pago
- Gestión de cuotas de crédito

### UX / PWA
- Diseño mobile-first, instalable como app en Android e iPhone
- Actualizaciones en tiempo real via Supabase Realtime
- Panel flotante de acciones rápidas (Gastar / Ganar / menú expandible)
- Animaciones con spring physics en todos los modales
- Autenticación completa con recuperación de contraseña

---

## Base de datos (Supabase)

Todas las tablas tienen RLS habilitado con políticas por `user_id`.

```
income_sources       Plataformas de ingreso (Uber, Didi, etc.)
daily_entries        Registros diarios de ingreso
extra_income         Ingresos extra (bonos, ventas, sueldo, etc.)
expenses             Gastos (planificados e imprevistos)
goals                Meta mensual/anual + modo de ingreso + días laborales + sueldo
budgets              Presupuesto mensual por categoría
credit_installments  Compras en cuotas
expense_groups       Grupos de gastos
expense_group_items  Ítems dentro de grupos
loans                Préstamos dados y recibidos
loan_payments        Pagos/abonos de préstamos
```

Para crear las tablas, ejecuta `supabase_schema.sql` en el SQL Editor de tu proyecto Supabase. El archivo es idempotente (seguro de ejecutar múltiples veces).

---

## Variables de entorno

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## Desarrollo local

```bash
npm install
npm run dev
npm run test   # corre la suite de Vitest (lógica de cálculos)
```

---

## Deploy

Conecta el repositorio a Vercel y configura las variables de entorno. El build es estático (`npm run build` genera `dist/`).

---

Desarrollado por [TeoLabs](https://www.teolabs.app)
