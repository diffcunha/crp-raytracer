'use strict'

var fs = require('fs');
var events = require('events');

var Parser = require('./src/parser').Parser;
var CrowdProcess = require('./crp-client.js');

module.exports = RayTracer;

function RayTracer(opts) {
    events.EventEmitter.call(this);

    /* Validation */
    if(opts.input == undefined) {
        throw 'Invalid input';
    }
    if(!opts.mock && opts.credentials == undefined) {
         throw 'Invalid credentials';
    }

    var self = this;

    /* Default params */
    var split = opts.split || 10;
    var mock = opts.mock || false;
    var animation = opts.animation || false;

    /* Parse input */
    var scene = new Parser(opts.input).parse();

    /* Prepare program */
    var program = fs.readFileSync(__dirname + '/src/program.js', 'utf8').replace('%%SCENE%%', JSON.stringify(scene));
    
    /* Setup result */
    // var rgb = new Buffer(scene.global.width * scene.global.height * 3);
    
    /* Prepare data */
    var data = [];

    /* Calculate jobs sizes */
    var jobWidth = Math.floor(scene.global.width / split);
    var splitWidth = Math.ceil(scene.global.width / jobWidth);
    
    var jobHeight = Math.floor(scene.global.height / split);
    var splitHeight = Math.ceil(scene.global.height / jobHeight);

    var id = 0;
    if(animation) {
        for(var frame = 0; frame < animation.frames; frame++) {
            for(var i = 0; i < splitWidth; i++) {
                for(var j = 0; j < splitHeight; j++) {
                    data.push({
                        'id': id++,
                        'animation': {
                            'frame': frame,
                            'frames': animation.frames
                        },
                        'begin_x': jobHeight * j,
                        'end_x': j < splitHeight - 1 ? jobHeight * (j + 1) : scene.global.height,
                        'begin_y': jobWidth * i,
                        'end_y': i < splitWidth - 1 ? jobWidth * (i + 1) : scene.global.width
                    });
                }
            }
        }
    } else {
        for(var i = 0; i < splitWidth; i++) {
            for(var j = 0; j < splitHeight; j++) {
                data.push({
                    'id': id++,
                    'begin_x': jobHeight * j,
                    'end_x': j < splitHeight - 1 ? jobHeight * (j + 1) : scene.global.height,
                    'begin_y': jobWidth * i,
                    'end_y': i < splitWidth - 1 ? jobWidth * (i + 1) : scene.global.width
                });
            }
        }
    }
    
    /* Handlers */
    
    function onEnd() {
        // console.log('got all results!');
        self.emit('end', {
            width: scene.global.width,
            height: scene.global.height
            //data: rgb
        });
    }
    function onError(error) {
        self.emit('error', error);
    }
    
    /* Operations */
    this.run = function run(dataCB) {
        self.emit('run', {
            width: scene.global.width,
            height: scene.global.height,
            splitsPerFrame: splitWidth * splitHeight
        });

        function onData(result) {
            var unit = data[result.id];
            dataCB({
                begin_x: unit.begin_x,
                end_x: unit.end_x,
                begin_y: unit.begin_y,
                end_y: unit.end_y,
                animation: unit.animation,
                data: result.data
            });
        }
        var crp = new CrowdProcess(opts.credentials.token, program, data, onData, onEnd, onError);
/*
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
            job.on('error', onError);
        }
*/
    }
}

RayTracer.prototype.__proto__ = events.EventEmitter.prototype;
