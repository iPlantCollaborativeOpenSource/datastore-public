from pyramid.config import Configurator
from sqlalchemy import engine_from_config

from .models import (
    DBSession,
    Base,
    )

from datastore import DataStoreSession


def main(global_config, **settings):
    """ This function returns a Pyramid WSGI application.
    """
    engine = engine_from_config(settings, 'sqlalchemy.')
    DBSession.configure(bind=engine)
    Base.metadata.bind = engine
    DataStoreSession.configure(
        host=settings['irods.host'],
        port=int(settings['irods.port']),
        zone=settings['irods.zone'],
        path=settings['irods.path'],
        user=settings['irods.user'],
        password=settings['irods.password']
    )
    config = Configurator(settings=settings)
    config.add_static_view('static', 'static', cache_max_age=3600)
    config.add_route('home', '/')
    config.scan()
    return config.make_wsgi_app()
