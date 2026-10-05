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
```

`firma-del-cliente.mjs` comprueba que al cliente no se le pide nada más que firmar y que, si el
servidor rechaza su firma, no ve letra de técnico ni se le encarga nada.

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
