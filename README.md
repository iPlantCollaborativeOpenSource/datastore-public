sra README
==================

Installation
------------

### Python
    yum install python26 python26-devel

### Setuptools
    cd /tmp
    curl -O https://pypi.python.org/packages/2.6/s/setuptools/setuptools-0.6c11-py2.6.egg
    chmod 775 setuptools-0.6c11-py2.6.egg
    sh setuptools-0.6c11-py2.6.egg

### Pip
    curl -O https://pypi.python.org/packages/source/p/pip/pip-1.2.1.tar.gz
    tar zxvf pip-1.2.1.tar.gz 
    cd pip-1.2.1
    python26 setup.py install

### Virtualenv
    pip-2.6 install virtualenv
    mkdir /opt/env
    virtualenv-2.6 --no-site-packages sra
    cd sra
    . bin/activate
    pip install pyramid

### Install irods (USE -fPIC flags)
Follow [these instuctions](https://www.irods.org/index.php/Downloads "iRODS Download & Installation")

### pyrods
    curl -O https://irodspython.googlecode.com/files/PyRods-3.1.0.tar.gz
    echo -e "[build]\nirods_dir=/opt/iRODS" > setup.cfg
    python setup.py build
    python setup.py install

### SRA
    cd /opt
    git clone git@github.com:cjlarose/sra.git
    cd sra
    python setup.py develop
    initialize_sra_db development.ini
