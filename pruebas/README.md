# Las pruebas

Viven **dentro del repositorio** a propósito. Antes vivían en el directorio temporal de la
sesión en la que se escribieron, y un reinicio del contenedor se las llevó completas: eran
justo lo que había atrapado cada una de las regresiones de este proyecto.

## `sql/` · PostgreSQL de verdad

```sh
sh pruebas/sql/correr.sh
```

Levanta un PostgreSQL 16, corre los diez `.sql` del proyecto y comprueba, **como `anon`**, que
un cliente puede firmar desde su enlace: que lee su documento con su clave, que deposita su
firma, que con una clave que no es la suya no entra, que con el documento borrado tampoco, y
que un `firmas.sql` pegado a medias no deja el buzón peor de como estaba.

El CRM no pega el archivo tal cual: le quita los comentarios para que quepa por debajo de los
100 renglones. Esa transformación **también se corre contra PostgreSQL**, porque un SQL
transformado no se da por bueno leyéndolo:

```sh
node pruebas/navegador/… ó sacar el texto de sqlSinComentarios() a un archivo
FIRMAS_COMPACTO=/ruta/firmas-compacto.sql sh pruebas/sql/correr.sh
```

Las reglas de fila (RLS) **no se prueban con un servidor de mentiras**. Un servidor inventado
acepta lo que uno le programe que acepte; el error que vio un cliente de verdad —*new row
violates row-level security policy*— sólo lo contesta PostgreSQL.

## `navegador/` · lo que ve el cliente

```sh
node pruebas/navegador/firma-del-cliente.mjs          # lo que ve el cliente
node pruebas/navegador/firma-del-cliente.mjs --fotos  # además deja capturas
node pruebas/navegador/enlace-que-no-sirve.mjs        # lo que ve el ejecutivo
node pruebas/navegador/borrar-se-propaga.mjs         # un borrado llega a todos
node pruebas/navegador/copiar-es-enviar.mjs          # copiar el enlace es mandarlo
node pruebas/navegador/folios-repetidos.mjs          # dos documentos con el mismo folio
node pruebas/navegador/copiar-el-sql.mjs             # el .sql llega entero
node pruebas/navegador/certificados.mjs             # el folio no se repite y quién emite
node pruebas/navegador/arranque.mjs                 # que la aplicación abra
node pruebas/navegador/no-se-pierde-lo-escrito.mjs  # guardar guarda de verdad
node pruebas/navegador/servicios-de-banquetes.mjs   # la propuesta sale del catálogo
node pruebas/navegador/firmas-que-no-llenan.mjs     # una firma no llena el navegador
node pruebas/navegador/copia-local.mjs              # la copia vive en IndexedDB
node pruebas/navegador/salones.mjs                  # el salón y su renta por rato
node pruebas/navegador/contrato-de-banquetes.mjs    # las 19 cláusulas, completas
node pruebas/navegador/firma-de-banquetes.mjs       # el enlace de firma y el formulario
```

`firma-del-cliente.mjs` comprueba que al cliente no se le pide nada más que firmar y que, si el
servidor rechaza su firma, no ve letra de técnico ni se le encarga nada.

`firma-de-banquetes.mjs` es la del contrato de banquetes firmado desde el enlace. Lo que de
verdad cuida: la pantalla de firma corre en el navegador **del cliente**, que no tiene los
ajustes del hotel, así que lo que el contrato dice del hotel —razón social, RFC, banco, cuenta,
CLABE— se congela dentro del documento al firmarlo el hotel. Sin eso el cliente abriría un
contrato lleno de rayas. Y comprueba el otro lado: que el formulario que él llena tiene
**sólo los campos suyos**, nunca uno del hotel.

`arranque.mjs` es la que faltaba. Marco se quedó mirando el logo morado de la entrada y en
incógnito sí abría: lo que la mataba eran **los datos guardados** de ese navegador. Se le pone
al navegador un almacenamiento como el suyo —con un certificado guardado, con un renglón sin
`id`, con el almacenamiento echado a perder— y se exige que la aplicación **abra**, que el logo
se quite, que el tablero se pinte y que no se escriba encima de la cartera. El último caso es
el que más importa: se sirve el archivo con una bomba metida a propósito y se exige que **se
vea qué pasó**, porque lo que de verdad falló fue que hubo un error y nadie lo supo.

`no-se-pierde-lo-escrito.mjs` levanta un servidor de mentiras y **dos equipos de verdad**. Al
aplicar lo que baja, la sincronización reemplaza el estado entero; una pantalla abierta se queda
con las referencias de antes y al guardar escribe en un objeto que ya nadie mira —decía
«Guardado ✓» y no guardaba nada—. Se cuidaba preguntando por `.overlay`, o sea sólo por las
ventanas, y **Ajustes no es una ventana**. La prueba exige que lo tecleado sobreviva, que al
cerrar sí entre lo del otro equipo, y —para que no se pase sola— que la nube de verdad trajera
algo que aplicar.

También atrapó, poniéndose roja de vez en cuando, que el guardián estaba en `sincronizar()`
pero no en `primeraSincronizacion` —la que corre al enlazar un equipo y al volver a entrar—,
que también reemplaza el estado entero. Se vence la sesión con una cotización abierta, la
persona vuelve a entrar y lo que llevaba escrito se pierde al guardar. Una prueba que falla una
de cada seis veces no es una prueba flaky: es un defecto que aparece una de cada seis veces.

`enlace-que-no-sirve.mjs` comprueba lo de antes del enlace: que si al servidor le falta el buzón
de firmas, al ejecutivo **no se le ofrece el enlace** y se le dice por qué — y que si lo que se
cayó fue la red, no se le estorba.

Necesita `playwright` y un Chromium. Si el Chromium no está donde la prueba lo busca, se le
dice con `CHROME_PATH`. Con `APP_HTML` se le puede apuntar a **otra copia del `index.html`**,
que es como se comprueba que la prueba de verdad atrapa algo: corrida contra la versión
anterior tiene que ponerse roja.

> Esa comprobación no es ceremonia. En este proyecto ya se escribió una prueba que pasaba
> **con el error metido de vuelta a propósito**. Una prueba que nunca se ha visto fallar no
> es una prueba.

## Nada de datos de verdad

El repositorio es público. Todo lo que aparece aquí —empresas, personas, teléfonos, claves— es
inventado, y las llaves son de mentiras. Ningún dato de ningún cliente del hotel entra a este
directorio.
