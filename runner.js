var fs = require('fs');
var Png = require('png').Png;

var RayTracer = require('./index.js');

if(process.argv.length < 5) {
    console.error("use: node . <n_units> <rt_file_in> <png_file_out>");
    process.exit(0);
}

/* Number of units */
var split = process.argv[2];
console.log("# units: " + split  + " x " + split + " = " + split * split);

var scene_file = process.argv[3];
var input = fs.readFileSync(scene_file, 'utf8');

var rayTracer = new RayTracer({
	split: split,
	input: input,
	mock: false
});

rayTracer.on('end', function(result) {
	var png = new Png(result.data, result.width, result.height, 'rgb');
  fs.writeFileSync(process.argv[4], png.encodeSync().toString('binary'), 'binary');
});

rayTracer.run();
