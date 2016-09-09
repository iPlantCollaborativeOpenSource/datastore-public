Changelog
=========

2.0.1
-----

Enhancements:

- Updated large file download text
- Added explicit "close" button to file info dialog
- Added MD5 checksum to file info dialog
- Added "Open in CyVerse DE" button for all files

2.0.0
-----

This is the first release of the new Data Commons Repository! (Formerly 
"Mirrors".) This version has a lot of changes both on the front end and
the back end.

Enhancements:

- App front-end rewritten in AngularJS.
- Refactored to use DE Terrain API for file metadata instead of querying 
  `python-irods` to query iRODS directly.
- Direct downloads are (when supported) are offloaded to the CyVerse 
  anon-files service. This frees up the DCR server to continue handling
  web requests and not be responsible for managing download streams from
  iRODS. Direct download is supported for files up to 2GB.
- Much improved file previews. All text-like files can be previewed up
  to 8kB. Currently supported previews include files that Terrain 
  reports content-type `text/*`, e.g., `text/csv`, `text/plain`, etc. 
- Prototype landing pages that display combined template metadata and 
  iRODS AVUs.

1.0.2
-----

- Re-branded for CyVerse
- Enhancements:
    - Improved iRODS connection management, with automatic retry
    - Support for previewing additional files types

1.0.1
-----

- Bug fixes

1.0.0
-----

- Migration to Django

0.0.0
-----

-  Initial version