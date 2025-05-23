#!/usr/bin/env bash
this_dir=$(cd $(dirname "$0"); pwd)
parent_dir=$(cd "$this_dir/.."; pwd)
repo_dir=$(cd "$parent_dir"; pwd)

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $0 <directory>"
    exit 1
fi

# prepare for SOPS:
source "$this_dir/_sops_config.include.sh"

target_dir="$1"
if [ -z "$target_dir" ]; then
    echo "Error: Directory not provided"
    echo "Usage: $0 <directory>"
    exit 1
fi

if [ ! -d "$target_dir" ]; then
    echo "Error: Directory not found at $target_dir"
    exit 1
fi

echo "Encrypting .env files in $target_dir"

files=($(find "$target_dir" -type f -name ".env*" ! -name "*.encrypted"))

echo "Found ${#files[@]} .env files to process"

for file in "${files[@]}"; do
  if [[ "$file" != *".encrypted" ]]; then
    encrypted_file="${file}.encrypted"
    echo "Encrypting $file to $encrypted_file"
    sops encrypt \
      --age "$age_key_public" \
      --input-type dotenv \
      --output-type dotenv \
      "$file" > "$encrypted_file"
  fi
done
