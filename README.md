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

##How it Works
Picsee allows you to define _where_ and _how_ you want to save your photos. Using the GD library,
Picsee resizes your photo and saves it according to your specifications.

###Typical Use Case: Profile Photo
If you are creating a form where your user is uploading a profile photo, you are most-likely
going to want 3 versions of the photo:  

* Small
* Medium
* Large

You name them, _thmb_, _med_, and _lrg_ and your team/company/UI/UX/etc determines that:

* **thmb** = 32x32
* **med** = 200x[whatever]
* **lrg** = 800x[whatever]  

So, your thmb will be scaled and saved to 32*32, and your _med_ will be rescaled so that it is 200 pixels wide by whatever height is proportional to the original.

Your photos are saved according to whatever naming conventions you provide:

* *_date_*: 1365215413_thmb.jpg, 1365215413_med.jpg, 1365215413_lrg.jpg
* *_original_*: GradPhotos-0001-05-03-1977_thmb.jpg, etc
* *_custom_*: _Coming Soon_

Don't like underscores? Change the `separator` option.

Before your photos are saved, the original is moved to a `staging` directory, 
which you define. Here the Mime type is checked, and it is rejected if it is not
a "jpg", "png", or "gif". 

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

*Options*:
 * stagingDir - sandboxed directory for uploading photo
 * processDir - directory to save processed photo(s)
 * versions - versions of photos with width and height option
 * separator - character to use when concatenating file names, ie 
`filename_thumb` where _filename_ is the original filename, and _thumb_ is the 
name of the version. `-` or `_` should work.
 * directories [under construction] - convention for storing files, 
ie use one directory and name files with versions attached, 
or store each file in a different directory named after the version
 * namingConvention - how to name files?
 * inputFields - given a form with multiple inputs, which input(s) contain a photo?

*Example Usage*:

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

####Usage with Express
    app.post('/upload', function(req, res, next) { 
      picsee.upload(req, res, function(err, results) { 
        if (err) { // Handle error... }
        res.render('index', { title: 'Upload Complete', results: results });
      })
    })

###Demo App
See: [pisee-looksee](https://github.com/dlochrie/picsee-looksee).


##License
The MIT License (MIT)

Copyright (c) 2013 Daniel Lochrie

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.





