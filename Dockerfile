FROM buildpack-deps:trusty

MAINTAINER Matthew R Hanlon <mrhanlon@tacc.utexas.edu>

EXPOSE 8000

CMD ["supervisord", "-n"]

RUN apt-get update && \
    apt-get install -y python python-dev gettext supervisor && \
    apt-get install memcached \
    curl -SL 'https://bootstrap.pypa.io/get-pip.py' | python && \
    pip install uwsgi

COPY requirements.txt /tmp/requirements.txt

RUN pip install -r /tmp/requirements.txt

COPY . /project

RUN ln -s /project/conf/supervisor-uwsgi.conf /etc/supervisor/conf.d/uwsgi.conf

WORKDIR /project
