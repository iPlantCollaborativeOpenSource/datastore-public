import os
import logging

irods = {
    'host': os.getenv('IRODS_HOST', 'data.iplantcollaborative.org'),
    'port': os.getenv('IRODS_PORT', '1247'),
    'zone': os.getenv('IRODS_ZONE', 'iplant'),
    'path': os.getenv('IRODS_PATH', '/iplant/home/shared'),
    'user': os.getenv('IRODS_USER', 'anonymous'),
    'password': os.getenv('IRODS_PASSWORD',''),
}

logging.getLogger(__name__).debug(irods)

datastore = {
    'metadata_prefix': os.getenv('METADATA_PREFIX', 'ipc_template'),
}

# DE API JWWT
DE_API_HOST = os.getenv('DE_API_HOST', 'https://de.cyverse.org')
DE_API_KEY_PATH = os.getenv('DE_API_KEY_PATH', 'de-api-key.pem')
DE_API_KEY_PASSPHRASE = os.getenv('DE_API_KEY_PASSPHRASE', 'changeit')
