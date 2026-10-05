#!/bin/sh
# Levanta un PostgreSQL de verdad, corre los .sql del proyecto y comprueba que
# un cliente puede firmar desde su enlace.
#
#   sh pruebas/sql/correr.sh
#
# Las reglas de fila (RLS) no se pueden probar con un servidor de mentiras:
# o se corren contra PostgreSQL, o no se están probando.
set -e
BIN=/usr/lib/postgresql/16/bin
DATOS=${DATOS:-/var/lib/pgtest}
SOCK=/tmp/pgsock
TRABAJO=/tmp/pruebasql
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)

id pg >/dev/null 2>&1 || useradd -m pg
mkdir -p "$SOCK" "$TRABAJO"
chown pg "$SOCK" "$TRABAJO"

if [ ! -d "$DATOS" ]; then
  mkdir -p "$DATOS" && chown pg "$DATOS"
  su pg -c "$BIN/initdb -D $DATOS -U postgres --auth=trust" >/dev/null
fi
su pg -c "$BIN/pg_ctl -D $DATOS -o '-p 5433 -k $SOCK' -l $DATOS/pg.log status" >/dev/null 2>&1 ||
  su pg -c "$BIN/pg_ctl -D $DATOS -o '-p 5433 -k $SOCK' -l $DATOS/pg.log start" >/dev/null

PSQL="$BIN/psql -h $SOCK -p 5433 -U postgres -v ON_ERROR_STOP=1 -q"

cp "$RAIZ"/*.sql "$RAIZ"/pruebas/sql/*.sql "$TRABAJO"/
# El pegado a medias: el archivo cortado justo donde tira la regla del buzón.
head -75 "$RAIZ/firmas.sql" > "$TRABAJO/firmas_cortado.sql"

# El CRM no pega el archivo tal cual: le quita los comentarios para que quepa
# por debajo de los 100 renglones, que es donde a Marco se le ha cortado el
# pegado DOS veces. Eso lo hace sqlSinComentarios() dentro del index.html, y
# una transformación de SQL no se da por buena a ojo: si FIRMAS_COMPACTO apunta
# a lo que de verdad produce esa función, se corre ESO en vez del archivo.
if [ -n "$FIRMAS_COMPACTO" ] && [ -f "$FIRMAS_COMPACTO" ]; then
  echo "Usando el SQL compactado que copia el CRM ($(wc -l < "$FIRMAS_COMPACTO") renglones)."
  cp "$FIRMAS_COMPACTO" "$TRABAJO/firmas.sql"
fi
chmod a+r "$TRABAJO"/*.sql

su pg -c "$PSQL -c 'drop schema if exists public cascade; create schema public; drop schema if exists storage cascade;'" >/dev/null
su pg -c "$PSQL -f $TRABAJO/andamio.sql" >/dev/null

echo "Corriendo los .sql del proyecto:"
for f in nube firmas roles odts folios marketing prospectos archivos meta whatsapp; do
  if su pg -c "$PSQL -f $TRABAJO/$f.sql" >/dev/null 2>&1; then echo "  $f.sql ok"
  else echo "  $f.sql FALLA"; su pg -c "$BIN/psql -h $SOCK -p 5433 -U postgres -f $TRABAJO/$f.sql" 2>&1 | grep ERROR | head -2; exit 1; fi
done

echo ""
echo "La firma del cliente:"
su pg -c "$BIN/psql -h $SOCK -p 5433 -U postgres -q -f $TRABAJO/firma-del-cliente.sql" 2>&1 |
  grep -vE "^(SET|BEGIN|COMMIT|INSERT|UPDATE|SAVEPOINT|DO|NOTICE:  relation|NOTICE:  policy|NOTICE:  trigger|NOTICE:  function|NOTICE:  schema|resultado|---|\(1 row\)|^$)" |
  sed 's/^NOTICE:  //'
