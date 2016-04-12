from irods.session import iRODSSession
from . import settings

_irods_session = iRODSSession()
_irods_session.configure(
    host=settings.irods['host'],
    port=int(settings.irods['port']),
    zone=settings.irods['zone'],
    user=settings.irods['user'],
    password=settings.irods['password']
)

def get_irods_session():
    _irods_session.cleanup()
    return _irods_session
