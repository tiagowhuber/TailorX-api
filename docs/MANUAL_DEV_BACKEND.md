# TailorX-api — Manual de Desarrollo (Backend)

Fecha: 2025-12-16

## Objetivo
Este manual permite que un/a dev levante la API en local con Node 20 LTS, configure variables de entorno, cree la base de datos **cargando el SQL oficial**, y entienda los archivos/funciones más importantes (arranque, DB, auth JWT, pagos, generación de patrones FreeSewing, uploads).

---

## Requisitos
- Node.js **20 LTS**
- npm
- PostgreSQL (local o en Docker)
- (Recomendado) Cliente `psql` disponible en terminal

---

## Configuración de entorno
Crea un `.env` en la raíz del proyecto (misma carpeta que `package.json`) basándote en `.env.example`.

### Variables principales
- DB (elige UNA opción):
  - Opción A: `DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME`
  - Opción B: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- JWT:
  - `JWT_SECRET` (obligatorio en entornos reales)
  - `JWT_EXPIRES_IN` (por defecto `7d`)
- Server:
  - `PORT` (por defecto `3000`)
  - `NODE_ENV` (en local: `development`)
- CORS:
  - `FRONTEND_URL` (opcional). Si existe, se agrega a la allowlist en `src/app.ts`.
- Google OAuth (necesario si usarás login Google):
  - `GOOGLE_CLIENT_ID`
- Transbank Webpay:
  - `TRANSBANK_API_URL`, `TRANSBANK_COMMERCE_CODE`, `TRANSBANK_API_KEY`

Nota: `.env.example` incluye Transbank de integración.

---

## Instalación y ejecución
Desde la carpeta del backend:

```powershell
npm install
npm run dev
```

Comandos disponibles (ver `package.json`):
- `npm run dev`: `nodemon --exec ts-node src/index.ts`
- `npm run build`: compila TypeScript (`tsc`)
- `npm start`: ejecuta `index.js` (wrapper). Si falta build, compila y corre.
- `npm run db:init`: inicializa/seed por script (NO es el flujo oficial de DB)
- `npm run db:sync`: `sequelize.sync({ alter: true })`

---

## Base de datos (flujo oficial): cargar SQL
El flujo oficial de esquema + seed es cargar:
- `src/database/database.pgsql`

IMPORTANTE:
- El SQL hace `DROP SCHEMA IF EXISTS public CASCADE;` y recrea todo. Esto **borra** tablas/datos existentes en el schema `public`.

### Paso a paso con psql (Windows)
1) Asegura que PostgreSQL esté corriendo.
2) Crea la base de datos (si no existe):

```powershell
psql -U postgres -d postgres -c "CREATE DATABASE tailorx;"
```

3) Carga el SQL (esquema + datos semilla):

```powershell
psql -U postgres -d tailorx -f "src/database/database.pgsql"
```

4) Ajusta tu `.env` para apuntar a esa DB:
- `DB_NAME=tailorx`
- `DB_USER=postgres`
- `DB_PASSWORD=...`

### ¿Qué crea el SQL?
- Tablas: `users`, `user_addresses`, `measurement_types`, `user_measurements`, `designs`, `design_measurements`, `patterns`, `orders`, `order_items`, `order_status_history`.
- Trigger `update_updated_at_column()` para mantener `updated_at`.
- Seed:
  - `measurement_types` con `freesewing_key` (mapeo a FreeSewing)
  - 1 diseño de ejemplo: `Aaron A-Shirt` + sus medidas requeridas.

---

## Arquitectura (alto nivel)
- Express + TypeScript.
- Sequelize (Postgres).
- Auth: JWT Bearer Token.
- Módulos principales expuestos bajo `/api`.

---

## Archivos clave y qué hacen

### Arranque de servidor
- `src/index.ts`
  - Carga variables con `dotenv.config()`.
  - `startServer()`:
    - `sequelize.authenticate()` valida conexión.
    - En `development`: `sequelize.sync({ alter: true })` sincroniza modelos.
    - `app.listen(PORT)` inicia servidor.
  - Nota: si tu esquema “oficial” viene de SQL, `alter: true` puede ajustar tablas para alinearse a los modelos. En local normalmente ayuda, pero es bueno saber que puede modificar el esquema.

- `src/app.ts`
  - Configura CORS (allowlist incluye `http://localhost:5173`).
  - `app.use(express.json())`.
  - Sirve archivos subidos desde `/uploads`.
  - Monta `/api` con inicialización perezosa:
    - `initializeDatabase()` hace `sequelize.authenticate()` una vez.
    - `getRoutes()` hace `require('./routes').default` para evitar dependencias circulares.

