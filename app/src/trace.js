var $canvas, H, W, canvas, canvasData, context, default_img, editor, throttle, worker;
$canvas = $('canvas');
canvas = $canvas[0];
context = canvas.getContext('2d');
W = H = canvasData = worker = 0;
throttle = 100;
// editor = CodeMirror.fromTextArea($('textarea')[0], {
//   lineNumbers: true
// });
// $('#selection img').click(function() {
//   var title;
//   title = $(this).attr('title');
//   document.location.hash = title;
//   return $.get('examples/' + title + '.rt', function(file) {
//     return editor.setValue('# ' + title + '.rt\n\n' + file.trim());
//   });
// });
default_img = $('#selection [title=' + document.location.hash.slice(1) + ']');
if (default_img.length === 0) default_img = $('#selection img');
default_img.eq(0).click();
// $('#stop').click(function() {
//   if (worker) return worker.terminate();
// });
// $('#save').click(function() {
//   return window.open(canvas.toDataURL("image/png"));
// });
function traceBrowser(input) {
  var count, fillRect, t;
  if (worker) worker.terminate();
  worker = new Worker('src/worker.js');
  worker.postMessage([
    'process', {
      input: input
    }
  ]);
  count = 0;
  timeBrowser = +new Date();
  fillRect = function(X, Y, size, r, g, b) {
    var idxData, x, y, _results;
    _results = [];
    for (y = 0; 0 <= size ? y < size : y > size; 0 <= size ? y++ : y--) {
      idxData = ((Y + y) * W + X) * 4;
      _results.push((function() {
        var _results2;
        _results2 = [];
        for (x = 0; 0 <= size ? x < size : x > size; 0 <= size ? x++ : x--) {
          canvasData.data[idxData++] = r;
          canvasData.data[idxData++] = g;
          canvasData.data[idxData++] = b;
          _results2.push(canvasData.data[idxData++] = 255);
        }
        return _results2;
      })());
    }
    return _results;
  };
  return worker.onmessage = function(msg) {
    var idxData, idxMsg, img, realH, realW, size, texture, x, y, _ref;
    if (msg.data[0] === 'result') {
      size = msg.data[1];
      y = msg.data[2];
      idxMsg = 3;
      idxData = y * W * 4;
      for (x = 0; 0 <= W ? x < W : x > W; x += size) {
        if (size === 32 || !(x % (size * 2) === 0 && y % (size * 2) === 0)) {
          fillRect(x, y, size, msg.data[idxMsg++], msg.data[idxMsg++], msg.data[idxMsg++]);
        }
      }
      context.putImageData(canvasData, 0, 0);
      return $('#time-browser').html(Math.round((+new Date() - timeBrowser) / 1000) + 's');
    } else if (msg.data[0] === 'texture') {
      texture = msg.data[1];
      return img = $('<img>').imageLoad(function() {
        var ctx, cv;
        cv = $('<canvas>')[0];
        cv.width = this.width;
        cv.height = this.height;
        ctx = cv.getContext('2d');
        ctx.drawImage(this, 0, 0);
        return worker.postMessage([
          'texture', {
            name: texture,
            content: ctx.getImageData(0, 0, this.width, this.height)
          }
        ]);
      }).attr({
        src: texture
      });
    } else if (msg.data[0] === 'resize') {
      _ref = msg.data[1], W = _ref.W, H = _ref.H, realW = _ref.realW, realH = _ref.realH;
      context = canvas.getContext('2d');
      canvas.width = W;
      canvas.height = H;
      canvasData = context.createImageData(W, H);
      $canvas.css({
        width: realW,
        height: realH
      });
      return $('#save').show();
    } else if (msg.data[0] === 'log') {
      if (throttle-- > 0) console.log(inspect.apply(null, msg.data.slice(1)));
      if (throttle === 0) return console.log('Throttled!');
    }
  };
};

  
$.fn.imageLoad = function(fn){
    this.load(fn);
    this.each( function() {
        if ( this.complete && this.naturalWidth !== 0 ) {
            $(this).trigger('load');
        }
    });
  return this;
};

