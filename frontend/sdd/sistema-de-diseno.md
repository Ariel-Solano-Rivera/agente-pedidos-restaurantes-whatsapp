# Sistema de diseño del panel

## Propósito y alcance

Base visual común del rediseño del panel (etapa 0): tokens de color, tipografía, espacios, radios, sombras y movimiento, y los componentes base que reutilizan todas las páginas. No define pantallas ni cambia contratos de API, permisos ni reglas de dominio: el panel sigue mostrando solo lo que devuelve el backend (precios, `allowedTransitions`, avisos de contraste).

Estado: **aprobado** (etapa 0, 2026-11-09). Ninguna página importa todavía `src/design/`; cada página lo adopta al rediseñarse, con su propia aprobación.

## Fuente y dependencias

- Código: `src/design/tokens.css` (tokens, `@font-face`, tema claro y oscuro), `src/design/components.css` (componentes `ds-*`), `muestra-sistema.html` (página de muestra solo para desarrollo; no entra en `vite build`).
- Fuentes: `public/fonts/geist/` y `public/fonts/geist-mono/`, woff2 autoalojados, subconjunto latín (incluye á é í ó ú ñ ü ¿ ¡), variables por peso (100–900), con su `OFL.txt` (SIL Open Font License 1.1). Sin CDN ni dependencias npm nuevas.
- Desarrollo: `vite.config.ts` reenvía `/api` a `http://localhost:8080` (o `VITE_API_PROXY`) con `npm run dev`, igual que nginx en Docker Compose.
- API o estado compartido: `GET /branding` (colores y `contrast[]`) vía `src/shared/branding.ts`.
- Roles: todos. El tema oscuro es el predeterminado de COCINA y una preferencia para el resto.

## Tokens

| Grupo | Tokens | Valores |
|---|---|---|
| Marca | `--brand-primary`, `--brand-secondary`, `--brand-primary-hover/-soft/-line` | Por defecto `#0a3165` / `#0a5eae`; las variantes se derivan con `color-mix` |
| Acción | `--action-bg`, `--action-hover`, `--on-action` | Claro: la marca con texto blanco. Oscuro: la marca aclarada a L = 0.80 en OKLCH (conserva el tono), con texto `#0d121c` |
| Superficies | `--bg`, `--surface`, `--surface-sunken`, `--surface-raised`, `--border`, `--border-strong`, `--overlay` | Claro: `#f5f6f8`, `#fff`, `#eef0f3`… Oscuro: `#0d121c`, `#151c29`, `#10161f`… |
| Texto | `--text`, `--text-muted`, `--text-subtle` | Claro `#141c27`, `#4f5b6b`, `#5f6a78`; oscuro `#e9eef6`, `#a9b4c6`, `#8c98ac` |
| Estados de pedido | `--st-{pending,accepted,preparing,ready,completed,rejected,cancelled,expired}-{fg,bg,line}` | Ámbar, azul, violeta, verde, gris, rojo, rojo apagado y gris |
| Estados de pago | `--pay-{pending,verifying,confirmed}-{fg,bg}` | Gris, ámbar y verde; rechazado y no requerido reutilizan rojo y gris |
| Tipografía | `--font-display`, `--font-text` (Geist), `--font-code` (Geist Mono), `--text-xs…3xl` (12, 14, 16, 18, 22, 28, 36 px), pesos 420/540/640/720 | Cuerpo de 16 px; números con `tabular-nums` (`.ds-num`); Geist Mono solo para el número de pedido |
| Espacios | `--space-1…14` | Base de 4 px: 4, 8, 12, 16, 20, 24, 32, 40, 56 |
| Radios | `--radius-sm/md/lg/xl/pill` | 6, 10, 14, 20 y 999 px |
| Sombras | `--shadow-sm/md/lg` | Suaves en claro; más densas en oscuro |
| Táctil | `--hit`, `--hit-kitchen` | 44 px en el panel; 56 px en Cocina |
| Movimiento | `--duration-fast/base/slow`, `--ease-out` | 150, 220 y 280 ms; con `prefers-reduced-motion` pasan a 0 |

### Marca y contraste

- `branding.ts` aplica `--brand-primary` y `--brand-secondary` desde `GET /branding`; sin sesión rige el tema por defecto.
- El panel **no calcula** el contraste de la marca. Si `contrast[]` del backend indica `passesAA = false` para el color principal contra blanco, el panel pone `data-brand-contrast="low"` en `<html>`: en tema claro la acción usa el color por defecto y la marca queda como acento (logo, franja lateral, gráficos). En tema oscuro la marca aclarada siempre lleva texto oscuro. *(Se implementa en `branding.ts` al rediseñar el shell, etapa 1.)*
- La muestra verifica todos los pares de tokens (21) en ambos temas y con cuatro marcas de ejemplo: el mínimo es 4.82:1 en claro y 5.86:1 en oscuro.

### Estados: color, icono y texto

