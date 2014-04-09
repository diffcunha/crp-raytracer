var fs = require('fs');
var Buffer = require('buffer').Buffer;
var Parser = require('./parser').Parser;

var credentials = require('../credentials');
var CrowdProcess = require('CrowdProcess')(credentials);

module.exports = RayTracer;

function RayTracer (n, scene_file) {
  
    /* Prepare program */
    var input = fs.readFileSync(scene_file, 'utf8');
    var scene = new Parser(input).parse();
    var program = fs.readFileSync('./src/program.js', 'utf8').replace("%%SCENE%%", JSON.stringify(scene));
    
    /* Setup Result */
    rgb = new Buffer(scene.global.width * scene.global.height * 3);
    
    /* Prepare data */

    data = [];

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
    
    function onData (result) {
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
    
    function crpStart (onEnd) {
        var job = CrowdProcess({
            data: data,
            program: program
        });
        job.on('data', onData);
        job.on('end', onEnd);
        job.on('error', function(err) {
            console.error(err);
        });
    }
    
    return {
        scene: scene,
        program: program,
        rgb: rgb,
        data: data,
        crpStart: crpStart
    };
}
