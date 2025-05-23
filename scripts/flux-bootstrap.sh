#!/usr/bin/env bash
this_dir=$(cd $(dirname "$0"); pwd) # this script's directory
this_script=$(basename $0)

# THIS SCRIPT PER https://fluxcd.io/flux/installation/bootstrap/github/#github-pat

# get the GITHUB_TOKEN:
token_file="$this_dir/.env.secret.github.flux-bootstrap"
source "$token_file"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN is not set in $token_file"
  exit 1
fi


# --components-extra added per https://fluxcd.io/flux/guides/image-update/#install-flux
# and https://fluxcd.io/flux/installation/configuration/optional-components/

GITHUB_TOKEN=$GITHUB_TOKEN \
  flux bootstrap github \
  --components-extra=image-reflector-controller,image-automation-controller \
  --token-auth \
  --owner=activescott \
  --repository=home-infra-k8s-flux \
  --branch=main \
  --path=clusters/nas1 \
  --personal
  
