from irods.session import iRODSSession
from . import settings


def get_irods_session():
    session = iRODSSession()
    session.configure(
        host=settings.irods['host'],
        port=int(settings.irods['port']),
        zone=settings.irods['zone'],
        user=settings.irods['user'],
        password=settings.irods['password']
    )
    return session
