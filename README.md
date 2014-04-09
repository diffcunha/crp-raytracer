crp-raytracer
=============

A distributed RayTracer as a service with CrowdProcess!

# Install

First, you need to install [node](http://nodejs.org/). And then :
````
npm install
````

You then need to have a [crowdprocess](https://crowdprocess.com/) account. You can now create a credentials file.
The `credentials.json` looks like this:
````
{
  "email": "your@email.com",
  "password": "secret"
}
````

# Run it!

````
node . 50 ./examples/pokeball_scene.json out.png
````
`50` represents the size of the square that is sent to each browsers.


# Credits
