var png = require('./lib/png.js');
var RayTracer = require('./lib/RayTracer.js');
var fs = require('fs');
var Parser = require('./lib/parser').Parser;

if(process.argv.length < 5) {
    console.error("use: node . <n_units> <rt_file_in> <png_file_out>");
    process.exit(0);
}

/* Number of units */
var n = process.argv[2];
console.log("# units: " + n  + " x " + n + " = " + n * n);

var scene_file = process.argv[3];
var input = fs.readFileSync(scene_file, 'utf8');
var scene = new Parser(input).parse();

ray_tracer = new RayTracer(n, scene);

onEnd = function() {
    console.log('got all results!');
    png.write_file(this.rgb, this.scene, process.argv[4]);
}

ray_tracer.crpStart(onEnd.bind(ray_tracer));
