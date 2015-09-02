Public Datastore Interface
==========================

Prerequisites
-------------------------

### Docker and Compose

This project is a dockerized application. You'll need [Docker][1] and [Compose][2]
installed to run the application. If you are running on a Mac or Windows then you will
also need [Docker Machine][3].

To start the application:

```bash
$> docker-compose up
```

from the project's root directory will run the application on http://localhost:8000
(or http://${DOCKER_MACHINE_IP}:8000 if you are running Docker Machine.)


Environment
-----------

The `datastore.env` file has the environment configuration for the application. Customize
as necessary, but the defaults should work for the most part.


[1]: https://docs.docker.com/installation/
[2]: https://docs.docker.com/compose/install/
[3]: https://docs.docker.com/machine/install-machine/