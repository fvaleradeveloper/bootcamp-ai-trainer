// Rubricas oficiales de los 17 ejercicios, del lado del SERVIDOR.
//
// Por que existe: el cliente nunca envia la solucion ni el enunciado al endpoint
// /api/review, solo { ex, answer }. Asi el corrector no puede ser engañado con una
// rúbrica manipulada desde el navegador, y la correccion siempre es la misma que
// enseña la seccion del curso.
//
// Cada entrada:
//   modulo    -> titulo de la seccion, para que la IA cite la teoria concreta
//   enunciado -> que se supone que hace el codigo y cual es el sintoma
//   bug       -> la causa raiz (lo que el alumno DEBE detectar)
//   causa     -> el "por que" a nivel de lenguaje / runtime
//   cuando    -> bajo que condiciones se manifiesta
//   correccion-> el fix en una frase (el modelo puede comparar sin copiar)
//   mira      -> puntos de la rúbrica que hay que verificar en la respuesta
//   trampa    -> errores tipicos que el alumno suele cometer

export const RUBRIC = {
  "1.1": {
    modulo: "1. Asincronia JS/Node",
    enunciado:
      "Una funcion async envia notificaciones con usuarios.forEach(async ...) y devuelve un contador que siempre sale 0.",
    bug:
      "forEach NO espera las promesas del callback async: el return ocurre antes de que se ejecute cualquier incremento.",
    causa:
      "Array.prototype.forEach ignora el valor de retorno del callback; el loop termina sincronico y la funcion continua.",
    cuando: "Siempre. El console.log imprime 0 en el 100% de las ejecuciones.",
    correccion: "Usar for...of con await, o map() para recoger las promesas y await Promise.all(promesas).",
    mira: [
      "detecta que el problema es forEach descartando la promesa (no 'falta un await suelto')",
      "explica que el contador se lee/despues del loop",
      "propone map + Promise.all o for...of con await",
      "menciona que el total correcto es usuarios.length",
    ],
    trampa: "proponer Promise.all(usuarios.forEach(...)) o simply 'olvidar el await'.",
  },
  "1.2": {
    modulo: "1. Asincronia JS/Node",
    enunciado:
      "obtenerTodo(urls) con Promise.all sobre 50 fetch: si uno falla no se obtiene ninguno, no mira res.ok y lanza los 50 a la vez.",
    bug:
      "Tres bugs: no verifica res.ok, Promise.all colapsa entero con un solo rechazo, y no hay limite de concurrencia.",
    causa:
      "fetch solo rechaza por error de red, no por status 4xx/5xx; un 404 devuelve response valida y su .json() puede rechazar, hundiendo todo el Promise.all.",
    cuando: "Cuando un endpoint devuelve 404/500, o cuando muchas URLs saturan el pool de conexiones.",
    correccion: "Comprobar res.ok, usar Promise.allSettled para tolerancia a fallos y limitar la concurrencia.",
    mira: [
      "detecta los TRES bugs, no solo el del 404",
      "explica por que fetch no rechaza en un 404 (res.ok vs res.status)",
      "distingue all vs allSettled y cuando aplica cada uno",
      "menciona el limite de concurrencia (lotes, p-limit o semaphore)",
    ],
    trampa: "proponer solo try/catch alrededor del Promise.all sin revisar res.ok, o allSettled sin explicar la diferencia.",
  },
  "1.3": {
    modulo: "1. Asincronia JS/Node",
    enunciado:
      "getUser(id) toma una conexion de un pool y hace una query, pero tras horas de trafico la app deja de responder.",
    bug: "La conexion nunca se libera al pool: falta client.release() dentro de un bloque finally.",
    causa:
      "Cada pool.connect() ocupa una conexion. Sin release() en finally, un error de query deja la conexion taken para siempre.",
    cuando: "Tras el primer error de query (constraint, timeout). Progresivamente todas las requests esperan una conexion libre.",
    correccion: "try { ... } finally { client.release() }.",
    mira: [
      "identifica la fuga de conexiones del pool",
      "insiste en que release() va en un FINALLY (no despues del try ni en un catch)",
      "explica que sin finally el error se lleva la conexion",
      "menciona el agotamiento progresivo del pool (10-20 conexiones)",
    ],
    trampa: "proponer solo un catch con retry sin mencionar release(), o poner release() fuera del finally.",
  },
  "1.4": {
    modulo: "1. Asincronia JS/Node",
    enunciado:
      "incrementar() hace const actual = contador; await latencia(); contador = actual + 1. Diez llamadas simultaneas dan 1 en vez de 10.",
    bug:
      "Race condition: read-modify-write no atomico. Las 10 llamadas leen contador = 0 antes de que cualquiera escriba.",
    causa:
      "Entre la lectura y la escritura hay un await, asi que el event loop ejecuta otras microtasks en esa ventana.",
    cuando: "Siempre que haya concurrencia real (DB, red, timers) antes de que la primera escritura termine.",
    correccion: "Seria asincrona con mutex, o hacer la operacion atomica en la base de datos (UPDATE ... SET n = n + 1).",
    mira: [
      "nombra la race condition y la ventana read-modify-write",
      "explica que el await es justo donde se cuela el event loop",
      "propone serializacion (mutex/lock) o atomicidad en DB",
      "distingue 'a veces da 1' de 'siempre da 1' y sabe por que es no determinista",
    ],
    trampa: "proponer solo 'await' extra, o un setTimeout, sin serializar el acceso.",
  },
  "2.1": {
    modulo: "2. Python: tipos y excepciones",
    enunciado:
      "parse_precio() convierte strings a float con un except: desnudo y devuelve 0.0 cuando recibe None.",
    bug:
      "except: desnudo captura BaseException (incluido KeyboardInterrupt y SystemExit) y enmascara el TypeError de un None.",
    causa:
      "En Python, except: equivale a except BaseException:. Devolver 0.0 confunde 'formato invalido' con 'error grave'.",
    cuando: "Cuando llega None de la BD, hay un typo dentro del try, o el usuario intenta cancelar el proceso.",
    correccion: "except (ValueError, TypeError) explicito, dejar propagar el resto, y validar None antes.",
    mira: [
      "detecta el except desnudo (no solo el 0.0 silencioso)",
      "menciona que KeyboardInterrupt/SystemExit tambien se capturan",
      "propone tipos de excepcion concretos",
      "cuestiona el 0.0 silencioso como antidiseño",
    ],
    trampa: "proponer except Exception, que sigue siendo demasiado amplio y no distingue ValueError de None.",
  },
  "2.2": {
    modulo: "2. Python: tipos y excepciones",
    enunciado:
      "obtener_datos(usuario_id, cache={}) cachea consultas y los usuarios empiezan a ver datos de otros.",
    bug:
      "El dict como argumento por defecto se evalua UNA SOLA VEZ al definir la funcion: todas las llamadas comparten el mismo objeto mutable.",
    causa:
      "Los defaults se crean en tiempo de definicion, no en cada llamada; el dict persiste entre llamadas (y crece sin limite).",
    cuando: "Desde la segunda llamada, y en cualquier escenario donde la clave no incluya el contexto del usuario.",
    correccion: "cache=None y crear el dict dentro del cuerpo, o un cache por usuario con clave compuesta.",
    mira: [
      "identifica el argumento por defecto mutable",
      "explica que el default se evalua al definir la funcion, no al llamar",
      "menciona el memory leak por crecimiento sin limite",
      "propone None como sentinel y crear el dict dentro",
    ],
    trampa: "proponer solo deepcopy del default, o un lru_cache sin explicar el alcance del objeto compartido.",
  },
  "2.3": {
    modulo: "2. Python: tipos y excepciones",
    enunciado:
      "aplicar_descuento(precio, porcentaje=10) usa if porcentaje:, y un 0 explicito se confunde con 'no pasado'.",
    bug: "if porcentaje: trata 0 como falsy: no distingue 'no proporcionado' de 'proporcionado como 0'.",
    causa: "Python considera falsy a 0, '', [], {}, None y False; un truthiness check no sirve para testar presencia.",
    cuando:
      "Cuando el caller pasa 0 explicito. Aqui el resultado coincide matematicamente, pero el patron rompe en otros contextos (offset=0 en paginacion).",
    correccion: "if porcentaje is None: porcentaje = 10  (comparar contra None, no por truthiness).",
    mira: [
      "detecta la confusion truthiness vs None",
      "reconoce que en ESTE caso el resultado es igual y por que (conceptual)",
      "da un contraejemplo donde si es bug funcional",
      "usa 'is None' y no '== 0' ni 'if not porcentaje'",
    ],
    trampa: "afirmar que el resultado numerico es incorrecto, o proponer 'if porcentaje != 0' en vez de comparar con None.",
  },
  "3.1": {
    modulo: "3. Edge cases y algoritmos",
    enunciado: "crecimiento_porcentual(anterior, actual) divide por anterior y crashea cuando anterior = 0.",
    bug: "ZeroDivisionError con anterior = 0, y sin validacion de tipos ni rangos.",
    causa: "La formula (actual - anterior) / anterior tiene una singularidad en 0: pasar de 0 a valor positivo es crecimiento no definido.",
    cuando: "En el primer periodo de un producto nuevo, o cuando se reinician contadores.",
    correccion: "Validar anterior antes de dividir y devolver None, 0 o un valor marcado como 'no calculable'.",
    mira: [
      "detecta la division por cero",
      "explica por que es una singularidad matematica y no solo un error de runtime",
      "propone un contrato explicito para el caso anterior == 0",
      "menciona validacion adicional (tipos, negativos, actual < 0)",
    ],
    trampa: "proponer solo try/except ZeroDivisionError devolviendo 0, que confunde 'sin crecimiento' con 'crecimiento de 0%'.",
  },
  "3.2": {
    modulo: "3. Edge cases y algoritmos",
    enunciado: "paginar(items, pagina, por_pagina=10) calcula fin = inicio + por_pagina - 1 y pierde elementos.",
    bug: "El -1 sobra: en Python el slice tiene el final EXCLUSIVO, por lo que cada pagina devuelve un elemento menos.",
    causa: "Confusion entre indice inclusivo e exclusivo: para por_pagina elementos desde inicio hace falta [inicio:inicio + por_pagina].",
    cuando: "Siempre. La pagina 0 devuelve items[0:9] (9 elementos en vez de 10).",
    correccion: "fin = inicio + por_pagina (o directamente items[inicio:inicio + por_pagina]).",
    mira: [
      "detecta el off-by-one",
      "explica que el slice de Python es semiabierto [a, b)",
      "propone quitar el -1",
      "menciona validacion de pagina negativa o mayor que la total (no solo el -1)",
    ],
    trampa: "cambiar el -1 por un +1 (quedaria fin = inicio + por_pagina + 1) o no explicar la semantica del slice.",
  },
  "3.3": {
    modulo: "3. Edge cases y algoritmos",
    enunciado: "busqueda_binaria con izq = medio (sin +1) se cuelga en loop infinito si el target no esta.",
    bug: "izq = medio en vez de izq = medio + 1: la mitad izquierda nunca avanza y el rango no se reduce.",
    causa:
      "Con izq=3, der=4: medio=3, si arr[3] < target entonces izq=3 (sin cambio). La siguiente iteracion recalcula medio=3 y repite.",
    cuando: "Cuando el target no esta y la busqueda converge a un rango de 2 elementos con target mayor que el central.",
    correccion: "izq = medio + 1.",
    mira: [
      "localiza la asignacion sin +1",
      "reproduce la condicion de loop infinito (rango de 2 elementos)",
      "propone izq = medio + 1",
      "menciona que el array debe estar ORDENADO como precondicion",
    ],
    trampa: "proponer cambiar el while a '<' sin corregir la asignacion, o reescribir toda la busqueda sin encontrar el bug.",
  },
  "4.1": {
    modulo: "4. APIs, HTTP y seguridad",
    enunciado:
      "GET /productos/{id} con f-string en la query, sin 404, y que devuelve str(e) y la query al cliente.",
    bug:
      "Cuatro bugs: sin 404, SQL injection por f-string, fuga de la query SQL y del error interno, y sin HTTPException.",
    causa:
      "f\"...WHERE id = '{id}'\" permite cerrar comillas e inyectar SQL. str(e) puede contener nombres de tablas y columnas; sin 404 el cliente no distingue 'no existe' de 'error'.",
    cuando:
      "SQLi siempre que el atacante cierre la comilla (id = \"' OR '1'='1\"); fuga en cualquier error de BD; sin 404 siempre que el ID no exista.",
    correccion: "Parametros vinculados ($1), HTTPException(404), y loggear el error en el servidor sin devolverlo.",
    mira: [
      "detecta los CUATRO bugs, no solo el SQLi",
      "explica por que un f-string en WHERE esinyectable y por que ORDER BY necesita whitelist",
      "propone 404 explicito",
      "propone log server-side y respuesta generica al cliente",
    ],
    trampa: "sanear con html.escape o.Replace(\"'\", \"\") en vez de usar parametros vinculados.",
  },
  "4.2": {
    modulo: "4. APIs, HTTP y seguridad",
    enunciado: "GET /buscar concatena tres valores de usuario en la query con f-strings: q en LIKE, categoria en WHERE, orden en ORDER BY.",
    bug: "Tres vectores de SQL injection independientes, todos interpolados con f-strings.",
    causa:
      "Los f-strings no escapan nada. En ORDER BY no se puede usar $1, por lo que hace falta una WHITELIST de columnas.",
    cuando:
      "q = \"' UNION SELECT * FROM usuarios --\" o orden = \"precio; DROP TABLE productos\". Tambien al usar % en LIKE.",
    correccion:
      "Parametros vinculados para q y categoria; whitelist explicita para orden; escapar %, _ y \\ en el LIKE.",
    mira: [
      "detecta los TRES vectores por separado",
      "distingue que ORDER BY necesita whitelist y no se puede parametrizar",
      "menciona el escapado de caracteres especiales del LIKE (%, _)",
      "valida categoria contra una lista de categorias existentes",
    ],
    trampa: "proponer parametros vinculados para los tres, ignorando que ORDER BY no admite $1 en la mayoria de drivers.",
  },
  "4.3": {
    modulo: "4. APIs, HTTP y seguridad",
    enunciado:
      "POST /login loggea el password en claro, compara user.password == password y devuelve mensajes distintos si el email no existe.",
    bug:
      "Password en texto plano en los logs, comparacion de password sin hash, y mensajes de error distintos que permiten enumeracion de usuarios.",
    causa:
      "(1) Los logs se archivan y se comparten: la password queda expuesta. (2) Con hashes bcrypt, == nunca coincide. (3) 'Email no registrado' vs 'Password incorrecto' revela que emails existen.",
    cuando: "Inmediatamente en cada login; siempre si la BD tiene hashes; cualquier atacante puede enumerar emails validos.",
    correccion:
      "Nunca loggear secretos, comparar con bcrypt/argon2, y responder siempre el mismo mensaje generico con el mismo tiempo de respuesta.",
    mira: [
      "detecta los TRES bugs",
      "distingue == de una comparacion de hashes constante en tiempo",
      "explica el ataque de user enumeration",
      "menciona el riesgo del log (persistencia y alcance)",
    ],
    trampa: "proponer hashear sin explicar la enumeracion, o resolverla con un mensaje generico olvidando igualar el tiempo de respuesta.",
  },
  "5.1": {
    modulo: "5. Frontend y full-stack",
    enunciado: "renderResultados(query, resultados) concatena a mano y asigna todo a innerHTML: tres vectores de XSS.",
    bug:
      "query se inyecta en el h2, r.titulo en el texto del enlace, y r.url puede ser javascript:... en el href.",
    causa:
      "innerHTML interpreta HTML. query = <img src=x onerror=alert(1)> se ejecuta; r.url = javascript:alert(...) se ejecuta al hacer click.",
    cuando: "XSS reflejado si el atacante controla la query; XSS almacenado si otro usuario genero ese contenido.",
    correccion:
      "Escapar en el punto de salida con textContent / createElement, y validar el esquema del href contra una allowlist (http, https).",
    mira: [
      "detecta los TRES vectores, incluido el href con javascript:",
      "distingue XSS reflejado de almacenado",
      "propone textContent / createElement en vez de escapar a mano",
      "menciona la allowlist de esquemas para href (no basta con escapar comillas)",
    ],
    trampa: "proponer solo replace(/</g, '') o escapar comillas, que no protege el href javascript: ni el evento onerror.",
  },
  "5.2": {
    modulo: "5. Frontend y full-stack",
    enunciado: "El boton de pago dispara un fetch y muestra 'Pago exitoso' sin bloquear el boton, sin idempotency key y sin mirar res.ok.",
    bug: "Doble submit: no bloquea el boton, no manda idempotency key, y no verifica res.ok.",
    causa:
      "Entre el click y la respuesta (2-5 s) el boton sigue activo: cada click es un POST independiente, y sin clave de idempotencia el servidor no puede saber que son el mismo pago.",
    cuando: "Con redes lentas, servidor sobrecargado, o en movil con alta latencia.",
    correccion:
      "Disable del boton durante el request + rehabilitarlo en finally, cabecera Idempotency-Key, y comprobar res.ok.",
    mira: [
      "identifica el doble submit como bug principal",
      "distingue el arreglo en cliente (bloqueo) del de servidor (idempotency key)",
      "menciona que el bloqueo debe liberarse en finally para no dejar el boton muerto si la request falla",
      "verifica res.ok antes de mostrar 'Pago exitoso'",
    ],
    trampa: "proponer solo disabled=true sin indicar donde se rehabilita, o creer que deshabilitar el boton ya evita el doble cobro en el servidor.",
  },
  "5.3": {
    modulo: "5. Frontend y full-stack",
    enunciado: "setInterval(async () => { fetch('/api/status') ... }, 5000) para refrescar datos cada 5 s.",
    bug: "setInterval no espera al callback async: hay reentrada y se acumulan requests. Sin backoff.",
    causa:
      "Si la respuesta tarda 8 s, a los 5 s se lanza otro fetch, a los 10 s otro, etc. Requests concurrentes que pueden saturar el servidor y provocar race conditions en la UI.",
    cuando: "Servidor lento, alta latencia o pico de trafico: efecto bola de nieve.",
    correccion:
      "Sustituir por un setTimeout recursivo al final del callback (o un flag de vuelo), mas backoff exponencial ante fallos.",
    mira: [
      "explica que setInterval no espera, en vez de decir solo 'falta limpiar el interval'",
      "distingue el sintoma (se acumulan) del mecanismo (reentrada)",
      "propone setTimeout recursivo o flag de request en vuelo",
      "menciona backoff exponencial con jitter para cuando el servidor falla",
    ],
    trampa: "proponer clearInterval dentro del callback, que corta el polling en vez de evitar la reentrada.",
  },
  "6.1": {
    modulo: "6. Simulacro final",
    enunciado:
      "API de reservas de hotel: cobra con Stripe, inserta en la DB, envia email por SMTP, todo sincrono, con secretos en el codigo y el token en los logs.",
    bug:
      "17 bugs repartidos en 5 categorias: 4 de seguridad (S1-S4), 5 de validacion (V1-V5), 4 de manejo de errores (E1-E4), 3 de logica de negocio (L1-L3) y 1 de concurrencia (C1).",
    causa:
      "S1/S2 secretos hardcodeados; S3 PII y token de pago en logs; S4 SQL injection con f-string. V1-V5 sin validacion de tipos ni rangos ni de existencia. E1-E4 sin timeout ni try/except y con el email DESPUES de cobrar. L1-L3 sin idempotencia, precio hardcodeado y orden cobrar-confirmar-notificar. C1 def sincrono bloqueando el event loop.",
    cuando:
      "S4 con cualquier input malicioso; V3 como DoS financiero; E3 si falla el email tras cobrar; L1 con doble click; C1 con cualquier carga concurrente.",
    correccion:
      "Variables de entorno para los secretos, Pydantic para validacion, parametros vinculados, SMTP con timeout y try/except, confirmar en DB antes de notificar, Idempotency-Key, y async def con httpx y aiosmtplib.",
    mira: [
      "cubre las 5 categorias y da una severidad justificada a cada bug",
      "detecta E3 y L3 (el orden cobrar antes de confirmar) como los mas criticos",
      "propone el orden reservar pendiente -> cobrar -> confirmar -> notificar",
      "detecta los secretos hardcodeados y el token en logs",
      "detecta el def sincrono bloqueando el event loop",
    ],
    trampa:
      "quedarse en 4 o 5 bugs de los 17, o listarlos sin severidad ni justificacion: la rúbrica del curso exige priorizarlos.",
  },
};

// Los ids validos: el endpoint no acepta nada fuera de esta lista.
export const VALID_IDS = Object.keys(RUBRIC);

// La rúbrica de la seccion "examen", tal como la enseña el curso.
export const WEIGHTS = [
  { key: "deteccion", label: "Deteccion del bug", pct: 35 },
  { key: "explicacion", label: "Explicacion tecnica", pct: 30 },
  { key: "correccion", label: "Correccion funcional", pct: 20 },
  { key: "claridad", label: "Claridad y formato", pct: 15 },
];