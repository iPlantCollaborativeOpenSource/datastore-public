# Public Datastore Interface

## Prerequisites

### Docker and Compose


This project is a dockerized application. You'll need [Docker][1] and [Compose][2]
installed to run the application. If you are running on a Mac or Windows then you will
also need [Docker Machine][3].

To start the application:

```bash
$ docker-compose up
```

from the project's root directory will run the application on `http://localhost:8000`
(or `http://${DOCKER_MACHINE_IP}:8000` if you are running Docker Machine.)


## Environment


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


## Logging

Using the development `docker-compose.yml` configuration, the containers all log to
`stdout`. The production configuration (see below) configures the [Docker syslog driver][4]
to direct all logs to the host system's syslog.


##  Production installation and configuration

###  Deployment with Docker


In production, the application is run as a systemd service.

Steps for installation:

1. Create an non-root user `mirrors` in the `docker` group. We will be running the
    application as this non-root user.

    ```
    $ sudo adduser mirrors -G docker
    ```

2. Clone this repository to the production machine and build the image.

    ```
    $ git clone https://github.com/iplantopensource/datastore-public.git
    $ cd datastore-public
    $ docker build -t iplantc/idc_mirrors .
    ```

    Alternatively, pull the image from a docker image repository.

3. Copy the application environment configuration ([`datastore.env`](datastore.env)) to
    `/etc/idc-mirrors.conf`. Make any changes necessary, such as updating the iRODS
    connection parameters.

4. Copy the systemd service definition [`etc/idc-mirrors.service`](etc/idc-mirrors.service)
    to `/etc/systemd/system`. This service definition is configured to run the container
    as the `mirrors` user we created above. The container is configured to expose port 80,
    map the environment variables defined in `/etc/idc-mirrors.conf`, and log the container
    output to syslog. The container will be automatically removed when it is stopped.

You can now start, stop, and restart the application container with systemd as necessary:

```
$ systemctl start idc-mirrors
$ systemctl restart idc-mirrors
$ systemctl stop idc-mirrors
```

If you want to register the container to start at boot, enable the container:

```
$ systemctl enable idc-mirrors
```


###  Deployment with Ansible

There are playbooks for deploying to Production and QA at CyVerse, and 
Testing on TACC's Rodeo. You will need to install `ansible` on your local
system. There are no prerequisites required on the remote systems.

You can run the desired playbook, `[prod, qa, test]`,  with the following
command:

```
$ VER=test # set this to one of prod, qa, test
$ ansible-playbook -i playbooks/$VER/hosts playbooks/$VER/site.yml
```

If you need to supply a password for `ssh` or `sudo`, add `--ask-pass` 
or `--ask-sudo-pass` to the `ansible-playbook` command. 

See the [Ansible Documentation][6] for full documentation on Ansible.


[1]: https://docs.docker.com/installation/
[2]: https://docs.docker.com/compose/install/
[3]: https://docs.docker.com/machine/install-machine/
[4]: https://docs.docker.com/engine/reference/logging/overview/#syslog-options
[5]: https://docs.djangoproject.com/en/1.8/ref/settings/#std:setting-SECRET_KEY
[6]: http://docs.ansible.com/ansible/index.html
