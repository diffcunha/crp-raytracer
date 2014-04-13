var credentials = require('./credentials');
var RayTracer = require('crp-raytracer');

/* Number of units */
var split = 10;
console.log("# units: " + split  + " x " + split + " = " + split * split);

var canvas = $('canvas')[0];
var context = canvas.getContext('2d');
var canvasData;

editor = CodeMirror.fromTextArea($('textarea')[0], {
  lineNumbers: true
});

$('#crp').click(function() {
  var t;
  // if (rayTracer) rayTracer.terminate();
  var rgb;
  var width;
  var height;

  rayTracer = new RayTracer({
    split: split,
    input: editor.getValue(),
    credentials: credentials
  });
  t = +new Date();

  rayTracer.on('run', function(result) {
    width = result.width;
    height = result.height;

    canvas.width = width;
    canvas.height = height;
    canvasData = context.getImageData(0, 0, width, height);
  });
  
  rayTracer.on('data', function(result) {
    // console.log('test');
    var i = 0;
    for(var y = result.begin_y; y < result.end_y; y++) {
      for(var x = result.begin_x; x < result.end_x; x++) {
        var z = (x * width + y) * 4;
        canvasData.data[z] = result.data[i++];
        canvasData.data[z+1] = result.data[i++];
        canvasData.data[z+2] = result.data[i++];
        canvasData.data[z+3] = 255;
      }
    }
    context.putImageData(canvasData, 0, 0);
  });

  rayTracer.on('end', function(){
    console.log('end');
    $('#time').html(Math.round((+new Date() - t) / 1000) + 's');
  })

  rayTracer.run();
});
