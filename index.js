var fs = require('fs');
var events = require('events');
var Buffer = require('buffer').Buffer;

var Parser = require('./src/parser').Parser;

module.exports = RayTracer;

function RayTracer(opts) {
    var CrowdProcess = require('CrowdProcess')(opts.credentials);
    
    events.EventEmitter.call(this);

    /* Validation */
    if(opts.input == undefined) {
        throw "Invalid input";
    }

    var self = this;

    /* Default params */
    var split = opts.split || 10;
    var mock = opts.mock || false;

    /* Parse input */
    var scene = new Parser(opts.input).parse();

    /* Prepare program */
    var program = fs.readFileSync('./src/program.js', 'utf8').replace("%%SCENE%%", JSON.stringify(scene));
    
    /* Setup result */
    var rgb = new Buffer(scene.global.width * scene.global.height * 3);
    
    /* Prepare data */
    var data = [];

    /*
     * TODO: Improve to allow any scene size.
     * Currently it only allows dimensions divisible by split
     */
    var id = 0;
    for(var i = 0; i < split; i++) {
        for(var j = 0; j < split; j++) {
            data.push({
                "id": id++,
                "begin_x": (scene.global.height / split) * j,
                "end_x": (scene.global.height / split) * (j + 1),
                "begin_y": (scene.global.width / split) * i,
                "end_y": (scene.global.width / split) * (i + 1),
            });
        }
    }
    
    /* Handlers */
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
        self.emit('data', {
            begin_x: unit.begin_x,
            end_x: unit.end_x,
            begin_y: unit.begin_y,
            end_y: unit.end_y,
            data: result.data
        });
    }
    function onEnd() {
        console.log('got all results!');
        self.emit('end', {
            width: scene.global.width,
            height: scene.global.height,
            data: rgb
        });
    }
    
    /* Operations */
    this.run = function run() {
        self.emit('run', {
            width: scene.global.width,
            height: scene.global.height
        });
        if(mock) {
            (function() {
                eval(program);
                for(var i = 0; i < split * split; i++) {
                    onData(Run(data[i]));
                }
                onEnd();
            })();
        } else {
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
    }
}

RayTracer.prototype.__proto__ = events.EventEmitter.prototype;