### Configuración DB y JWT
- `src/config/database.ts`
  - `getSequelize()` crea singleton de Sequelize.
  - Soporta `DATABASE_URL` (útil para deploy) o variables `DB_*`.
  - Usa pool pequeño (`max: 2`) y SSL condicional en `production`.

- `src/config/jwt.ts`
  - `generateToken(payload)`: firma JWT con `JWT_SECRET` y expiración.
  - `verifyToken(token)`: valida JWT y retorna payload.

### Middleware de autenticación
- `src/middleware/auth.ts`
  - `authenticateToken(req, res, next)`:
    - Lee header `Authorization: Bearer <token>`.
    - `verifyToken` → busca usuario con `User.findByPk(decoded.id)`.
    - Adjunta `req.user`.
  - `optionalAuth(...)`: si hay token válido, adjunta `req.user`, si no, continúa.

### Rutas
- `src/routes/index.ts`
  - Monta módulos bajo:
    - `/auth`, `/users`, `/measurement-types`, `/user-measurements`, `/designs`, `/patterns`, `/orders`, `/payments`, `/user-addresses`.

- `src/routes/auth.ts`
  - `POST /auth/login` (público)
  - `POST /auth/register` (público)
  - `POST /auth/google` (público)
  - `POST /auth/logout` (protegido)
  - `GET /auth/me` (protegido)
  - `POST /auth/refresh` (protegido)

---

## Catálogo de controladores (qué hace cada uno)
Este catálogo es el “mapa” del backend: responsabilidades, endpoints y reglas de negocio. Los endpoints están definidos en `src/routes/*.ts`.

### `src/controllers/authController.ts`
- Responsabilidad: autenticación y emisión de JWT (propio del sistema) + login con Google.
- Endpoints (desde `src/routes/auth.ts`):
  - `POST /auth/login` (público): valida `email/password`, verifica `user.checkPassword`, emite JWT.
  - `POST /auth/register` (público): valida `email/password` (mín. 6), crea usuario (hash) y emite JWT.
  - `POST /auth/google` (público): verifica `credential` con Google (`OAuth2Client.verifyIdToken`), crea/actualiza usuario y emite JWT.
  - `POST /auth/logout` (protegido): no invalida tokens (JWT stateless), devuelve ok; el “logout real” es cliente-side.
  - `GET /auth/me` (protegido): retorna `req.user` (sin `password_hash`).
  - `POST /auth/refresh` (protegido): re-emite JWT para el usuario autenticado.
- Reglas/validaciones:
  - Registro rechaza emails duplicados.
  - Google: si el usuario existe y no tiene foto, puede setear `profile_picture_url` desde Google.

### `src/controllers/userController.ts`
- Responsabilidad: CRUD de usuarios y gestión de foto de perfil (upload + procesamiento).
- Endpoints (desde `src/routes/users.ts`, todos protegidos):
  - `GET /users`: lista usuarios (excluye `password_hash`).
  - `GET /users/:id`: obtiene usuario por id.
  - `POST /users`: crea usuario (valida email único, hash password).
  - `PUT /users/:id`: actualiza usuario (email único, puede rehacer hash si viene `password`).
  - `DELETE /users/:id`: elimina usuario.
  - `POST /users/:id/profile-picture`: upload `multipart/form-data` (`profile_picture`) + `sharp` (resize 400x400, jpg calidad 90), borra original y borra foto anterior si existía.
  - `DELETE /users/:id/profile-picture`: elimina archivo y limpia campo.
- Nota: actualmente no hay una regla de “solo yo puedo editarme” en este controlador (solo requiere estar autenticado). Si se quiere RBAC/ownership, hay que agregarlo.

### `src/controllers/userAddressController.ts`
- Responsabilidad: direcciones del usuario autenticado (CRUD) + “default address”.
- Endpoints (desde `src/routes/userAddresses.ts`, todos protegidos):
  - `GET /user-addresses`: lista direcciones del usuario (ordenadas por `is_default DESC`).
  - `POST /user-addresses`: crea dirección; si es la primera o viene `is_default`, se marca default y desmarca otras.
  - `PUT /user-addresses/:id`: actualiza dirección; si se marca default, desmarca otras.
  - `DELETE /user-addresses/:id`: elimina; si era default, promueve otra como default si existe.

