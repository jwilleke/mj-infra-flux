
# NOTE: this must be capitalized per sops:
SOPS_AGE_KEY_FILE="$repo_dir/home-infra-private.agekey"

if [ ! -f "$SOPS_AGE_KEY_FILE" ]; then
    echo "Error: Age key file not found at $SOPS_AGE_KEY_FILE"
    exit 1
fi

# NOTE: this is the public key corresponding to the priate key in the agekey file
age_key_public="age1nur86m07v4f94xpc8ugg0cmum9fpyp3hcha2cya6x09uphu4zg5szrtzgt"