| Pedido | Texto | Icono | Pago | Texto | Icono |
|---|---|---|---|---|---|
| `PENDING_DECISION` | Por aceptar | reloj | `PENDING` | Pago pendiente | círculo punteado |
| `ACCEPTED` | Aceptado | check | `PENDING_VERIFICATION` | Pago por verificar | recibo |
| `PREPARING` | En preparación | llama | `CONFIRMED` | Pago confirmado | check en círculo |
| `READY` | Listo | campana | `REJECTED` | Pago rechazado | x en círculo |
| `COMPLETED` | Completado | doble check | `NOT_REQUIRED` | Pago no requerido | menos en círculo |
| `REJECTED` | Rechazado | x en círculo | | | |
| `CANCELLED` | Cancelado | prohibido | | | |
| `EXPIRED` | Vencido | reloj de arena | | | |

Las etiquetas son las que ya usa el panel. Los iconos son SVG de línea propios (24 × 24, `currentColor`), sin librería.

## Componentes base

| Componente | Clase | Notas |
|---|---|---|
| Botón | `.ds-btn` + `--primary/--secondary/--ghost/--danger`, `--lg` | 44 px; `--lg` de 56 px para Cocina; icono opcional |
| Tarjeta | `.ds-card`, `--interactive` | Borde suave, radio de 14 px |
| Tabla | `.ds-table-wrap`, `.ds-table`, `.is-num` | Encabezado en mayúsculas pequeñas; montos alineados a la derecha con cifras tabulares; desplazamiento horizontal propio |
| Insignia de estado | `.ds-badge[data-status]`, `[data-payment]` | Siempre icono más texto |
| Botones de filtro | `.ds-filter-group` (`fieldset`), `.ds-chip[aria-pressed]`, `.ds-chip__count` | Selección con relleno de acción y check; contador por opción |
| Campos | `.ds-field`, `.ds-input`, `.ds-search`, `.ds-field__error` | Error con icono y texto, `aria-invalid` y `aria-describedby` |
| Interruptor | `.ds-switch` (`input[role=switch]`) | Disponibilidad en Menú |
| Pestañas | `.ds-tabs`, `.ds-tab[aria-selected]` | Con desplazamiento horizontal en móvil |
| Modal | `<dialog class="ds-modal">` | Confirmación con estado de origen y destino |
| Estado vacío | `.ds-empty` | Ilustración SVG de línea de un color, título, una línea y botón |
| Esqueleto | `.ds-skeleton` | Brillo desactivado con movimiento reducido |

Reglas de maquetación: los hijos de grid o flex que contienen tablas o textos largos llevan `min-width: 0`; los `fieldset` de filtros llevan `min-inline-size: 0`. Sin ellas, la página desborda en móvil.

## Comportamiento visible

- Tipografía: **Geist** para títulos, texto y cifras, y **Geist Mono** solo para el número de pedido `PED-XXXXXXXX`, porque distingue 0/O y 1/l (52 KB en total). Se descartaron Bricolage Grotesque + Inter (más peso, dos familias) e IBM Plex Sans (más ancha).
- Tema: claro como base. Cada persona elige **Claro, Oscuro o Sistema**; por defecto es Claro para ADMIN y CAJA, y Oscuro para COCINA (paleta inspirada en la referencia `cocina-02`). El shell resuelve «Sistema» con `matchMedia('(prefers-color-scheme: dark)')`, sigue sus cambios y pone `data-theme="dark"` en `<html>`. La preferencia se guarda solo en el navegador (`localStorage`, con `try/catch`); no se envía al backend. *(Se implementa en la etapa 1.)*
- Dispositivos: menú lateral en pantallas grandes y menú desplegable de pantalla completa en móvil (se construye en la etapa 1).

## Validaciones y errores

No aplica a nivel de tokens. Los componentes de campo muestran el error con icono y texto, nunca solo con color.

## Estados de interfaz

Carga con `.ds-skeleton`, vacío con `.ds-empty`, error de campo con `.ds-field__error`, foco visible común (contorno de 3 px con `--focus-ring`) y selección con `aria-pressed`/`aria-selected`.

## Pruebas

- Revisión en la guía viva (`/muestra-sistema.html?theme=light|dark|system&brand=%23RRGGBB`, solo con `npm run dev`): la propia página verifica la carga de fuentes, las cifras tabulares y el contraste de los pares de tokens.
- Capturas con Chrome sin interfaz a 1280, 820 y 390 px: sin desbordamiento horizontal.

## TBD / exclusiones

- Las skills locales `impeccable`, `taste-skill` y `animate` que menciona `AGENTS.md` no existen en `.agents/skills/`; se aplicaron sus criterios (jerarquía, dirección visual y animación breve) sin ellas. TBD en `AGENTS.md`.
- Fuera de alcance: cambios de contratos, permisos o reglas de dominio; cálculo de contraste de la marca en el panel (lo hace el backend).
