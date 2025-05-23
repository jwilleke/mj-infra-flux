#!/usr/bin/env bash
this_dir=$(cd $(dirname "$0"); pwd) # this script's directory
parent_dir=$(cd "$this_dir/.."; pwd) # parent directory
repo_dir=$(cd "$parent_dir/.."; pwd) # repository directory


# NOTE: This is the private key. DO NOT SHARE THE CONTENTS OF WHAT THIS GENERATES.

# NOTE: Create a secret with the age PRIVATE KEY, the key name must end with .agekey to be detected as an age key:
cat "$repo_dir/home-infra-private.agekey" |
kubectl create secret generic sops-age \
--namespace=flux-system \
--from-file="home-infra-private.agekey=/dev/stdin"
