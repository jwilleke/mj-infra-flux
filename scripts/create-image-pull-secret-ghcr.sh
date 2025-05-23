#!/usr/bin/env bash
this_dir=$(cd $(dirname "$0"); pwd) # this script's directory
parent_dir=$(cd $(dirname "$this_dir"); pwd) # parent directory
repo_dir=$(cd "$parent_dir"; pwd) # repository directory

#-e: Exits immediately if any command returns a non-zero status (i.e., fails)
#-u: Treats unset variables as errors and exits immediately
#-o pipefail: If any command in a pipeline fails, the entire pipeline fails
set -eo pipefail

# Check for the secrets file
env_file="$this_dir/.env.secret.github"
if [ ! -f "$env_file" ]; then
  echo "Error: $env_file not found. Please create it with github_username, github_token, and github_email."
  exit 1
fi

# Load variables from the env file
source "$env_file"

# Verify mandatory variables are set
if [ -z "${github_username}" ] || [ -z "${github_token}" ] || [ -z "${github_email}" ]; then
  echo "Error: github_username, github_token, and github_email must be set in $env_file."
  exit 1
fi

# Calculate the base64-encoded auth string (username:token)
auth=$(echo -d "$github_username:$github_token" | base64)

# Create a temporary docker config JSON file with the registry credentials
config_file="$this_dir/ghcr.dockeronfigjson"
cat <<EOF > "${config_file}"
{
  "auths": {
    "ghcr.io": {
      "username": "${github_username}",
      "password": "${github_token}",
      "email": "${github_email}",
      "auth": "${auth}"
    }
  }
}
EOF

# Now encrypt it per https://fluxcd.io/flux/components/kustomize/kustomizations/#kustomize-secretgenerator
config_file_encrypted=${config_file}.encrypted

# Prepare for sops:
source "$this_dir/_sops_config.include.sh"

sops -encrypt \
  --age "$age_key_public" \
  --input-type=json \
  --output-type=json "$config_file" > "$config_file_encrypted"

cat <<EOF
The encrypted docker config JSON file has been saved to ${config_file_encrypted}.

It can be copied into the correct app folder and referenced in a Kustomize secretGenerator like this:

kind: Kustomization
secretGenerator:
  - name: github-container-registry-secret
    type: kubernetes.io/dockerconfigjson
    files:
      - .dockerconfigjson=$(basename "$config_file_encrypted")
EOF


