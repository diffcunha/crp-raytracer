'use strict';

var RayTracer = require('crp-raytracer');

var rayTracer;

self.onmessage = function(msg) {
    var type = msg.data[0];
    var value = msg.data[1];

    if(type === 'process') {
        rayTracer = new RayTracer({
            split: value.tasks,
            input: value.input,
            animation: value.animation,
            credentials: {
                'token': '5b199d2e-f752-47a1-95eb-93878f589be4'
            }
        });

        rayTracer.on('run', function(result) {
            self.postMessage(['resize', result.width, result.height, result.splitsPerFrame]);
        });

        rayTracer.on('data', function(result) {
            self.postMessage(['result', result]);
        });

        rayTracer.on('end', function() {
            self.postMessage(['end']);
        });

        rayTracer.on('error', function(error) {
            self.postMessage(['error', error]);
        });

        rayTracer.run();
    }
};