### `src/controllers/measurementTypeController.ts`
- Responsabilidad: catálogo de tipos de medidas (incluye `freesewing_key` para mapeo a FreeSewing).
- Endpoints (desde `src/routes/measurementTypes.ts`):
  - `GET /measurement-types` (público): lista tipos.
  - `GET /measurement-types/:id` (público): obtiene tipo.
  - `GET /measurement-types/freesewing/:key` (público): obtiene por `freesewing_key`.
  - `POST /measurement-types` (protegido): crea (valida unicidad de `name` y, si viene, de `freesewing_key`).
  - `PUT /measurement-types/:id` (protegido): actualiza (mantiene unicidad).
  - `DELETE /measurement-types/:id` (protegido): elimina.

### `src/controllers/userMeasurementController.ts`
- Responsabilidad: medidas del usuario (CRUD + batch create/update).
- Endpoints (desde `src/routes/userMeasurements.ts`, todos protegidos):
  - `GET /user-measurements`: lista (opcional `?userId=`).
  - `GET /user-measurements/user/:userId`: lista medidas de un usuario.
  - `GET /user-measurements/user/:userId/type/:typeId`: obtiene una medida por usuario+tipo.
  - `GET /user-measurements/:id`: obtiene una medida.
  - `POST /user-measurements`: crea (rechaza duplicado por `user_id + measurement_type_id`).
  - `PUT /user-measurements/:id`: actualiza valor.
  - `DELETE /user-measurements/:id`: elimina.
  - `POST /user-measurements/batch`: crea/actualiza múltiples en un request, devuelve `{ processed, errorCount, results, errors }`.

### `src/controllers/designController.ts`
- Responsabilidad: catálogo de diseños (prendas) + medidas requeridas por diseño.
- Endpoints (desde `src/routes/designs.ts`):
  - `GET /designs` (público): lista (opcional `?active=true|false`).
  - `GET /designs/active` (público): solo activos.
  - `GET /designs/freesewing/:pattern` (público): por nombre de patrón FreeSewing.
  - `GET /designs/:id` (público): detalle.
  - `POST /designs` (protegido): crea (valida unicidad `name` y `freesewing_pattern`).
  - `PUT /designs/:id` (protegido): actualiza (mantiene unicidad).
  - `DELETE /designs/:id` (protegido): soft delete (`is_active=false`).
  - `GET /designs/:id/measurements` (público): medidas requeridas.
  - `POST /designs/:id/measurements` (protegido): agrega medida requerida.
  - `DELETE /designs/:id/measurements/:measurementTypeId` (protegido): remueve relación.

### `src/controllers/patternController.ts`
- Responsabilidad: CRUD de patrones + generación vía FreeSewing.
- Endpoints (desde `src/routes/patterns.ts`, todos protegidos):
  - `GET /patterns` (filtros `?userId=&status=`): lista.
  - `GET /patterns/user/:userId`: lista del usuario.
  - `GET /patterns/design/:designId`: lista por diseño.
  - `GET /patterns/status/:status`: lista por estado.
  - `POST /patterns/generate`: genera patrón desde diseño+medidas (principal endpoint para FE).
  - `GET /patterns/:id`: detalle (incluye chequeo de acceso: solo dueño).
  - `GET /patterns/:id/svg`: retorna `image/svg+xml`.
  - `PUT /patterns/:id`: update genérico (name/status/etc.).
  - `PUT /patterns/:id/finalize`: pasa a `finalized`.
  - `PUT /patterns/:id/archive`: pasa a `archived`.
  - `PUT /patterns/:id/unarchive`: vuelve a `draft`.
  - `DELETE /patterns/:id`: elimina.
- Reglas/validaciones clave:
  - `POST /patterns/generate` exige que `req.user.id === user_id`.
  - El diseño debe existir, estar activo y tener `freesewing_pattern`.
  - Si faltan medidas requeridas, responde `400` con `missing_measurements: [{ id, name, freesewing_key }]`.

### `src/controllers/orderController.ts`
- Responsabilidad: órdenes, items y status history.
- Endpoints (desde `src/routes/orders.ts`, todos protegidos):
  - `GET /orders` (filtros `?userId=&status=`)
  - `GET /orders/user/:userId`
  - `GET /orders/number/:orderNumber`
  - `GET /orders/status/:status`
  - `GET /orders/:id`
  - `POST /orders` (crea orden + statusHistory inicial `pending`)
  - `PUT /orders/:id` (no permite update si `cancelled` o `completed`)
  - `DELETE /orders/:id` (cancela → `status=cancelled` + history)
  - `GET /orders/:id/items`
  - `POST /orders/:id/items`
  - `PUT /orders/:id/items/:itemId`
  - `DELETE /orders/:id/items/:itemId`
  - `PUT /orders/:id/status` (valida status en allowlist: `pending|confirmed|processing|shipped|completed|cancelled` + history)
  - `GET /orders/:id/status-history`

