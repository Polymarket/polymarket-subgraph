#!/bin/bash

set -e

echo "running pnl codegen.sh"
DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

cd "$DIR/.." || exit

# cd src
# mkdir types
echo $(pwd)
yarn graph codegen ./pnl-subgraph/subgraph.yaml --debug --output-dir ./pnl-subgraph/src/types
