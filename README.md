picsee
=================

##Description  
Express-Compatible middleware that offers support for uploading photos, setting custom sizes, and storing them locally or remotely. API also offers RESTful support for photo uploads, photo retrieval, and gallery management.

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
1. Get HomeBrew
2. `brew install gd`

#### GD on Ubuntu
    apt-get install libgd2-xpm-dev

###App Setup: Under Construction

    var picsee = require('picsee');
    app.configure(function(){
      app.use(picsee.initialize(options));
      // Call picsee before you set your routes
      app.use(app.router);
    });

###Create Your Conf: Under Construction

In your conf, setup the sizes that are acceptable, with an array of [Width, Height]...  

**TODO** add more about Conf here.

    {  
      "development": {  
        "versions": {  
          "thmb": [32, 32],   
          "profile": [200, null],  
          "full": [null, null]  
        },  
        "paths": { "....tbd" }  
      }  
    }  

**TODO** add more info about how to use, describe RESTFul routes, etc.



