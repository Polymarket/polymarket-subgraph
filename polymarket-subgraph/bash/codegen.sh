#!/bin/bash

set -e

echo "running pnl codegen.sh"
DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

cd "$DIR/.." || exit

yarn graph codegen ./polymarket-subgraph/subgraph.yaml --debug --output-dir ./polymarket-subgraph/src/types
