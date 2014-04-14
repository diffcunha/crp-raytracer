(function() {
  var epsilon, inLimits, intersect, intersectItem, isValid, launchRay, lightning, mod, objects, processPixel, sign, solve_eq2,
    __slice = Array.prototype.slice;

  epsilon = 0.0001;

  mod = function(x, n) {
    return ((x % n) + n) % n;
  };

  sign = function(x) {
    if (x > 0) {
      return 1;
    } else if (x === 0) {
      return 0;
    } else {
      return -1;
    }
  };

  solve_eq2 = function(a, b, c) {
    var delta, sqDelta;
    delta = b * b - 4 * a * c;
    if (delta < 0) return [];
    sqDelta = Math.sqrt(delta);
    return [(-b - sqDelta) / (2 * a), (-b + sqDelta) / (2 * a)];
  };

  objects = {};

  objects.plane = {
    solutions: function(item, ray_) {
      if (ray_.dir[2] !== 0) {
        return [-ray_.origin[2] / ray_.dir[2]];
      } else {
        return [];
      }
    },
    pos2d: function(item, pos_, width, height) {
      return [width / 2 - pos_[1], height / 2 - pos_[0]];
    },
    normal: function(item, ray_, pos_) {
      return [0, 0, -sign(ray_.dir[2])];
    }
  };

  objects.sphere = {
    solutions: function(item, ray_) {
      var a, b, c;
      a = vec3.dot(ray_.dir, ray_.dir);
      b = 2 * vec3.dot(ray_.origin, ray_.dir);
      c = (vec3.dot(ray_.origin, ray_.origin)) - item.radius2;
      return solve_eq2(a, b, c);
    },
    pos2d: function(item, pos_, width, height) {
      var phi, theta, x, y;
      pos_ = vec3.normalize(pos_, vec3.create());
      phi = Math.acos(pos_[2]);
      y = phi / Math.PI * height;
      theta = Math.acos(pos_[1] / Math.sin(phi)) / (2 * Math.PI);
      if (pos_[0] > 0) theta = 1 - theta;
      x = theta * width;
      return [x, y];
    },
    normal: function(item, ray_, pos_) {
      return pos_;
    }
  };

  objects.cone = {
    solutions: function(item, ray_) {
      var a, b, c;
      a = ray_.dir[0] * ray_.dir[0] + ray_.dir[1] * ray_.dir[1] - item.radius2 * ray_.dir[2] * ray_.dir[2];
      b = 2 * (ray_.origin[0] * ray_.dir[0] + ray_.origin[1] * ray_.dir[1] - item.radius2 * ray_.origin[2] * ray_.dir[2]);
      c = ray_.origin[0] * ray_.origin[0] + ray_.origin[1] * ray_.origin[1] - item.radius2 * ray_.origin[2] * ray_.origin[2];
      return solve_eq2(a, b, c);
    },
    pos2d: objects.sphere.pos2d,
    normal: function(item, ray_, pos_) {
      var normal;
      normal = vec3.create(pos_);
      normal[2] = -normal[2] * Math.tan(item.radius2);
      return normal;
    }
  };

  objects.cylinder = {
    solutions: function(item, ray_) {
      var a, b, c;
      a = ray_.dir[0] * ray_.dir[0] + ray_.dir[1] * ray_.dir[1];
      b = 2 * (ray_.origin[0] * ray_.dir[0] + ray_.origin[1] * ray_.dir[1]);
      c = ray_.origin[0] * ray_.origin[0] + ray_.origin[1] * ray_.origin[1] - item.radius2;
      return solve_eq2(a, b, c);
    },
    pos2d: objects.sphere.pos2d,
    normal: function(item, ray_, pos_) {
      var normal;
      normal = vec3.create(pos_);
      normal[2] = 0;
      return normal;
    }
  };

  objects.portal = copy(objects.plane);

  objects.portal.normal = function(item, ray_, pos_) {
    return [0, 0, 1];
  };

  inLimits = function(limits, pos_) {
    var _ref, _ref2, _ref3;
    return (limits[0] <= (_ref = pos_[0]) && _ref <= limits[1]) && (limits[2] <= (_ref2 = pos_[1]) && _ref2 <= limits[3]) && (limits[4] <= (_ref3 = pos_[2]) && _ref3 <= limits[5]);
  };

  isValid = function(ray, distances, item, min_distance) {
    var distance, pos, pos_, _i, _len;
    for (_i = 0, _len = distances.length; _i < _len; _i++) {
      distance = distances[_i];
      if (!((0 < distance && distance < min_distance))) continue;
      pos = vec3.create();
      pos = vec3.add(ray.origin, vec3.scale(ray.dir, distance, pos), pos);
      pos_ = mat4.multiplyVec3(item.inverse, pos, vec3.create());
      if (inLimits(item.limits, pos_)) return [pos, pos_, distance];
    }
    return [null, null, null, null];
  };

  intersectItem = function(item, ray, min_distance) {
    var alpha, color, dir, dist, distance, idx, normal, obj, opacity, pos, pos2d, pos_, ray_, reflect, texture, x, y, _ref;
    ray_ = {
      dir: vec3.normalize(mat4.multiplyDelta3(item.inverse, ray.dir)),
      origin: mat4.multiplyVec3(item.inverse, ray.origin, [0, 0, 0])
    };
    obj = objects[item.type];
    _ref = isValid(ray, obj.solutions(item, ray_), item, min_distance), pos = _ref[0], pos_ = _ref[1], distance = _ref[2];
    if (!pos) return;
    color = item.color;
    opacity = item.opacity;
    reflect = item.reflect;
    dir = ray.dir;
    if (item.tex != null) {
      texture = textures[item.tex];
      pos2d = obj.pos2d(item, pos_, texture.width, texture.height);
      x = Math.floor(pos2d[0]);
      y = Math.floor(pos2d[1]);
      if (item.tex_rep !== 0) {
        x = mod(x * item.tex_coef, texture.width);
        y = mod(y * item.tex_coef, texture.height);
      }
      idx = (texture.width * y + x) * 4;
      opacity *= texture.data[idx + 3] / 255;
      color = [texture.data[idx] / 255, texture.data[idx + 1] / 255, texture.data[idx + 2] / 255];
    }
    if (item.checkerboard != null) {
      pos2d = obj.pos2d(item, pos_, 500, 500);
      if ((mod(pos2d[0] / item.checkerboard, 1) > 0.5) === (mod(pos2d[1] / item.checkerboard, 1) > 0.5)) {
        color = item.color2;
      }
    }
    if (item.pnoise > 0) {
      alpha = perlin(pos_, item.pnoise, item.pnoise_pers, item.pnoise_octave, item.pnoise_freq);
      color = vec3.mix(color, item.color2, alpha);
    }
    if (item.type === 'portal') {
      dist = item.radius2 - (pos_[0] * pos_[0] + 2 * pos_[1] * pos_[1]);
      if (dist < 0) return;
      opacity *= 1 - Math.exp(-dist / 2000);
      opacity = 1 - opacity;
      pos = mat4.multiplyVec3(item.other.transform, pos_, vec3.create());
      dir = vec3.normalize(mat4.multiplyDelta3(item.other.transform, vec3.create(ray_.dir)));
    }
    normal = obj.normal(item, ray_, pos_);
    normal = vec3.normalize(mat4.multiplyDelta3(item.transform, vec3.create(normal)));
    if (opacity === 0) return;
    return {
      distance: distance,
      pos: pos,
      normal: normal,
      color: color,
      item: item,
      opacity: opacity,
      reflect: reflect,
      dir: dir
    };
  };

  intersect = function(ray, min_distance) {
    var isect, item, min_isect, _i, _len, _ref;
    if (min_distance == null) min_distance = Infinity;
    min_isect = null;
    _ref = self.scene.item;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      item = _ref[_i];
      isect = intersectItem(item, ray, min_distance);
      if (isect && (!min_isect || isect.distance < min_isect.distance)) {
        min_isect = isect;
        min_distance = isect.distance;
      }
    }
    return min_isect;
  };

  lightning = function(isect) {
    var add_color, ambiant, color, dir, light, min_distance, pos, ray, shade, _i, _len, _ref;
    if (self.scene.light != null) {
      color = [0, 0, 0];
    } else {
      color = vec3.create(isect.color);
    }
    _ref = self.scene.light || [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      light = _ref[_i];
      dir = vec3.sub(light.coords, isect.pos, vec3.create());
      min_distance = vec3.length(dir);
      vec3.normalize(dir);
      pos = vec3.create();
      pos = vec3.add(isect.pos, vec3.scale(dir, epsilon, pos), pos);
      ray = {
        origin: vec3.create(pos),
        dir: vec3.create(dir)
      };
      if (!intersect(ray, min_distance)) {
        shade = Math.abs(vec3.dot(isect.normal, ray.dir));
        add_color = vec3.create(isect.color);
        add_color = vec3.plus(add_color, isect.item.brightness);
        add_color = vec3.mul(add_color, light.color);
        vec3.scale(add_color, shade);
        add_color = vec3.scale(add_color, isect.item.intensity);
        vec3.add(color, add_color);
      }
    }
    ambiant = vec3.create(isect.color);
    vec3.mul(ambiant, self.scene.global.l_color);
    vec3.add(color, ambiant);
    return color;
  };

  launchRay = function(ray, count) {
    var color, isect, ray2;
    color = [0, 0, 0];
    isect = intersect(ray);
    if (isect) {
      color = lightning(isect);
      if (count > 0 && isect.opacity < 1) {
        ray2 = {
          origin: vec3.add(isect.pos, vec3.scale(isect.dir, epsilon, vec3.create()), vec3.create()),
          dir: vec3.normalize(vec3.create(isect.dir))
        };
        color = vec3.mix(color, launchRay(ray2, count - 1), 1 - isect.opacity);
      }
      if (count > 0 && isect.reflect > 0) {
        ray2 = {
          origin: vec3.add(isect.pos, vec3.scale(isect.normal, epsilon, vec3.create()), vec3.create()),
          dir: vec3.normalize(vec3.reflect(ray.dir, vec3.normalize(isect.normal), vec3.create()))
        };
        color = vec3.mix(color, launchRay(ray2, count - 1), isect.reflect);
      }
    }
    return color;
  };

  processPixel = function(x, y) {
    var ray;
    ray = {
      origin: vec3.create(self.scene.eye.coords),
      dir: vec3.normalize([self.scene.global.distscreen, x, y])
    };
    ray.dir = vec3.normalize(vec3.rotateXYZ.apply(vec3, [ray.dir].concat(__slice.call(self.scene.eye.rot))));
    return launchRay(ray, self.scene.global.max_reflect);
  };

  self.process = function(x, y, upscale, randomRays) {
    var color, i;
    color = [0, 0, 0];
    vec3.add(color, processPixel((self.scene.global.W / 2 - x) / upscale, (self.scene.global.H / 2 - y) / upscale));
    for (i = 0; 0 <= randomRays ? i < randomRays : i > randomRays; 0 <= randomRays ? i++ : i--) {
      vec3.add(color, processPixel((self.scene.global.W / 2 - x + Math.random() - 0.5) / upscale, (self.scene.global.H / 2 - y + Math.random() - 0.5) / upscale));
    }
    return vec3.scale(color, 1 / (1 + randomRays));
  };

}).call(this);
