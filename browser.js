var raytracer = require('./lib/raytracer.js');

/* Number of units */
var n = 10;
console.log("# units: " + n  + " x " + n + " = " + n * n);
var scene_file = './examples/pokeball_scene.json'

ray_tracer = new RayTracer(n, scene_file);

onEnd = function() {
    console.log('got all results!');
}

ray_tracer.crpStart(onEnd.bind(ray_tracer));
