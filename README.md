# Innovaweb — Panel interno

Panel para centralizar clientes, sitios (Astro y WordPress), proyectos, costeo y analítica.

**Stack:** Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS + Supabase (Auth, Postgres, RLS).
Es una app de una sola página: no hay servidor propio, la seguridad la da Supabase.

## Requisitos
- Node.js 22.12 o superior (recomendado 24, ver `.nvmrc`).
- Un proyecto en [Supabase](https://supabase.com) (plan gratuito).

## Configuración (una sola vez)
1. **Base de datos:** Supabase → *SQL Editor* → ejecuta, en orden:
   - `supabase/migrations/0001_base_inventario.sql`
   - `supabase/migrations/0002_team_members_auth.sql`
   - `supabase/migrations/0003_proyectos_tareas.sql`
   - `supabase/migrations/0004_costeo.sql`
   - `supabase/migrations/0005_analitica.sql`
2. **Desactivar registro público:** *Authentication → Sign In / Providers* → apaga **Allow new users to sign up**.
3. **Crear tu usuario:** *Authentication → Users → Add user → Create new user* (correo + contraseña, marca **Auto Confirm User**).
4. **Darle acceso al panel** (SQL Editor). El usuario debe existir antes en Authentication; si no, la base lo rechaza:
   ```sql
   insert into public.team_members (email, full_name) values ('tu@correo.com', 'Tu Nombre');
   ```
   Quitar acceso: `update public.team_members set active = false where email = '...';`
5. **Recuperar contraseña:** *Authentication → URL Configuration*
   - *Site URL*: `http://localhost:5173` (luego tu dominio real)
   - *Redirect URLs*: `http://localhost:5173/nueva-contrasena` (y la de producción)
6. **Variables:** copia `.env.example` a `.env` y completa con *Project Settings → API Keys*.
   Usa la **Publishable key** (`sb_publishable_…`) o la legacy **anon public** (`eyJ…`). Nunca la *secret* / *service_role*.
   Opcional: `VITE_CURRENCY=PEN` (o MXN, COP, EUR…) para la moneda de los montos; por defecto USD.
7. `npm install` y `npm run dev` → http://localhost:5173

> Si cambias el `.env`, reinicia `npm run dev`.

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa tipos y genera `dist/` para publicar |
| `npm run typecheck` | Solo revisa tipos |

## Estructura
```
src/
  lib/          supabase.ts, types.ts, labels.ts, utils.ts, useQuery.ts, useQueryParam.ts, useTeam.ts
  stores/       auth.ts — sesión y verificación de team_members (Pinia)
  router/       rutas + protección de páginas
  layouts/      DashboardLayout (menú lateral), AuthLayout (login)
  components/   formularios, badges, ventana de confirmación…
  views/        pantallas: inicio, clientes/, sitios/, projects/, tareas, login…
supabase/migrations/   esquema SQL versionado
```

## Publicar
Netlify o Vercel: comando `npm run build`, carpeta `dist`, y las dos variables `VITE_…`.
`public/_redirects` (Netlify) y `vercel.json` ya están listos para que las rutas funcionen al recargar.

## Conectar Google Analytics 4

**1. Google Cloud (una vez)**
1. En [console.cloud.google.com](https://console.cloud.google.com/) crea un proyecto (ej. "Innovaweb").
2. *APIs y servicios → Biblioteca* → busca **Google Analytics Data API** → **Habilitar**.
3. *IAM y administración → Cuentas de servicio* → **Crear cuenta de servicio** (sin roles).
4. Entra a la cuenta → *Claves* → **Agregar clave → JSON**. Se descarga un archivo `.json`. Guárdalo en un lugar seguro; **no lo subas a git**.

**2. Supabase**
1. *Edge Functions → Secrets* → agrega `GA4_SERVICE_ACCOUNT` y pega **todo** el contenido del `.json`.
2. Despliega la función (elige una):
   - **Terminal:** `npx supabase login` → `npx supabase link --project-ref deuydxopgtrhczxyrjqr` → `npx supabase functions deploy sync-ga4 --no-verify-jwt`
   - **Navegador:** *Edge Functions → Deploy a new function → Via Editor*, nombre `sync-ga4`, pega `supabase/functions/sync-ga4/index.ts` y en la configuración de la función **desactiva "Enforce JWT verification"** (la función valida sola que seas del equipo).

**3. Google Analytics (por cada propiedad)**
- *Administrar → Gestión de acceso a la propiedad → +* → agrega el correo de la cuenta de servicio (`…@….iam.gserviceaccount.com`, lo ves en la página **Analítica** del panel) con rol **Lector**.
- Copia el **ID de propiedad** (*Administrar → Detalles de la propiedad*, solo números; no es el `G-XXXX`) y pégalo al editar el sitio en el panel.

**4. Sincronizar**
- En el panel: **Analítica → Sincronizar todos** (la primera vez trae 90 días).
- Diario automático (opcional): crea el secreto `CRON_SECRET` en *Edge Functions → Secrets* con un texto aleatorio (`openssl rand -hex 24`), activa `pg_cron` y `pg_net` en *Database → Extensions* y ejecuta `supabase/cron/sync_ga4_diario.sql` reemplazando `<CRON_SECRET>`.

## Cómo se calcula el margen
- **Costo real** = horas × costo/hora de quien las trabajó (se congela al registrar) + gastos ligados al proyecto.
- **Ingreso** = facturado sin impuestos. Si aún no hay facturas, se usa el presupuesto (margen “esperado”).
- **Margen** = ingreso − costo real.

## Seguridad
- `team_members` está enlazado a `auth.users` por ID: no se puede agregar un correo sin usuario, borrar el usuario borra su acceso y los cambios de correo se sincronizan solos.
- El acceso se verifica con `auth.uid()` (ID del token) y `active = true`.
- Row Level Security en la base: aunque alguien tenga la clave pública, sin ser del equipo no ve ni modifica nada.
- No guardes contraseñas en el panel: usa el campo *Credenciales* con un enlace a tu gestor.

## Etapas
- [x] **0 — Base:** Vue + Supabase, login con correo y contraseña, recuperar contraseña, menú.
- [x] **1 — Inventario:** clientes, sitios, accesos rápidos, vencimientos de dominio/hosting.
- [x] **2 — Proyectos:** tablero kanban, lista y vista global de tareas, seguimientos, puntos importantes y próximos pasos.
- [x] **3 — Costeo:** horas con cronómetro, costo/hora por persona, gastos únicos y recurrentes, facturas con pagos parciales, margen por proyecto.
- [x] **4 — Analítica GA4:** sincronización (manual y diaria) por sitio, indicadores con variación, tendencia diaria, tops y comparativa entre sitios.
- [ ] **5 — Salud técnica:** plugins WP, deploys Astro, uptime, SSL, Search Console.
- [ ] **6 — Extras:** alertas, reportes mensuales PDF, portal de clientes.
