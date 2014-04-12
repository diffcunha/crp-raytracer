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

// var rgb;
// var width;
// var height;

// rayTracer.on('run', function(result) {
// 	width = result.width;
// 	height = result.height;
// 	rgb = new Buffer(width * height * 3);
// });

// rayTracer.on('data', function(result) {
// 	var i = 0;
// 	for(var y = result.begin_y; y < result.end_y; y++) {
// 	    for(var x = result.begin_x; x < result.end_x; x++) {
// 	      var z = (x * width + y) * 3;
// 	      rgb[z] = result.data[i++];
// 	      rgb[z+1] = result.data[i++];
// 	      rgb[z+2] = result.data[i++];
// 	    }
// 	}
// });

rayTracer.on('end', function(result) {
	// var png = new Png(rgb, width, height, 'rgb');
	var png = new Png(result.data, result.width, result.height, 'rgb');
  fs.writeFileSync(process.argv[4], png.encodeSync().toString('binary'), 'binary');
});

rayTracer.run();
