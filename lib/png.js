var Png = require('png').Png;
var fs = require('fs');

exports.write_file = function (rgb, scene, file) {
  var png = new Png(rgb, scene.global.width, scene.global.height, 'rgb');
  fs.writeFileSync(file, png.encodeSync().toString('binary'), 'binary');
}
