#!/bin/sh
# wait-for.sh

set -e

host="$1"
shift
cmd="$@"

until nc -z -v -w30 "${host%%:*}" "${host#*:}"; do
  echo "Waiting for $host..."
  sleep 1
done

echo "$host is up - executing command"
exec $cmd
