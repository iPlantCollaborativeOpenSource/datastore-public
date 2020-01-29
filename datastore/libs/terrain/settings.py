import os

# The Terrian API base path, e.g., scheme://hostname/base
TERRAIN_API_HOST = os.getenv('TERRAIN_API_HOST', 'https://de.cyverse.org')

# The private key used to sign JWT tokens
TERRAIN_API_KEY_PATH = os.getenv('TERRAIN_API_KEY_PATH', 'de-api-key.pem')

# The passphrase for the private key
TERRAIN_API_KEY_PASSPHRASE = os.getenv('TERRAIN_API_KEY_PASSPHRASE', 'changeit')
