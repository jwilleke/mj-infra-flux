
# NOTE: this must be capitalized per sops:
SOPS_AGE_KEY_FILE="$repo_dir/home-infra-private.agekey"

if [ ! -f "$SOPS_AGE_KEY_FILE" ]; then
    echo "Error: Age key file not found at $SOPS_AGE_KEY_FILE"
    exit 1
fi

# NOTE: this is the public key corresponding to the priate key in the agekey file
age_key_public="age1sr8j9p87wuuqfnmharzqqnwj76yyc6mu5j3r5t7sr3j88wzn8exqwy6jhj"