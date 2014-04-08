var fs = require('fs');
var Buffer = require('buffer').Buffer;
var Parser = require('./parser').Parser;

var credentials = require('../credentials');
var CrowdProcess = require('CrowdProcess')(credentials);

module.exports = RayTracer;

function RayTracer (n, scene_file) {
  
    /* Prepare program */
    var input = fs.readFileSync(scene_file, 'utf8');
    this.scene = new Parser(input).parse();
    this.program = fs.readFileSync('./src/program.js', 'utf8').replace("%%SCENE%%", JSON.stringify(this.scene));
    
    /* Setup Result */
    this.rgb = new Buffer(this.scene.global.width * this.scene.global.height * 3);
    
    /* Prepare data */

    this.data = [];

    var id = 0;
    for(var i = 0; i < n; i++) {
        for(var j = 0; j < n; j++) {
            this.data.push({
                "id": id++,
                "begin_x": (this.scene.global.height / n) * j,
                "end_x": (this.scene.global.height / n) * (j + 1),
                "begin_y": (this.scene.global.width / n) * i,
                "end_y": (this.scene.global.width / n) * (i + 1),
            });
        }
    }
}

RayTracer.prototype.onData = function (result) {
    var unit = this.data[result.id];
    var i = 0;
    for(var y = unit.begin_y; y < unit.end_y; y++) {
        for(var x = unit.begin_x; x < unit.end_x; x++) {
          var z = (x * this.scene.global.width + y) * 3;
          this.rgb[z] = result.data[i++];
          this.rgb[z+1] = result.data[i++];
          this.rgb[z+2] = result.data[i++];
        }
    }
}

RayTracer.prototype.crpStart = function () {
    var job = CrowdProcess({
        data: this.data,
        program: this.program
    });
    job.on('data', this.onData);
    job.on('end', this.onEnd);
    job.on('error', function(err) {
        console.error(err);
    });
}
