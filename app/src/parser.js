(function() {
  var __slice = Array.prototype.slice;

  Array.prototype.contains = function(x) {
    return (this.indexOf(x)) !== -1;
  };

  self.Parser = (function() {

    Parser.prototype.objectify = function(pairs) {
      var hash, key, value, _i, _len, _ref;
      hash = {};
      for (_i = 0, _len = pairs.length; _i < _len; _i++) {
        _ref = pairs[_i], key = _ref[0], value = _ref[1];
        if (this.multiple.contains(key)) {
          if (!(key in hash)) hash[key] = [];
          hash[key].push(value);
        } else {
          hash[key] = value;
        }
      }
      return hash;
    };

    Parser.prototype.multiple = ['light', 'item', 'group'];

    Parser.prototype.convert = [
      {
        func: function(input) {
          return input[0].match(/(..)/g).map(function(hex) {
            return (parseInt(hex, 16)) / 255;
          });
        },
        fields: ['color', 'color2', 'l_color', 'tex_color_cut']
      }, {
        func: function(input) {
          return input[0];
        },
        fields: ['tex', 'type']
      }, {
        func: function(input) {
          return +input[0];
        },
        fields: ['radius', 'width', 'height', 'checkerboard', 'distscreen', 'brightness', 'group_id', 'id', 'max_reflect', 'tex_rep', 'tex_coef', 'size_mul', 'reflect', 'l_intensity', 'pnoise', 'pnoise_octave', 'pnoise_freq', 'pnoise_pers', 'bump', 'opacity', 'portal_id']
      }, {
        func: function(input) {
          return input.map(function(x) {
            return +x;
          });
        },
        fields: ['highdef', 'coords', 'limits', 'rot']
      }
    ];

    function Parser(str) {
      this.lines = str.replace(/\#[^\n]*/g, '').replace(/\{/g, '\n{').split('\n').map(function(line) {
        return line.trim();
      }).filter(function(line) {
        return line;
      });
    }

    Parser.prototype.parse = function() {
      var block;
      return this.objectify((function() {
        var _results;
        _results = [];
        while (block = this.parseBlock()) {
          _results.push(block);
        }
        return _results;
      }).call(this));
    };

    Parser.prototype.parseBlock = function() {
      var convert, key, line, name, params, values;
      name = this.lines.shift();
      if (!name) return;
      this.lines.shift();
      params = this.objectify((function() {
        var _i, _len, _ref, _ref2, _results;
        _results = [];
        while (line = this.lines.shift()) {
          if (line === '}') break;
          _ref = line.split(/\s+/), key = _ref[0], values = 2 <= _ref.length ? __slice.call(_ref, 1) : [];
          _ref2 = this.convert;
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            convert = _ref2[_i];
            if (convert.fields.contains(key)) values = convert.func(values);
          }
          _results.push([key, values]);
        }
        return _results;
      }).call(this));
      return [name, params];
    };

    return Parser;

  })();

}).call(this);
