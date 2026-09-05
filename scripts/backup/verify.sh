#!/usr/bin/env bash
# Huella de contenido de un snapshot de Convex: documentos por tabla, ficheros
# de _storage y los datos que un volcado incompleto perdería primero (cuadernos
# con texto, entidades con relaciones).
#
# Corre igual sobre el snapshot que se respaldó y sobre uno exportado del
# deployment restaurado; si `diff` no dice nada, la restauración trajo todo.
# Sólo lee. Acepta el .zip en claro o el .zip.age (entonces necesita
# AGE_IDENTITY_FILE).
#
# Uso: scripts/backup/verify.sh <snapshot.zip | snapshot.zip.age>
set -euo pipefail
snapshot="${1:?Falta el snapshot (.zip o .zip.age)}"

case "$snapshot" in
  *.age)
    : "${AGE_IDENTITY_FILE:?Falta AGE_IDENTITY_FILE para descifrar $snapshot}"
    plain="$(mktemp --suffix=.zip)"
    trap 'rm -f "$plain"' EXIT
    age --decrypt --identity "$AGE_IDENTITY_FILE" --output "$plain" "$snapshot"
    ;;
  *) plain="$snapshot" ;;
esac

python3 - "$plain" <<'PY'
import json, sys, zipfile

with zipfile.ZipFile(sys.argv[1]) as z:
    names = z.namelist()
    tables = sorted(n[: -len("/documents.jsonl")] for n in names if n.endswith("/documents.jsonl") and not n.startswith("_tables/"))

    def docs(table):
        with z.open(f"{table}/documents.jsonl") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield json.loads(line)

    for table in tables:
        print(f"tabla {table} {sum(1 for _ in docs(table))}")

    storage = [n for n in names if n.startswith("_storage/") and not n.endswith("/") and not n.endswith("documents.jsonl")]
    print(f"ficheros_storage {len(storage)}")

    pages = list(docs("pages")) if "pages" in tables else []
    with_text = [p for p in pages if p.get("content")]
    print(f"pages_con_contenido {len(with_text)}")
    print(f"pages_bytes_contenido {sum(len(p['content'].encode()) for p in with_text)}")

    relations = list(docs("entityRelations")) if "entityRelations" in tables else []
    print(f"entidades_con_relaciones {len({r['fromEntityId'] for r in relations})}")

    tasks = list(docs("tasks")) if "tasks" in tables else []
    print(f"tareas_con_sistema {sum(1 for t in tasks if t.get('systemId'))}")
PY
