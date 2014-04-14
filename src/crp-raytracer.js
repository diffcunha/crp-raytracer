var fs = require('fs');
var credentials = require('../credentials');
var RayTracer = require('crp-raytracer');
var Parser = require('../node_modules/crp-raytracer/src/parser').Parser;

/* Number of units */
var split = 50;
console.log("# units: " + split  + " x " + split + " = " + split * split);

var canvasCrp = $('canvas')[1];
var contextCrp = canvasCrp.getContext('2d');
var canvasCrpData;

var input = fs.readFileSync('./app/examples/pokeball.rt', 'utf8');
var scene = new Parser(input).parse();

$('#start-rendering').click(function() {
  var t;
  var rgb;
  var width;
  var height;

  rayTracer = new RayTracer({
    split: split,
    input: input,
    credentials: credentials
  });
  
  timeCrp = +new Date();

  rayTracer.on('run', function(result) {
    width = result.width;
    height = result.height;
    canvas.width = width;
    canvas.height = height;
    canvasCrpData = contextCrp.getImageData(0, 0, width, height);
  });
  
  rayTracer.on('data', function(result) {
    var i = 0;
    for(var y = result.begin_y; y < result.end_y; y++) {
      for(var x = result.begin_x; x < result.end_x; x++) {
        var z = (x * width + y) * 4;
        canvasCrpData.data[z] = result.data[i++];
        canvasCrpData.data[z+1] = result.data[i++];
        canvasCrpData.data[z+2] = result.data[i++];
        canvasCrpData.data[z+3] = 255;
      }
    }
    context.putImageData(canvasCrpData, 0, 0);
  });

  rayTracer.on('end', function(){
    console.log('end');
    $('#time-crp').html(Math.round((+new Date() - timeCrp) / 1000) + 's');
  })

  rayTracer.run();

  //In the Browser
  traceBrowser(input);
});
