var fs = require('fs');
var Png = require('png').Png;
var Buffer = require('buffer').Buffer;
var Parser = require('./parser').Parser;

var CrowdProcess = require('CrowdProcess')({
    "token": "19575cb6-5ec2-4143-865a-71d26813f0da"
});

if(process.argv.length < 5) {
    console.error("use: node . <n_units> <rt_file_in> <png_file_out>");
    process.exit(0);
}

/* Number of units */

var n = process.argv[2] || 10;
console.log("# units: " + n  + " x " + n + " = " + n * n);

/* Prepare program */

var input = fs.readFileSync(process.argv[3], 'utf8');
var scene = new Parser(input).parse();
var program = fs.readFileSync('./program.js', 'utf8').replace("%%SCENE%%", JSON.stringify(scene));

// console.log(program);

/* Prepare data */

var data = [];

var id = 0;
for(var i = 0; i < n; i++) {
    for(var j = 0; j < n; j++) {
        data.push({
            "id": id++,
            "begin_x": (scene.global.height / n) * j,
            "end_x": (scene.global.height / n) * (j + 1),
            "begin_y": (scene.global.width / n) * i,
            "end_y": (scene.global.width / n) * (i + 1),
        });
    }
}

// Setup Result

var rgb = new Buffer(scene.global.width * scene.global.height * 3);

function onData(result) {
    var unit = data[result.id];
    var i = 0;
    for(var y = unit.begin_y; y < unit.end_y; y++) {
        for(var x = unit.begin_x; x < unit.end_x; x++) {
          var z = (x * scene.global.width + y) * 3;
          rgb[z] = result.data[i++];
          rgb[z+1] = result.data[i++];
          rgb[z+2] = result.data[i++];
        }
    }
}

function onEnd() {
    console.log('got all results!');
    var png = new Png(rgb, scene.global.width, scene.global.height, 'rgb');
    fs.writeFileSync(process.argv[4], png.encodeSync().toString('binary'), 'binary');
}

/* Run as mock */ 

// (function() {
//     eval(program);
//     for(var index = 0; index < data.length; index++) {
//         onData(Run(data[index]));
//     }
//     onEnd();
// })();

/* Setup job */

var job = CrowdProcess({
    data: data,
    program: program
});

job.on('data', onData);
job.on('end', onEnd);
job.on('error', function(err) {
  console.error(err);
});
