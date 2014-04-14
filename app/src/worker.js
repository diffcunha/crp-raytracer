(function() {
  var scene, textures_remaining,
    __slice = Array.prototype.slice;

  self.copy = function(obj) {
    var key, new_obj, val;
    if (Array.isArray(obj)) {
      return obj.slice();
    } else if (obj instanceof Object && !(obj instanceof Function)) {
      new_obj = {};
      for (key in obj) {
        val = obj[key];
        new_obj[key] = copy(val);
      }
      return new_obj;
    } else {
      return obj;
    }
  };

  importScripts('glmatrix.js', 'parser.js', 'ray.js', 'perlin.js');

  self.log = function() {
    var x;
    x = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return postMessage(['log'].concat(__slice.call(x)));
  };

  scene = null;

  self.textures = {};

  textures_remaining = 0;

  this.onmessage = function(_arg) {
    var color, content, group, groups, i, id, input, item, item_raw, light, name, portals, result, size, t, two_portals, type, value, x, y, _base, _base2, _base3, _base4, _base5, _base6, _i, _j, _k, _l, _len, _len2, _len3, _len4, _len5, _m, _name, _ref, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref16, _ref17, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _results;
    _ref = _arg.data, type = _ref[0], value = _ref[1];
    if (type === 'process') {
      input = value.input;
      self.scene = scene = new Parser(input).parse();
      if ((_base = scene.global).highdef == null) _base.highdef = [];
      if ((_base2 = scene.global.highdef)[0] == null) _base2[0] = 1;
      if ((_base3 = scene.global.highdef)[1] == null) _base3[1] = 0;
      _ref2 = scene.global.highdef, scene.global.upscale = _ref2[0], scene.global.randomRays = _ref2[1];
      if ((_base4 = scene.global).distscreen == null) _base4.distscreen = 1000;
      if ((_base5 = scene.global).max_reflect == null) _base5.max_reflect = 10;
      if ((_base6 = scene.global).l_color == null) _base6.l_color = [0, 0, 0];
      scene.global.l_intensity = ((_ref3 = scene.global.l_intensity) != null ? _ref3 : 0) / 100;
      vec3.scale(scene.global.l_color, scene.global.l_intensity);
      scene.eye.rot = vec3.scale((_ref4 = scene.eye.rot) != null ? _ref4 : [0, 0, 0], Math.PI / 180);
      scene.global.W = scene.global.width * scene.global.upscale;
      scene.global.H = scene.global.height * scene.global.upscale;
      postMessage([
        'resize', {
          W: scene.global.W,
          H: scene.global.H,
          realW: scene.global.width,
          realH: scene.global.height
        }
      ]);
      groups = {};
      portals = {};
      _ref5 = scene.light || [];
      for (_i = 0, _len = _ref5.length; _i < _len; _i++) {
        light = _ref5[_i];
        if (light.coords == null) light.coords = [0, 0, 0];
        if (light.color == null) light.color = [1, 1, 1];
      }
      _ref6 = scene.item;
      for (_j = 0, _len2 = _ref6.length; _j < _len2; _j++) {
        item = _ref6[_j];
        if (item.color == null) item.color = [1, 1, 1];
        if (item.color2 == null) {
          item.color2 = item.color.map(function(x) {
            return 1 - x;
          });
        }
        if (item.coords == null) item.coords = [0, 0, 0];
        item.rot = vec3.scale((_ref7 = item.rot) != null ? _ref7 : [0, 0, 0], Math.PI / 180);
        item.brightness = ((_ref8 = item.brightness) != null ? _ref8 : 0) / 100;
        item.intensity = ((_ref9 = item.intensity) != null ? _ref9 : 100) / 100;
        item.reflect = ((_ref10 = item.reflect) != null ? _ref10 : 0) / 100;
        item.opacity = ((_ref11 = item.opacity) != null ? _ref11 : 100) / 100;
        if (item.radius == null) item.radius = 2;
        if (item.limits == null) item.limits = [0, 0, 0, 0, 0, 0];
        for (i = 0; i < 3; i++) {
          if (item.limits[2 * i] >= item.limits[2 * i + 1]) {
            item.limits[2 * i] = -Infinity;
            item.limits[2 * i + 1] = Infinity;
          }
        }
        if (item.pnoise == null) item.pnoise = 0;
        if (item.pnoise_freq == null) item.pnoise_freq = 1;
        if (item.pnoise_pers == null) item.pnoise_pers = 1;
        if (item.pnoise_octave == null) item.pnoise_octave = 1;
        item.transform = mat4.identity();
        mat4.translate(item.transform, item.coords);
        mat4.rotateX(item.transform, item.rot[0]);
        mat4.rotateY(item.transform, item.rot[1]);
        mat4.rotateZ(item.transform, item.rot[2]);
        if (item.group_id) {
          if (groups[_name = item.group_id] == null) groups[_name] = [];
          groups[item.group_id].push(item);
        }
        if (item.portal_id != null) {
          if (!(item.portal_id in portals)) portals[item.portal_id] = [];
          portals[item.portal_id].push(item);
        }
      }
      for (id in portals) {
        two_portals = portals[id];
        two_portals[0].other = two_portals[1];
        two_portals[1].other = two_portals[0];
      }
      _ref12 = scene.group || [];
      for (_k = 0, _len3 = _ref12.length; _k < _len3; _k++) {
        group = _ref12[_k];
        if (group.size_mul == null) group.size_mul = 1;
        group.rot = vec3.scale((_ref13 = group.rot) != null ? _ref13 : [0, 0, 0], Math.PI / 180);
        if (group.coords == null) group.coords = [0, 0, 0];
        group.transform = mat4.identity();
        mat4.scale(group.transform, [group.size_mul, group.size_mul, group.size_mul]);
        mat4.translate(group.transform, group.coords);
        mat4.rotateX(group.transform, group.rot[0]);
        mat4.rotateY(group.transform, group.rot[1]);
        mat4.rotateZ(group.transform, group.rot[2]);
        if (!(group.id in groups)) continue;
        _ref14 = groups[group.id];
        for (_l = 0, _len4 = _ref14.length; _l < _len4; _l++) {
          item_raw = _ref14[_l];
          item = copy(item_raw);
          delete item.group_id;
          t = mat4.create(group.transform);
          mat4.multiply(t, item.transform);
          item.transform = t;
          scene.item.push(item);
        }
      }
      scene.item = scene.item.filter(function(item) {
        return !(item.group_id != null);
      });
      textures_remaining = 1;
      _ref15 = scene.item;
      for (_m = 0, _len5 = _ref15.length; _m < _len5; _m++) {
        item = _ref15[_m];
        item.coords = mat4.multiplyVec3(item.transform, [0, 0, 0]);
        item.inverse = mat4.inverse(item.transform, mat4.create());
        item.radius2 = item.radius * item.radius;
        if (item.tex != null) {
          if (item.tex_rep == null) item.tex_rep = 0;
          if (item.tex_coef == null) item.tex_coef = 1;
          postMessage(['texture', item.tex]);
          textures_remaining++;
        }
      }
      this.onmessage({
        data: ['texture']
      });
    }
    if (type === 'texture') {
      textures_remaining--;
      if (value) {
        name = value.name, content = value.content;
        textures[name] = content;
      }
      if (textures_remaining === 0) {
        size = 32;
        _results = [];
        while (size >= 1) {
          for (y = 0, _ref16 = scene.global.H; 0 <= _ref16 ? y < _ref16 : y > _ref16; y += size) {
            result = ['result'];
            result.push(size);
            result.push(y);
            for (x = 0, _ref17 = scene.global.W; 0 <= _ref17 ? x < _ref17 : x > _ref17; x += size) {
              if (size === 32 || !(x % (size * 2) === 0 && y % (size * 2) === 0)) {
                color = process(x, y, scene.global.upscale, scene.global.randomRays);
                result.push(~~(color[0] * 255));
                result.push(~~(color[1] * 255));
                result.push(~~(color[2] * 255));
              }
            }
            postMessage(result);
          }
          _results.push(size /= 2);
        }
        return _results;
      }
    }
  };

}).call(this);
