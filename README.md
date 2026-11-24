# Mi Entrenador

App personal de entrenamiento con IA. Una sola persona la usa, con login, verificación en dos pasos y un coach que consulta a Claude desde el servidor.

> Este repositorio es público. **No subas aquí datos personales ni de salud, ni llaves.** Los datos viven en Supabase, protegidos por RLS.

## Qué hay aquí

| Carpeta | Contenido |
|---|---|
| `public/` | La app (HTML, CSS, JS). Se publica tal cual en Cloudflare Pages. |
| `public/_headers` | Cabeceras de seguridad y política CSP estricta. |
| `supabase/schema.sql` | Tablas, políticas RLS y verificación en dos pasos obligatoria. |
| `supabase/functions/coach/` | Función del servidor que llama a Claude. La llave de Anthropic vive solo ahí. |
| `public/metas.js` | Reglas de metas: tipos, esfuerzo, disciplinas permitidas, bloqueo de metas mayores, semáforo de riesgo y plan por fases. |
| `public/marcas.js` | Marcas y experiencia por disciplina: validación, máximo estimado (Epley), archivo de marcas viejas y resumen de una línea para el coach. |
| `public/edicion.js` | Edición protegida (Editar → Guardar / Cancelar, una tarjeta a la vez) y reglas de los registros de peso. |
| `public/semanas.js` | Configuración semanal (días, minutos, disciplinas) guardada en `semanas/AAAA-MM-DD`, campo `config`. |
| `public/recuperacion.js` | Recuperación automática después de una carrera o meta lograda. |
| `tests/` | Pruebas de metas, marcas, edición, semanas y recuperación. Se corren con `node --test` (Node 18 o más nuevo). |

## Cómo está protegido

- **Login:** Supabase Auth, flujo PKCE. Sin registro público: tú creas la cuenta y luego cierras el registro.
- **Tokens:** el token de acceso dura 1 hora y se renueva con un token de refresco que rota en cada uso. Cerrar sesión lo invalida; hay opción de cerrarla en todos los dispositivos.
- **Dos pasos obligatorios (TOTP):** la base de datos rechaza cualquier token que no sea `aal2`. Sin el código de 6 dígitos no se lee ni se escribe nada.
- **Datos:** RLS con `force row level security`. Cada fila lleva tu `user_id`; el acceso anónimo está revocado. Hay límite de tamaño y de filas.
- **Coach:** la función valida el token contra Supabase, exige `aal2`, acepta solo tu sitio como origen, limita el tamaño de la entrada y las consultas por día (40 por defecto) y puede restringirse a tu usuario (`OWNER_USER_ID`).
- **Navegador:** CSP que solo permite scripts propios (la librería de Supabase va incluida en `public/vendor/`), sin estilos ni scripts en línea, sin iframes, HSTS, sin referrer.
- **Inactividad:** cierra la sesión tras 120 minutos sin usarla (`IDLE_MINUTES` en `config.js`).

Límite que conviene conocer: `supabase-js` guarda la sesión en `localStorage`, no en una cookie httpOnly. Por eso la CSP estricta y la ausencia de scripts de terceros son parte de la defensa. Si quieres una capa más, activa Cloudflare Access (paso 9).

## Pasos para publicarla

1. **Crea el proyecto en Supabase** (plan gratis). Guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. **Base de datos:** en *SQL Editor* pega y ejecuta `supabase/schema.sql`.
3. **Crea tu usuario:** *Authentication > Users > Add user*, con tu correo y una contraseña larga y única. Marca *Auto Confirm User*.
4. **Cierra el registro:** *Authentication > Sign In / Providers*, desactiva *Allow new users to sign up*. Mantén activado *Confirm email*.
5. **Contraseñas:** *Authentication > Password*, longitud mínima 12 y exige minúsculas, mayúsculas, números y símbolos. Si tu plan lo permite, activa *Leaked password protection*.
6. **Dos pasos:** en *Authentication > Multi-Factor* verifica que TOTP esté activado.
7. **Llaves públicas:** en *Project Settings > API* copia la *Project URL* y la llave *anon* a `public/config.js`. Nunca pongas ahí la `service_role`.
8. **Hosting:** en Cloudflare Pages conecta este repositorio. *Build command:* vacío. *Output directory:* `public`. Anota la URL (`https://algo.pages.dev`).
   - Vuelve a Supabase: *Authentication > URL Configuration*. *Site URL* = tu URL. En *Redirect URLs* pon solo esa URL.
