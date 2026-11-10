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
node pruebas/navegador/el-anio-del-convenio.mjs      # el folio toma el año de la vigencia
node pruebas/navegador/filtrar-por-ejecutivo.mjs     # ver sólo lo de una persona
node pruebas/navegador/certificados-para-ventas.mjs  # quién los puede emitir
node pruebas/navegador/falta-subir.mjs              # el aviso de lo que no subió
node pruebas/navegador/renombrar-a-alguien.mjs      # el nombre se lleva sus papeles
node pruebas/navegador/certificados.mjs             # el folio no se repite y quién emite
node pruebas/navegador/arranque.mjs                 # que la aplicación abra
node pruebas/navegador/no-se-pierde-lo-escrito.mjs  # guardar guarda de verdad
node pruebas/navegador/servicios-de-banquetes.mjs   # la propuesta sale del catálogo
node pruebas/navegador/firmas-que-no-llenan.mjs     # una firma no llena el navegador
node pruebas/navegador/copia-local.mjs              # la copia vive en IndexedDB
node pruebas/navegador/salones.mjs                  # el salón y su renta por rato
node pruebas/navegador/contrato-de-banquetes.mjs    # las 19 cláusulas, completas
node pruebas/navegador/contratos-en-papel.mjs       # el contrato no se firma en pantalla
node pruebas/navegador/opciones-del-contrato.mjs    # comisión y desayuno
node pruebas/navegador/la-liga-del-hotel.mjs        # un equipo nuevo no configura nada
node pruebas/navegador/editar-antes-de-la-firma.mjs # se corrige hasta que firme el cliente
node pruebas/navegador/beneficios-del-convenio.mjs  # el spa y la transportación, sin Care
node pruebas/navegador/los-departamentos-de-la-liga.mjs # lo que ve la liga de las ODTs
node pruebas/navegador/solo-las-ordenes.mjs         # el papel que sólo ve las ODTs
node pruebas/navegador/politicas-del-contrato.mjs   # el contrato de ventas, completo
node pruebas/navegador/observaciones-del-convenio.mjs # las que sí salen en la carta
node pruebas/navegador/subir-en-trozos.mjs          # la subida no truena por grande
node pruebas/navegador/la-firma-que-no-entro.mjs    # una firma de cliente no se pierde callada
node pruebas/navegador/los-folios-no-se-pierden.mjs # el folio nuevo lo da el contador
node pruebas/navegador/un-documento-no-se-cae-solo.mjs # sin cliente no es sin documento
node pruebas/navegador/la-version-a-la-vista.mjs    # qué versión traigo, y actualizar
node pruebas/navegador/varias-tarifas-en-el-convenio.mjs # una tarifa por desayuno
node pruebas/navegador/buscar-documentos.mjs       # buscar por folio en las listas
node pruebas/navegador/de-cotizacion-a-contrato.mjs # CO y CT, con un solo número
node pruebas/navegador/descargado-para-firma.mjs   # el convenio que sale por fuera
```

`firma-del-cliente.mjs` comprueba que al cliente no se le pide nada más que firmar y que, si el
servidor rechaza su firma, no ve letra de técnico ni se le encarga nada.

`los-folios-no-se-pierden.mjs` cuida el contador. Cuando dos equipos toman el mismo folio, la
renumeración automática **se inventaba** el número nuevo —contando lo que ese equipo tiene
bajado— y **no se lo avisaba al contador del servidor**, así que éste lo volvía a repartir y se
volvía a chocar: un contrato acabó con tres folios y dos huecos en la serie. Se afirma que el
número sale del contador, que **después de renumerar el contador ya no lo reparte** —la rueda—,
y que sin contador **no se inventa nada**. También cuida *Corregir el folio*, que es la salida
para cuando el papel firmado trae el número anterior: que lo deje poner, que **no** deje poner uno
que ya trae otro documento ni uno de otra serie, que el número corregido quede apartado en el
contador, y que una ejecutiva no pueda hacerlo. Sus grupos de control son lo que no puede
romperse: un documento ya emitido, enviado o reabierto sigue sin renumerarse solo, y dos
borradores que de verdad chocan se siguen arreglando solos.

`renombrar-a-alguien.mjs` nace de un reporte de Marco: le puso los acentos al nombre de un
ejecutivo en Ajustes y el hombre dejó de ver sus convenios y sus actividades. Monta a una persona
con clientes, convenios, contratos, eventos, prospectos, campañas y un certificado, le cambia el
nombre y exige que el CRM **ofrezca llevarse los papeles** y que al aceptar se muevan **los nueve
campos**, no los dos de antes. Si se dice que no, nada se mueve y el nombre viejo sale en
*«Nombres que no son de nadie»* **con sus documentos contados** — que era justo el número
invisible. Sus grupos de control: `ejecutivoBq` se renombra donde ya estaba y **no se inventa**
donde no; cambiar sólo el correo o el papel no pregunta nada; un nombre sin papeles tampoco; y un
convenio ya firmado **sigue imprimiendo el nombre con el que se firmó**.

`falta-subir.mjs` cuida la ventana del chip, la que sale al picarle a «Falta subir N». Nace de
una captura de Marco en la que cuatro renglones decían «Un cliente» y nada más: eran fichas de
otras personas que esa computadora no puede subir, y sin el nombre de la empresa no había manera
de ir a buscarlas. Se exige que cada renglón **nombre la ficha**, que cuando es de otra persona
diga que desde esa cuenta no va a entrar y cómo sacarla, y que avise de que lo rechazado puede
estar sólo en ese equipo. Los grupos de control son los que la sostienen: un convenio sigue
saliendo con su folio, un registro que ya no está en el equipo sigue cayendo en el genérico sin
romper la ventana, un rechazo **propio** no manda a nadie a exportar nada, y los otros motivos
—clave repetida, regla del servidor— no se contagian del texto nuevo.

`certificados-para-ventas.mjs` cuida las dos mitades de lo que reportó Marco el mismo día. La
primera: que la Gerencia de ventas, los ejecutivos y la dirección **vean la pestaña** sin que
nadie les prenda nada, y que en Ajustes su casilla salga prendida y apagada —y que guardar **no
les escriba la llave**, que haría verse editada una ficha que no cambió—. La segunda levanta un
servidor de mentiras al que se le puede pedir que **rebote** la lista de usuarios, como hace
PostgREST con `roles.sql` puesto: se exige que «Guardar usuarios» espere, que **no diga que subió**
cuando no subió, y que sí lo diga cuando sí. Su grupo de control es banquetes: sigue sin
certificados, con palomita o sin ella, porque la pestaña no está en la lista de su papel.

`filtrar-por-ejecutivo.mjs` cuida el filtro por persona en las listas de convenios y contratos.
Mide que filtre por **lo mismo que imprime la columna Ejecutivo** —incluido el documento que
levantó una persona para el cliente de otra—, que la cuenta y el vacío digan que hay filtro puesto
y cómo quitarlo, y que los avisos de folio repetido y de documento sin cliente **no se escondan**
detrás de él. El grupo de control que no se puede romper es el último: a un ejecutivo el select no
se le enseña y su lista le sale **completa**, aunque el filtro traiga un nombre de otra pantalla.
Un filtro que muerde donde su control no se ve vacía la lista sin manera de vaciarlo, que es
exactamente lo que ya pasó una vez con la caja de búsqueda.

`el-anio-del-convenio.mjs` nace de una pregunta de Marco: «CV-2026-101 aparece como 2026 por qué
si es del 2027?». El año del folio salía de la **vigencia desde** y el de la carta de la
**vigencia hasta**, así que un convenio capturado en noviembre para la temporada siguiente decía
2027 en su texto y 2026 en su número. La prueba exige que manden las dos cosas lo mismo, en los
tres caminos por los que un convenio toma número —la firma, el firmado en papel y el escaneado de
fuera—, que el año nuevo arranque en 001 aunque el anterior tenga cien, y que **el convenio de
enero a diciembre siga dando exactamente el folio que daba**, que es el grupo de control que no se
puede romper. Cuida también lo que no se arregla con una regla: que un folio ya repartido no se
mueva solo, que la carta diga por qué cuando el año dejó de cuadrar, y que corregirlo sea de la
administración y deje rastro.

`descargado-para-firma.mjs` cuida el convenio que sale del hotel **por fuera**: se descarga o se
imprime y se manda a mano. Lo nuevo —el estado y el NA— se mide, pero el peso de la suite está en
los grupos de control, porque aquí la marca puede volverse una mentira al revés: bajar un
**borrador** para revisarlo no es haberlo mandado, bajar una carta **ya firmada** es archivarla,
y un convenio que **sí se mandó por WhatsApp** no dice NA. El primer bloque es el de siempre: sin
descargar nada, la lista sale exactamente igual que hoy.

`beneficios-del-convenio.mjs` cuida además los **textos atrasados**. Un convenio guarda su copia
de los textos el día que nace, así que uno viejo no imprime los beneficios —ese texto no existía
cuando nació— y hasta ahora no había cómo enterarse ni cómo arreglarlo. Se afirma que la ficha lo
dice y lo explica, que el botón los pone al día y queda en la bitácora, y dos grupos de control:
a una carta **firmada por el cliente no se le ofrece** —cambiarle las palabras es otra cosa— y un
convenio con sus textos al día **no enseña ningún aviso**, porque un aviso que sale siempre deja
de leerse.

`de-cotizacion-a-contrato.mjs` cuida las dos letras de hospedaje y el paso de una a otra: que
una cotización se numere CO y un contrato CT, que al convertir se conserve el número y **no se
gaste otro del contador**, que la cotización se quede pero **su dinero deje de contarse** —si no,
el mismo ingreso se contaría dos veces— y que un contrato y su cotización **no se tomen por un
folio repetido**, que es lo que pasa cuando la cotización es de las viejas y los dos folios
quedan idénticos. Sus grupos de control: una cotización vieja con CT no se toca, y un repetido de
verdad se sigue marcando.

`buscar-documentos.mjs` cuida el buscador de las cuatro listas de documentos: que encuentre por
folio y por cliente, que deje fuera lo que no coincide, que diga cuántos coinciden y qué hacer
cuando no hay ninguno. Y una aserción que no es cosmética: **que la caja se vea**. Una caja
escondida que filtra es peor que no tener buscador —los renglones desaparecen y nadie puede
vaciarla—, y eso ya pasó una vez con contratos.

`varias-tarifas-en-el-convenio.mjs` cuida el convenio con una tarifa por modalidad de desayuno.
Su primer bloque es el grupo de control, y va primero a propósito: **un convenio de una sola
tarifa tiene que salir exactamente igual que antes**, porque los que ya andan firmados no pueden
cambiar. Después mide lo nuevo: una tabla por tarifa, la habitación que no se ofrece con cierto
desayuno ausente de esa tabla, el saneador que no deja entrar modalidades inventadas ni tarifas
en cero, la exportación con un renglón por tarifa, y el editor manejado como lo maneja una
persona —picándole a las pastillas, que es lo único que se puede picar: el `input` está escondido
a propósito—.

`la-version-a-la-vista.mjs` cuida el número de versión de abajo a la izquierda y el botón que
actualiza: que se vea sin entrar a Ajustes, que el programa se entere solo de que hay una versión
nueva publicada, que lo **diga** en vez de recargarle la página a alguien por su cuenta, que el
botón se salte la copia guardada del navegador —o la recarga serviría otra vez la vieja— y que
cuando no hay nada nuevo **lo diga**, en vez de hacer como que actualizó. Es una función nueva,
así que contra la versión de antes se pone roja porque las funciones no existen, no porque mida
una regresión.

`un-documento-no-se-cae-solo.mjs` nace del peor error que ha tenido este CRM: un contrato
firmado que **desapareció de todos los equipos**. `sanear()` descartaba cualquier documento cuyo
cliente ya no estuviera en la cartera, y eso corre en cada sincronización y en cada arranque. Se
afirma que ahora **se queda**, que sobrevive a la recarga, que sale marcado y que se puede volver
a ligar. Su grupo de control es el que no se puede romper: **borrar a propósito sigue mandando su
lápida**. Dos aserciones están marcadas como *guardia* a propósito: cuidan que esa caída no se
convierta en lápida, pero contra la versión vieja salen verdes, así que no miden —lo dice el
encabezado del archivo—.

`la-firma-que-no-entro.mjs` es la otra mitad: lo que pasa **del lado del hotel** cuando la firma
ya llegó. Hay tres casos en los que no se aplica —se firma en papel, ya estaba firmado, la clave
ya no corresponde— y los tres se rechazaban sin decirlo: el sondeo automático se comía la
explicación y marcaba la fila como recogida. Se afirma que el aviso queda, que **aguanta una
recarga**, que sale en el chip, que lo que falta subir le sigue ganando, y que *Firmas recibidas*
encuentra una firma ya marcada sin imprimir su imagen. El grupo de control es el que no se puede
romper: una firma buena se sigue aplicando sola y en silencio.

`editar-antes-de-la-firma.mjs` cuida las dos mitades de una misma regla en las **tres**
familias de documentos —convenios, contratos de hospedaje y banquetes—: que se pueda corregir
mientras el cliente no haya firmado, y que no se pueda en cuanto firmó, por pantalla o en papel.
Y lo que cuesta corregir: el documento vuelve a borrador, pierde la firma del hotel y el enlace,
pero **conserva su folio**, que ya se apartó en el contador y no se gasta otro por una coma.

`la-liga-del-hotel.mjs` sirve **dos copias del mismo `index.html`** —una con la línea de
`CORE_NUBE` llena y otra sin ella— y mira qué hace un navegador recién estrenado con cada una.
Es lo que sostiene el alta de todo el equipo: si se rompe en silencio, cada quien vuelve a pegar
la dirección y la llave a mano.

`opciones-del-contrato.mjs` cuida las opciones que se le fueron agregando al contrato de
ventas —comisión y desayuno— y en las dos mide lo mismo: que **sin tocarlas el documento diga
exactamente lo de siempre**. Quien no las use no tiene por qué notar nada, y los contratos que
ya andan por ahí tampoco pueden cambiar de texto solos. Lleva su grupo de control: la
carta-convenio, que Marco pidió dejar quieta.

`beneficios-del-convenio.mjs` nace de algo que Marco vio en un convenio ya hecho: el 20% del
spa y la transportación *Hotel - Empresa - Hotel* sólo salían si el convenio traía una
habitación **Care**, porque vivían en el bloque Recovery y ese bloque no se imprime sin
habitaciones de ahí. No son beneficios de la habitación de recuperación, así que ahora salen en
la tira de abajo de la tabla de tarifas, **junto al renglón del desayuno**, que es donde Marco
los quiere leer. Lo que la prueba cuida de verdad no es el texto: es la **migración**. Los
ajustes guardados le ganan al texto de fábrica, así que un hotel que ya trabajó no habría visto
el cambio nunca; y el contrapeso, que a quien escribió su propia versión **no se le pise**, que
sería peor que la falla que se arregla. Mide además que un convenio ya hecho no cambie solo:
cada uno guarda su copia de los textos, y un documento que ya está en manos del cliente no se
mueve debajo de él — pero un **borrador** sí se pone al día al abrirlo, igual que ya pasaba con
la tarifa pública del catálogo, que es lo que destraba el caso real: corregir un texto en Ajustes
y que el borrador en curso se entere.

`los-departamentos-de-la-liga.mjs` sale de un reporte de Marco: agregó un departamento para
las órdenes de trabajo y no le aparecía en la liga. No era un error: el formulario que abren los
jefes de área **no lee la tabla de Ajustes de esa computadora, se la pide al servidor**, así que
un departamento recién escrito no existe para la liga hasta que ese renglón sube — y el CRM no
lo decía en ninguna parte. Ahora se puede preguntar, y lo que la prueba cuida es lo que hace que
la respuesta valga: que **suba antes de preguntar** —si no, contestaría «te falta» por la única
razón que no importa—, que pregunte con **la misma función que usa el formulario** y no con una
consulta parecida escrita aparte, y que distinga «falta correr odts.sql» de «el servidor no
contestó», que se arreglan de maneras muy distintas.

`solo-las-ordenes.mjs` cuida el papel **Órdenes de trabajo**, que Marco pidió para la
asistencia de dirección: una sola pestaña y nada más. Mide que no se cuele de más —se le dio a
alguien precisamente para que no viera la cartera—, que no le pidan escoger departamento al
entrar, y que los demás papeles no se hayan movido. Pero el bloque que de verdad importa es el
último: **que `roles.sql` nombre el papel**. El servidor decide por su cuenta qué le manda a
cada quien, y un papel que no esté ahí cae en la rama de ventas, que excluye las órdenes; sería
una cuenta que entra, ve su pestaña y la encuentra vacía para siempre, sin un solo error en
pantalla. La mitad de ese cambio vive en un archivo que el hotel tiene que correr, y eso es lo
que esta prueba impide que se nos olvide.

`politicas-del-contrato.mjs` nace de un contrato de verdad que mandó Marco: «los contratos y
cotizaciones en ventas son casi iguales, sin embargo los contratos tienen muchas más políticas»,
y en seguida el recordatorio que fija el alcance: «el contrato de ventas y los de banquetes son
distintos». El contrato de hospedaje pasó de tres secciones a veinte, y la prueba cuida sobre
todo lo que NO debía moverse: que **la cotización siga igual** y no cargue ni una de las llaves
nuevas, y que **el contrato de banquetes no se haya tocado** —ése es el grupo de control—.
Además mide que lo que falta se imprima como una raya en vez de callarse, y que los datos del
hotel salgan de Ajustes y no del código, porque el repositorio es público.

`observaciones-del-convenio.mjs` cuida los **dos** campos de notas de la carta-convenio: el
interno, que nunca se imprime, y el que Marco pidió «adicional», que sí lo lee el cliente. El
bloque que importa es el grupo de control: si los dos se cruzan, una nota del equipo —«ojo,
este cliente paga tarde»— acabaría impresa delante de él. Mide además que los saltos de renglón
del textarea lleguen al papel, que vacío no imprima ni el encabezado, y que el campo nazca al
usarse.

`contratos-en-papel.mjs` cuida lo que pidió el departamento legal del hotel: que a un
**contrato** no se le pueda sacar una firma por ningún camino —ni el lienzo, ni el enlace, ni
el buzón, ni un enlace viejo que alguien haya guardado—, porque sólo un sistema certificado
puede emitir firma digital. Quitar el botón no es quitar la función, y eso es justo lo que
mide. Lleva además su grupo de control: las **cotizaciones** se siguen firmando en pantalla, y
si eso se pone rojo es que se quitó de más.

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
