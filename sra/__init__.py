from pyramid.config import Configurator
from sqlalchemy import engine_from_config

from .models import (
    DBSession,
    Base,
    DataStoreSession
    )

def main(global_config, **settings):
    """ This function returns a Pyramid WSGI application.
    """
    #engine = engine_from_config(settings, 'sqlalchemy.')
    #DBSession.configure(bind=engine)
    #Base.metadata.bind = engine
    DataStoreSession.configure(
        host=settings['irods.host'],
        port=int(settings['irods.port']),
        zone=settings['irods.zone'],
        user=settings['irods.user'],
        password=settings['irods.password']
    )
    config = Configurator(settings=settings)
    config.include('pyramid_chameleon')
    config.add_static_view('static', 'static', cache_max_age=3600)
    config.add_route('home', '/')
    config.add_route('browse', '/browse/*path')
    config.add_route('download_file', '/download/*path')
    config.add_route('serve_file', '/serve/*path')
    config.add_route('markdown', '/markdown/*path')
    config.add_route('file', '/api/file')
    config.add_route('children', '/api/collection')
    config.add_route('legacy', '/{path:.*}')
    config.scan()
    return config.make_wsgi_app()