9. **Coach:** crea en la consola de Anthropic una llave **solo para esta app** y fija un límite de gasto mensual. Luego, con la CLI de Supabase:
   ```
   supabase login
   supabase link --project-ref TU_REF
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGIN=https://algo.pages.dev OWNER_USER_ID=TU_USER_UUID
   supabase functions deploy coach
   ```
   `TU_USER_UUID` está en *Authentication > Users*.
10. **Primer ingreso:** abre tu URL, entra con tu correo y contraseña, escanea el QR con tu app de autenticación y guarda la clave que aparece debajo en tu gestor de contraseñas. Es tu recuperación si pierdes el teléfono.
11. **iPhone:** en Safari, *Compartir > Agregar a pantalla de inicio*.
12. **Opcional, capa extra:** Cloudflare Zero Trust > Access (gratis para una persona). Pone un login de Cloudflare antes de que cargue la página.

## Si pierdes el acceso

- **Perdiste el teléfono con los códigos:** en Supabase, *Authentication > Users*, abre tu usuario y elimina el factor de dos pasos. Al entrar de nuevo la app te pedirá activarlo otra vez.
- **Olvidaste la contraseña:** usa "Olvidé mi contraseña" en la pantalla de login.

## Pendiente

- Importar a esta versión los datos de la versión de prueba (hoy hay que capturarlos de nuevo).
- Conexión con Strava y Apple Salud.

## Reglas de metas

- **Una meta principal activa.** Las demás son secundarias. La primera meta que agregas es la principal.
- **Esfuerzo:** 5K < 10K < medio maratón < maratón < Ironman 70.3 < Ironman. Montaña: km + desnivel/100, equiparado a esa escala.
- **Bloqueo:** con una principal activa no se puede agregar ni cambiar a una meta de mayor esfuerzo. Se habilita cuando pasa su fecha o la marcas como lograda.
- **Disciplinas según la meta:** calle y montaña → correr y gym; triatlón → natación, bici, correr y gym. Las demás quedan bloqueadas, también en lo que devuelve el coach.
- **Fases:** base, desarrollo, afinación (hasta la fecha) y recuperación (después).

## Perfil por semana y edición protegida

- Semanal (en el documento de cada semana, campo `config`): días libres, días sin entrenar, día de sobreesfuerzo, minutos por día y disciplinas con sus días. Permanente (en el perfil): gimnasio, porqué, metas, experiencia, marcas y datos básicos.
- Cada semana usa su configuración; si no tiene, la de la semana anterior más cercana; si no hay ninguna, la que estaba en el perfil. El coach recibe la de la semana que genera.
- Todo se ve en modo lectura. Solo cambia con Editar → Guardar; Cancelar descarta. Una tarjeta a la vez: si hay cambios sin guardar, pregunta.

## Recuperación después de una carrera

- Se activa con una meta lograda, una marca de tipo carrera, o al confirmar en Hoy una meta con fecha pasada.
- Larga para ti: más que tu carrera más larga anterior, 21 km o más, o esfuerzo 5 de 5. Normal: el resto.
- Siempre: el día siguiente no se corre. Larga: 1 día de descanso completo (2 desde medio maratón) y la semana siguiente 35% menos. Normal: 20% menos. La semana después sube a la mitad de la reducción. Conservador / Normal / Exigente (en Mi experiencia) ajusta esos números.
- Se aplica localmente a los días que regresa el coach; el coach solo recibe una línea. Dentro de un plan, la semana de recuperación se inserta y el plan retoma la fase donde iba.

## Marcas y experiencia

- **Ficha por disciplina** (todo opcional): tiempo practicándola, veces por semana (ahora o antes), nivel que sientes y última vez.
- **Marcas** con campos según la disciplina; una marca puede ser solo una nota. Gym calcula el máximo estimado con Epley (peso × (1 + reps/30)), solo con 10 repeticiones o menos.
- Se guardan en el perfil: 30 por disciplina. Las más viejas pasan a `perfil/archivo` (hasta 200 por disciplina).
- El coach no recibe la lista: solo una línea por disciplina que esté en la semana y permitida por la meta principal.
- Las carreras registradas suben tu experiencia y la salida más larga del último mes llena ese dato si no lo escribiste; con eso se evalúan las metas y se arma el plan.

Estas reglas viven en `public/metas.js` y se validan en la app, no solo en el prompt. Para probarlas:

```
node --test
```
