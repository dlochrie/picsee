picsee
=================

##Description  
Express-Compatible middleware that offers support for uploading photos, setting custom sizes, and 
storing them locally or remotely.  

_Coming Soon_: API also offers RESTful support for photo uploads, photo retrieval, 
and gallery management.

##Goals

* Provide a RESTFul interface that allows for photos to be uploaded safely to your app
* Be as lightweight as possible, so that you can use whatever ORM/DB/Store you want
* Offer a way to easily set desired sizes for your photo uploads through the conf.
* Offer an API for managing your photos in a gallery, including sorting, and CRUD for photos
in a gallery.
* Hopefully offer support for Amazon S3 storage
* Hopefully offer support for client-side image manipulation

## Install

    npm install picsee


### Prerequisite: GD  

You will need to have GD installed so that `node-gd` (a dependency) can compile. Please have GD installed first.

#### GD on Mac  
1. Get [HomeBrew](http://mxcl.github.io/homebrew/)
2. `brew install gd`

#### GD on Ubuntu
    apt-get install libgd2-xpm-dev

###App Setup

    var picsee = require('picsee');

####Define Options
    var options = {
      stagingDir: staging,
      processDir: processing,
      versions: [  
        { "thmb": { w: 32, h: 32 } },   
        { "profile": { w: 200, h: null } },  
        { "full": { w: null, h: null } }  
      ],
      separator: '_',  
      directories: 'single',
      namingConvention: 'date',
      inputFields: ['profPhoto', 'other']
    }

####Configure
    app.configure(function (){
      app.use(picsee.initialize(options));
      // Call picsee before you set your routes
      app.use(app.router);
    });

####Create Directories
Picsee requires that any directory you are uploading to _exists_ and is _writeable_ by _Node_ or whatever user is running the app. 

###Demo App
See: [pisee-looksee](https://github.com/dlochrie/picsee-looksee).




