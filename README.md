sra README
==================

Prerequisites
-------------------------

### CentOS 5

This project requires Python 2.7, which is a pain to set up on CentOS 5. 
[Do that first](http://toomuchdata.com/2012/06/25/how-to-install-python-2-7-3-on-centos-6-2/).
Install Python 2.7, setuptools, pip, and virtualenv.

### Ubuntu 12.04

    sudo apt-get install python-dev python-pip python-virtualenv

Installation
------------

### Virtualenv
    useradd -m datastore
    su - datastore
    virtualenv --no-site-packages ~/env
    echo "source ~/env/bin/activate" >> ~/.bash_profile
    . ~/.bash_profile

### pycommands
    git clone git://github.com/cjlarose/pycommands.git
    pip install -e pycommands

### Datastore 
    cd ~
    git clone git://github.com/iPlantCollaborativeOpenSource/sra.git
    cd sra
    python setup.py develop

### Fire it up
    sudo ~/env/sra/bin/pserve production.ini --log-file=sra.log --daemon