### `src/controllers/paymentController.ts`
- Responsabilidad: iniciar transacción en Transbank + confirmar resultado + exponer estado del pago.
- Endpoints (desde `src/routes/payments.ts`):
  - `POST /payments/create` (protegido): valida carrito/subtotal/usuario/patrones; crea `Order` + `OrderItem` + history; llama a Transbank y guarda `payment_token/payment_url`.
  - `PUT /payments/confirm/:token` (público): confirma en Transbank (server-to-server), actualiza `order.status` + `order.payment_status` + history.
  - `GET /payments/order/:orderId` (protegido): retorna estado (valida que la orden pertenezca al usuario).
- Reglas/validaciones clave:
  - No permite pagar patrones con `status === 'archived'`.
  - Transiciones típicas: `AUTHORIZED` → `order.status=confirmed`, `payment_status=completed`; otros estados → `cancelled/failed/rejected/...`.

---

### Uploads de imagen de perfil
- `src/middleware/upload.ts`
  - Configura `multer` con `diskStorage`.
  - En serverless usa `/tmp/uploads/profile-pictures`; en local usa `uploads/profile-pictures`.
  - `uploadProfilePicture`: middleware listo para `.single('profile_picture')`.

### Pagos (Transbank)
- `src/controllers/paymentController.ts`
  - `createPayment` (protegido):
    - Valida carrito, usuario y subtotal.
    - Crea `Order` + `OrderItem` + `OrderStatusHistory`.
    - Llama a Transbank para iniciar transacción y guarda `payment_token`/`payment_url`.
  - `getPaymentState` (público):
    - Confirma la transacción con Transbank (`PUT /transactions/{token}`).
    - Actualiza estado de la orden y registra historial.
  - `getPaymentByOrderId` (protegido):
    - Devuelve estado de pago (y valida acceso por `req.user`).

### Patrones (FreeSewing)
- `src/controllers/patternController.ts`
  - `generatePattern` (protegido):
    - Verifica usuario y diseño.
    - Obtiene medidas del usuario y requeridas por el diseño.
    - Transforma a formato FreeSewing, valida faltantes, genera SVG.
    - Crea `Pattern` (status `draft`) con `svg_data`.
  - `getPatternSvg`: retorna `image/svg+xml`.
  - `finalizePattern`, `archivePattern`, `unarchivePattern`: cambian `status`.

- `src/utils/freesewing.ts`
  - `transformMeasurementsForFreeSewing(...)`: mapea `measurementType.freesewing_key` → valor numérico.
  - `validateRequiredMeasurements(...)`: detecta llaves faltantes.
  - `generateFreeSewingPattern(...)`: carga módulos FreeSewing vía `dynamicImport()` (evita problemas ESM/require), genera SVG y retorna tamaño.
  - `generatePatternName(...)`: nombre automático con fecha.

---

## Contrato API (resumen para FE)
Base: `http://localhost:3000/api`

Auth:
- `POST /auth/register`, `POST /auth/login`, `POST /auth/google`
- `GET /auth/me` (Bearer)

Patrones:
- `POST /patterns/generate` (Bearer)
- `GET /patterns/user/:userId` (Bearer)
- `GET /patterns/:id/svg` (Bearer)

Pagos:
- `POST /payments/create` (Bearer)
- `PUT /payments/confirm/:token` (público)
- `GET /payments/order/:orderId` (Bearer)

---

## Troubleshooting

### Error de conexión a DB
- Revisa `.env` (`DB_*` o `DATABASE_URL`).
- Confirma que la DB exista y que corriste `src/database/database.pgsql`.
- Valida conectividad con `psql`.

### CORS
`src/app.ts` permite `http://localhost:5173` y opcionalmente `FRONTEND_URL`.
Si el FE está en otro host/puerto, agrega `FRONTEND_URL`.

### Login Google falla
- Asegura `GOOGLE_CLIENT_ID` en el `.env` del backend.
- Asegura que el `VITE_GOOGLE_CLIENT_ID` del frontend corresponda al mismo Client ID.

### Uploads no se guardan
- En local, confirma que exista carpeta `uploads/profile-pictures` (se crea “lazy”, pero puede fallar por permisos).
- En serverless, `/tmp` es efímero: en producción se recomienda storage externo.

---

## Deploy (nota rápida)
- Render: revisa `render.yaml` para build/start y variables.
- Producción: no usar `sequelize.sync({ alter: true })` sin una estrategia (migraciones).
