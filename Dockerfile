FROM buildpack-deps:trusty

MAINTAINER Matthew R Hanlon <mrhanlon@tacc.utexas.edu>

EXPOSE 8000

CMD ["supervisord", "-n"]

RUN apt-get update && \
    apt-get install -y python python-dev gettext supervisor nginx memcached && \
    curl -SL 'https://bootstrap.pypa.io/get-pip.py' | python && \
    pip install uwsgi

RUN rm /etc/nginx/sites-enabled/default
COPY ./conf/datastore /etc/nginx/sites-enabled/

COPY requirements.txt /tmp/requirements.txt

RUN pip install -r /tmp/requirements.txt

COPY . /project

RUN ln -s /project/conf/supervisor-uwsgi.conf /etc/supervisor/conf.d/uwsgi.conf

WORKDIR /project

CMD /usr/bin/supervisord -n -c /project/conf/supervisor-uwsgi.conf

