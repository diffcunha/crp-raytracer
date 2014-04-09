var RayTracer = require('../lib/raytracer.js');
var fs = require('fs');
var Parser = require('../lib/parser').Parser;

/* Number of units */
var n = 10;
console.log("# units: " + n  + " x " + n + " = " + n * n);

var input = fs.readFileSync('./examples/pokeball_scene.json', 'utf8');
var scene = new Parser(input).parse();


ray_tracer = new RayTracer(n, scene);

onEnd = function() {
    console.log('got all results!');
}

ray_tracer.crpStart(onEnd.bind(ray_tracer));
