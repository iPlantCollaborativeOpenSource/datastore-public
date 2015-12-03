Public Datastore Interface
==========================

Prerequisites
-------------------------

Docker and Compose
******************

This project is a dockerized application. You'll need [Docker][1] and [Compose][2]
installed to run the application. If you are running on a Mac or Windows then you will
also need [Docker Machine][3].

To start the application:

```bash
$ docker-compose up
```

from the project's root directory will run the application on `http://localhost:8000`
(or `http://${DOCKER_MACHINE_IP}:8000` if you are running Docker Machine.)


Environment
-----------

The `datastore.env` file has the environment configuration for the application. Customize
as necessary, but the defaults are a Production-ready configuration.

Configuration options of note:

- `DJANGO_DEBUG`: toggles whether the Django application runs in DEBUG mode. Set this to
  `True` for application development
- `DJANGO_SECRET_KEY`: the Mirrors application is a no-login, anonymous-only application.
  As such, the security implications of this are minimal. However, should authentication
  be added at some point in the future, this value should be set and kept secret. Read
  more about this setting [here][5];
- `IRODS_*`: the `IRODS_*` settings should be customized to point the application at the
  desired iRODS deployment.


Logging
-------

Using the development `docker-compose.yml` configuration, the containers all log to
`stdout`. The production docker compose configuration (`docker-compose-prod.yml`)
configures the [Docker syslog driver][4] to direct all logs to the host system's syslog.


Running in Production
---------------------





[1]: https://docs.docker.com/installation/
[2]: https://docs.docker.com/compose/install/
[3]: https://docs.docker.com/machine/install-machine/
[4]: https://docs.docker.com/engine/reference/logging/overview/#syslog-options
[5]: https://docs.djangoproject.com/en/1.8/ref/settings/#std:setting-SECRET_KEY