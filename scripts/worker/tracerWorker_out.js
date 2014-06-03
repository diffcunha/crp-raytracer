(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"crp-raytracer":3}],2:[function(require,module,exports){

module.exports = CrowdProcess;

function CrowdProcess(token, program, data, onData, onEnd, onError) {

    createJob(program, function(jobId) {
        getErrors(jobId, onError);
        getResults(jobId, data.length, onData);
        createTasks(jobId);
    });

    function createJob(program, cb) {
        var payload = JSON.stringify({
            "program": program
        });

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.crowdprocess.com/jobs', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader("Authorization", "Token " + token);

        xhr.onreadystatechange = function() {
            if(xhr.readyState == 4 && xhr.status == 201) {
                var res = JSON.parse(xhr.responseText);
                if(cb) {
                    cb(res.id);
                }
            }
        };
        xhr.onerror = function(error) {
            console.error(xhr.statusText);
            if(onError) {
                onError(error);
            }
        };
        xhr.send(payload);
    }

    function createTasks(jobId) {
        var payload = data.map(JSON.stringify).join('\n');

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.crowdprocess.com/jobs/' + jobId + '/tasks', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader("Authorization", "Token " + token);

        xhr.onerror = function(error) {
            console.error(xhr.statusText);
            if(onError) {
                onError(error);
            }
        };
        xhr.send(payload);
    }

    function getErrors(jobId, cb) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.crowdprocess.com/jobs/' + jobId + '/errors?stream=true');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader("Authorization", "Token " + token);
        xhr.seenBytes = 0;

        xhr.onreadystatechange = function() {
            if(xhr.readyState > 2) {
                var newData = xhr.responseText.substr(xhr.seenBytes);
                
                var lastIndex = newData.lastIndexOf('\n') + 1; // include '\n'
                if(lastIndex > 0) {
                    var lines = newData.substring(0, lastIndex).split(/\r?\n/);
                    lines.pop();
                    lines.map(function(data) {
                        onError(JSON.parse(data));
                    });
                    xhr.seenBytes += lastIndex; 
                }
            }
        };

        xhr.send();
    }

    function getResults(jobId, nTasks, cb) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.crowdprocess.com/jobs/' + jobId + '/results?stream=true');
        xhr.setRequestHeader("Authorization", "Token " + token);
        xhr.seenBytes = 0;

        xhr.onreadystatechange = function handle() {
            // if(xhr.readyState == 2) {
            //     if(cb) {
            //         cb();
            //     }
            // }
            if(xhr.readyState > 2) {
                var newData = xhr.responseText.substr(xhr.seenBytes);
                /*
                var lastIndex = newData.lastIndexOf('\n') + 1; // include '\n'
                if(lastIndex > 0) {
                    var lines = newData.substring(0, lastIndex).split(/\r?\n/);
                    lines.pop();
                    lines.map(function(data) {
                        onData(JSON.parse(data));
                        nTasks--;
                    });
                    xhr.seenBytes += lastIndex; 
                }
                */
                for(var begin = 0, end = newData.indexOf('\n'); end > 0; end = newData.indexOf('\n', begin)) {
                    end++; // include '\n'
                    var data = newData.substring(begin, end);
                    onData(JSON.parse(data));
                    nTasks--;
                    xhr.seenBytes += end - begin;
                    begin = end;
                }
            }
            if(nTasks == 0) {
                xhr.abort();
                if(onEnd) {
                    onEnd();
                }
            }
        };

        xhr.send(null);
    }
}
},{}],3:[function(require,module,exports){
'use strict'


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
    var program = "var scene, textures_remaining,\n__slice = [].slice;\n\nvar self = {};\n\nfunction copy(obj) {\n  if(Array.isArray(obj)) {\n    return obj.slice();\n  } else if (obj instanceof Object && !(obj instanceof Function)) {\n    var new_obj = {};\n    for(var key in obj) {\n      var val = obj[key];\n      new_obj[key] = copy(val);\n    }\n    return new_obj;\n  } else {\n    return obj;\n  }\n};\n\n/* glMatrix */\n\nvar cos=Math.cos, sin=Math.sin;\nvec3={\n  create:function(a){var b=new Array(3);a?(b[0]=a[0],b[1]=a[1],b[2]=a[2]):b[0]=b[1]=b[2]=0;return b},\n  set:function(a,b){b[0]=a[0];b[1]=a[1];b[2]=a[2];return b},\n  add:function(a,b,c){if(!c||a===c)return a[0]+=b[0],a[1]+=b[1],a[2]+=b[2],a;c[0]=a[0]+b[0];c[1]=a[1]+b[1];c[2]=a[2]+b[2];return c},\n  mul:function(a,b,c){if(!c||a===c)return a[0]*=b[0],a[1]*=b[1],a[2]*=b[2],a;c[0]=a[0]*b[0];c[1]=a[1]*b[1];c[2]=a[2]*b[2];return c},\n  sub:function(a,b,c){if(!c||a===c)return a[0]-=b[0],a[1]-=b[1],a[2]-=b[2],a;c[0]=a[0]-b[0];c[1]=a[1]-b[1];c[2]=a[2]-b[2];return c},\n  negate:function(a,b){b||(b=a);b[0]=-a[0];b[1]=-a[1];b[2]=-a[2];return b},\n  scale:function(a,b,c){if(!c||a===c)return a[0]*=b,a[1]*=b,a[2]*=b,a;c[0]=a[0]*b;c[1]=a[1]*b;c[2]=a[2]*b;return c},\n  plus:function(a,b,c){if(!c||a===c)return a[0]+=b,a[1]+=b,a[2]+=b,a;c[0]=a[0]+b;c[1]=a[1]+b;c[2]=a[2]+b;return c},\n  normalize:function(a,b){b||(b=a);var c=a[0],e=a[1],f=a[2],d=Math.sqrt(c*c+e*e+f*f);if(d){if(1===d)return b[0]=c,b[1]=e,b[2]=f,b}else return b[0]=0,b[1]=0,b[2]=0,b;d=1/d;b[0]=c*d;b[1]=e*d;b[2]=f*d;return b},\n  cross:function(a,b,c){c||(c=a);var e=a[0],f=a[1],a=a[2],d=b[0],g=b[1],b=b[2];c[0]=f*b-a*g;c[1]=a*d-e*b;c[2]=e*g-f*d;return c},\n  dot:function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]},\n  str:function (a) {return '['+a[0]+', '+a[1]+', '+a[2]+']'},\n  length:function (vec) { var x = vec[0], y = vec[1], z = vec[2]; return Math.sqrt(x * x + y * y + z * z);},\n  reflect:function(i,n,r){return vec3.sub(i,vec3.scale(n,2*vec3.dot(n,i),r),r)},\n  rotateXYZ:function(v,x,y,z){\n    var m=mat4.create(mat4.identity());\n    mat4.rotateX(m,x);\n    mat4.rotateY(m,y);\n    mat4.rotateZ(m,z);\n    return mat4.multiplyVec3(m,v);\n  },\n  mix:function(x,y,a){\n    return vec3.add(\n      vec3.scale(x,1-a,vec3.create()),\n      vec3.scale(y,a,vec3.create()),\n      vec3.create());\n  }\n}\nmat4={\n  create:function(a){var b=new Array(16);a&&(b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b[4]=a[4],b[5]=a[5],b[6]=a[6],b[7]=a[7],b[8]=a[8],b[9]=a[9],b[10]=a[10],b[11]=a[11],b[12]=a[12],b[13]=a[13],b[14]=a[14],b[15]=a[15]);return b},\n  identity:function(a){a||(a=mat4.create());a[0]=1;a[1]=0;a[2]=0;a[3]=0;a[4]=0;a[5]=1;a[6]=0;a[7]=0;a[8]=0;a[9]=0;a[10]=1;a[11]=0;a[12]=0;a[13]=0;a[14]=0;a[15]=1;return a},\n  multiplyVec3:function(a,b,c){c||(c=b);var d=b[0],e=b[1],b=b[2];c[0]=a[0]*d+a[4]*e+a[8]*b+a[12];c[1]=a[1]*d+a[5]*e+a[9]*b+a[13];c[2]=a[2]*d+a[6]*e+a[10]*b+a[14];return c},\n  multiplyDelta3: function(mat, vec) {\n    var a_ = mat4.multiplyVec3(mat, [0, 0, 0]);\n    var b_ = mat4.multiplyVec3(mat, vec3.create(vec));\n    return vec3.sub(b_, a_);\n  },\n  rotateX:function(b,c,a){var d=Math.sin(c),c=Math.cos(c),e=b[4],f=b[5],g=b[6],h=b[7],i=b[8],j=b[9],k=b[10],l=b[11];a?b!==a&&(a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]):a=b;a[4]=e*c+i*d;a[5]=f*c+j*d;a[6]=g*c+k*d;a[7]=h*c+l*d;a[8]=e*-d+i*c;a[9]=f*-d+j*c;a[10]=g*-d+k*c;a[11]=h*-d+l*c;return a},\n  rotateY:function(b,c,a){var d=Math.sin(c),c=Math.cos(c),e=b[0],f=b[1],g=b[2],h=b[3],i=b[8],j=b[9],k=b[10],l=b[11];a?b!==a&&(a[4]=b[4],a[5]=b[5],a[6]=b[6],a[7]=b[7],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]):a=b;a[0]=e*c+i*-d;a[1]=f*c+j*-d;a[2]=g*c+k*-d;a[3]=h*c+l*-d;a[8]=e*d+i*c;a[9]=f*d+j*c;a[10]=g*d+k*c;a[11]=h*d+l*c;return a},\n  rotateZ:function(b,c,a){var d=Math.sin(c),c=Math.cos(c),e=b[0],f=b[1],g=b[2],h=b[3],i=b[4],j=b[5],k=b[6],l=b[7];a?b!==a&&(a[8]=b[8],a[9]=b[9],a[10]=b[10],a[11]=b[11],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]):a=b;a[0]=e*c+i*d;a[1]=f*c+j*d;a[2]=g*c+k*d;a[3]=h*c+l*d;a[4]=e*-d+i*c;a[5]=f*-d+j*c;a[6]=g*-d+k*c;a[7]=h*-d+l*c;return a},\n  translate:function(a,c,b){var d=c[0],e=c[1],c=c[2],f,g,h,i,j,k,l,m,n,o,p,q;if(!b||a===b)return a[12]=a[0]*d+a[4]*e+a[8]*c+a[12],a[13]=a[1]*d+a[5]*e+a[9]*c+a[13],a[14]=a[2]*d+a[6]*e+a[10]*c+a[14],a[15]=a[3]*d+a[7]*e+a[11]*c+a[15],a;f=a[0];g=a[1];h=a[2];i=a[3];j=a[4];k=a[5];l=a[6];m=a[7];n=a[8];o=a[9];p=a[10];q=a[11];b[0]=f;b[1]=g;b[2]=h;b[3]=i;b[4]=j;b[5]=k;b[6]=l;b[7]=m;b[8]=n;b[9]=o;b[10]=p;b[11]=q;b[12]=f*d+j*e+n*c+a[12];b[13]=g*d+k*e+o*c+a[13];b[14]=h*d+l*e+p*c+a[14];b[15]=i*d+m*e+q*c+a[15];return b},\n  scale:function(a,c,b){var d=c[0],e=c[1],c=c[2];if(!b||a===b)return a[0]*=d,a[1]*=d,a[2]*=d,a[3]*=d,a[4]*=e,a[5]*=e,a[6]*=e,a[7]*=e,a[8]*=c,a[9]*=c,a[10]*=c,a[11]*=c,a;b[0]=a[0]*d;b[1]=a[1]*d;b[2]=a[2]*d;b[3]=a[3]*d;b[4]=a[4]*e;b[5]=a[5]*e;b[6]=a[6]*e;b[7]=a[7]*e;b[8]=a[8]*c;b[9]=a[9]*c;b[10]=a[10]*c;b[11]=a[11]*c;b[12]=a[12];b[13]=a[13];b[14]=a[14];b[15]=a[15];return b},\n  inverse:function(c,a){a||(a=c);var d=c[0],e=c[1],f=c[2],g=c[3],h=c[4],i=c[5],j=c[6],k=c[7],l=c[8],m=c[9],n=c[10],o=c[11],p=c[12],q=c[13],r=c[14],s=c[15],t=d*i-e*h,u=d*j-f*h,v=d*k-g*h,w=e*j-f*i,x=e*k-g*i,y=f*k-g*j,z=l*q-m*p,A=l*r-n*p,B=l*s-o*p,C=m*r-n*q,D=m*s-o*q,E=n*s-o*r,b=t*E-u*D+v*C+w*B-x*A+y*z;if(!b)return null;b=1/b;a[0]=(i*E-j*D+k*C)*b;a[1]=(-e*E+f*D-g*C)*b;a[2]=(q*y-r*x+s*w)*b;a[3]=(-m*y+n*x-o*w)*b;a[4]=(-h*E+j*B-k*A)*b;a[5]=(d*E-f*B+g*A)*b;a[6]=(-p*y+r*v-s*u)*b;a[7]=(l*y-n*v+o*u)*b;a[8]=(h*D-i*B+k*z)*b;a[9]=(-d*D+e*B-g*z)*b;a[10]=(p*x-q*v+s*t)*b;a[11]=(-l*x+m*v-o*t)*b;a[12]=(-h*C+i*A-j*z)*b;a[13]=(d*C-e*A+f*z)*b;a[14]=(-p*w+q*u-r*t)*b;a[15]=(l*w-m*u+n*t)*b;return a},\n  multiply:function(a,b,c){c||(c=a);var d=a[0],e=a[1],f=a[2],g=a[3],h=a[4],i=a[5],j=a[6],k=a[7],l=a[8],m=a[9],n=a[10],o=a[11],p=a[12],q=a[13],r=a[14],a=a[15],s=b[0],t=b[1],u=b[2],v=b[3],w=b[4],x=b[5],y=b[6],z=b[7],A=b[8],B=b[9],C=b[10],D=b[11],E=b[12],F=b[13],G=b[14],b=b[15];c[0]=s*d+t*h+u*l+v*p;c[1]=s*e+t*i+u*m+v*q;c[2]=s*f+t*j+u*n+v*r;c[3]=s*g+t*k+u*o+v*a;c[4]=w*d+x*h+y*l+z*p;c[5]=w*e+x*i+y*m+z*q;c[6]=w*f+x*j+y*n+z*r;c[7]=w*g+x*k+y*o+z*a;c[8]=A*d+B*h+C*l+D*p;c[9]=A*e+B*i+C*m+D*q;c[10]=A*f+B*j+C*n+D*r;c[11]=A*g+B*k+C*o+D*a;c[12]=E*d+F*h+G*l+b*p;c[13]=E*e+F*i+G*m+b*q;c[14]=E*f+F*j+G*n+b*r;c[15]=E*g+F*k+G*o+b*a;return c}\n}\n\n/* ray.js */\n\nvar inLimits, intersect, intersectItem, isValid, launchRay, lightning, mod, objects, processPixel, sign, solve_eq2,\n__slice = [].slice;\n\nvar epsilon = 0.0001;\n\nfunction mod(x, n) {\n  return ((x % n) + n) % n;\n}\n\nfunction sign(x) {\n  if (x > 0) {\n    return 1;\n  } else if (x === 0) {\n    return 0;\n  } else {\n    return -1;\n  }\n}\n\nfunction solve_eq2(a, b, c) {\n  var delta = b * b - 4 * a * c;\n  if (delta < 0) {\n    return [];\n  }\n  var sqDelta = Math.sqrt(delta);\n  return [(-b - sqDelta) / (2 * a), (-b + sqDelta) / (2 * a)];\n}\n\n/*\n * Objects\n */\n\nobjects = {};\n\nobjects.plane = {\n  solutions: function(item, ray_) {\n    if (ray_.dir[2] !== 0) {\n      return [-ray_.origin[2] / ray_.dir[2]];\n    } else {\n      return [];\n    }\n  },\n  pos2d: function(item, pos_, width, height) {\n    return [width / 2 - pos_[1], height / 2 - pos_[0]];\n  },\n  normal: function(item, ray_, pos_) {\n    return [0, 0, -sign(ray_.dir[2])];\n  }\n};\n\nobjects.sphere = {\n  solutions: function(item, ray_) {\n    var a, b, c;\n    a = vec3.dot(ray_.dir, ray_.dir);\n    b = 2 * vec3.dot(ray_.origin, ray_.dir);\n    c = (vec3.dot(ray_.origin, ray_.origin)) - item.radius2;\n    return solve_eq2(a, b, c);\n  },\n  pos2d: function(item, pos_, width, height) {\n    var phi, theta, x, y;\n    pos_ = vec3.normalize(pos_, vec3.create());\n    phi = Math.acos(pos_[2]);\n    y = phi / Math.PI * height;\n    theta = Math.acos(pos_[1] / Math.sin(phi)) / (2 * Math.PI);\n    if (pos_[0] > 0) {\n      theta = 1 - theta;\n    }\n    x = theta * width;\n    return [x, y];\n  },\n  normal: function(item, ray_, pos_) {\n    return pos_;\n  }\n};\n\nobjects.cone = {\n  solutions: function(item, ray_) {\n    var a, b, c;\n    a = ray_.dir[0] * ray_.dir[0] + ray_.dir[1] * ray_.dir[1] - item.radius * ray_.dir[2] * ray_.dir[2];\n    b = 2 * (ray_.origin[0] * ray_.dir[0] + ray_.origin[1] * ray_.dir[1] - item.radius * ray_.origin[2] * ray_.dir[2]);\n    c = ray_.origin[0] * ray_.origin[0] + ray_.origin[1] * ray_.origin[1] - item.radius * ray_.origin[2] * ray_.origin[2];\n    return solve_eq2(a, b, c);\n  },\n  pos2d: objects.sphere.pos2d,\n  normal: function(item, ray_, pos_) {\n    var normal;\n    normal = vec3.create(pos_);\n    normal[2] = -normal[2] * Math.tan(item.radius2);\n    return normal;\n  }\n};\n\nobjects.cylinder = {\n  solutions: function(item, ray_) {\n    var a, b, c;\n    a = ray_.dir[0] * ray_.dir[0] + ray_.dir[1] * ray_.dir[1];\n    b = 2 * (ray_.origin[0] * ray_.dir[0] + ray_.origin[1] * ray_.dir[1]);\n    c = ray_.origin[0] * ray_.origin[0] + ray_.origin[1] * ray_.origin[1] - item.radius2;\n    return solve_eq2(a, b, c);\n  },\n  pos2d: objects.sphere.pos2d,\n  normal: function(item, ray_, pos_) {\n    var normal;\n    normal = vec3.create(pos_);\n    normal[2] = 0;\n    return normal;\n  }\n};\n\nobjects.portal = copy(objects.plane);\n\nobjects.portal.normal = function(item, ray_, pos_) {\n  return [0, 0, 1];\n};\n\nfunction inLimits(limits, pos_) {\n  var _ref, _ref1, _ref2;\n  return (limits[0] <= (_ref = pos_[0]) && _ref <= limits[1]) && (limits[2] <= (_ref1 = pos_[1]) && _ref1 <= limits[3]) && (limits[4] <= (_ref2 = pos_[2]) && _ref2 <= limits[5]);\n};\n\nfunction isValid(ray, distances, item, min_distance) {\n  var distance, pos, pos_, _i, _len;\n  for (_i = 0, _len = distances.length; _i < _len; _i++) {\n    distance = distances[_i];\n    if (!((0 < distance && distance < min_distance))) {\n      continue;\n    }\n    pos = vec3.create();\n    pos = vec3.add(ray.origin, vec3.scale(ray.dir, distance, pos), pos);\n    pos_ = mat4.multiplyVec3(item.inverse, pos, vec3.create());\n    if (inLimits(item.limits, pos_)) {\n      return [pos, pos_, distance];\n    }\n  }\n  return [null, null, null, null];\n};\n\nfunction intersectItem(item, ray, min_distance) {\n  var ray_ = {\n    dir: vec3.normalize(mat4.multiplyDelta3(item.inverse, ray.dir)),\n    origin: mat4.multiplyVec3(item.inverse, ray.origin, [0, 0, 0])\n  };\n  var obj = objects[item.type];\n\n  var _ref = isValid(ray, obj.solutions(item, ray_), item, min_distance);\n  var pos = _ref[0];\n  var pos_ = _ref[1];\n  var distance = _ref[2];\n  if(!pos) {\n    return;\n  }\n  var color = item.color;\n  var opacity = item.opacity;\n  var reflect = item.reflect;\n  var dir = ray.dir;\n  if(item.tex != null) {\n    var texture = textures[item.tex];\n    var pos2d = obj.pos2d(item, pos_, texture.width, texture.height);\n    var x = Math.floor(pos2d[0]);\n    var y = Math.floor(pos2d[1]);\n    if(item.tex_rep !== 0) {\n      x = mod(x * item.tex_coef, texture.width);\n      y = mod(y * item.tex_coef, texture.height);\n    }\n    var idx = (texture.width * y + x) * 4;\n    opacity *= texture.data[idx + 3] / 255;\n    color = [texture.data[idx] / 255, texture.data[idx + 1] / 255, texture.data[idx + 2] / 255];\n  }\n  if(item.checkerboard != null) {\n    var pos2d = obj.pos2d(item, pos_, 500, 500);\n    if((mod(pos2d[0] / item.checkerboard, 1) > 0.5) === (mod(pos2d[1] / item.checkerboard, 1) > 0.5)) {\n      color = item.color2;\n    }\n  }\n  if(item.pnoise > 0) {\n    var alpha = perlin(pos_, item.pnoise, item.pnoise_pers, item.pnoise_octave, item.pnoise_freq);\n    color = vec3.mix(color, item.color2, alpha);\n  }\n  if(item.type === 'portal') {\n    var dist = item.radius2 - (pos_[0] * pos_[0] + 2 * pos_[1] * pos_[1]);\n    if(dist < 0) {\n      return;\n    }\n    opacity *= 1 - Math.exp(-dist / 2000);\n    opacity = 1 - opacity;\n    pos = mat4.multiplyVec3(item.other.transform, pos_, vec3.create());\n    dir = vec3.normalize(mat4.multiplyDelta3(item.other.transform, vec3.create(ray_.dir)));\n  }\n  var normal = obj.normal(item, ray_, pos_);\n  normal = vec3.normalize(mat4.multiplyDelta3(item.transform, vec3.create(normal)));\n  if(opacity === 0) {\n    return;\n  }\n  return {\n    distance: distance,\n    pos: pos,\n    normal: normal,\n    color: color,\n    item: item,\n    opacity: opacity,\n    reflect: reflect,\n    dir: dir\n  };\n};\n\nfunction intersect(ray, min_distance) {\n  if(min_distance == null) {\n    min_distance = Infinity;\n  }\n  var min_isect = null;\n  for(i = 0; i < self.scene.item.length; i++) {\n    var item = self.scene.item[i];\n    var isect = intersectItem(item, ray, min_distance);\n    if(isect && (!min_isect || isect.distance < min_isect.distance)) {\n      min_isect = isect;\n      min_distance = isect.distance;\n    }\n  }\n  return min_isect;\n};\n\nfunction lightning(isect) {\n  var color;\n  if(self.scene.light != null) {\n    color = [0, 0, 0];\n  } else {\n    color = vec3.create(isect.color);\n  }\n  for(var i = 0; i < self.scene.light.length; i++) {\n    var light = self.scene.light[i];\n    var dir = vec3.sub(light.coords, isect.pos, vec3.create());\n    var min_distance = vec3.length(dir);\n    vec3.normalize(dir);\n    var pos = vec3.create();\n    pos = vec3.add(isect.pos, vec3.scale(dir, epsilon, pos), pos);\n    var ray = {\n      origin: vec3.create(pos),\n      dir: vec3.create(dir)\n    };\n    if(!intersect(ray, min_distance)) {\n      var shade = Math.abs(vec3.dot(isect.normal, ray.dir));\n      var add_color = vec3.create(isect.color);\n      add_color = vec3.plus(add_color, isect.item.brightness);\n      add_color = vec3.mul(add_color, light.color);\n      vec3.scale(add_color, shade);\n      add_color = vec3.scale(add_color, isect.item.intensity);\n      vec3.add(color, add_color);\n    }\n  }\n  var ambiant = vec3.create(isect.color);\n  vec3.mul(ambiant, self.scene.global.l_color);\n  vec3.add(color, ambiant);\n  return color;\n};\n\nfunction launchRay(ray, count) {\n  var color = [0, 0, 0];\n  var isect = intersect(ray);\n  if(isect) {\n    color = lightning(isect);\n    if(count > 0 && isect.opacity < 1) {\n      var ray2 = {\n        origin: vec3.add(isect.pos, vec3.scale(isect.dir, epsilon, vec3.create()), vec3.create()),\n        dir: vec3.normalize(vec3.create(isect.dir))\n      };\n      color = vec3.mix(color, launchRay(ray2, count - 1), 1 - isect.opacity);\n    }\n    if(count > 0 && isect.reflect > 0) {\n      var ray2 = {\n        origin: vec3.add(isect.pos, vec3.scale(isect.normal, epsilon, vec3.create()), vec3.create()),\n        dir: vec3.normalize(vec3.reflect(ray.dir, vec3.normalize(isect.normal), vec3.create()))\n      };\n      color = vec3.mix(color, launchRay(ray2, count - 1), isect.reflect);\n    }\n  }\n  return color;\n};\n\nfunction processPixel(x, y) {\n  var ray = {\n    origin: vec3.create(self.scene.eye.coords),\n    dir: vec3.normalize([self.scene.global.distscreen, x, y])\n  };\n  ray.dir = vec3.normalize(vec3.rotateXYZ.apply(vec3, [ray.dir].concat(__slice.call(self.scene.eye.rot))));\n  return launchRay(ray, self.scene.global.max_reflect);\n};\n\nfunction process(x, y, upscale, randomRays) {\n  var color = [0, 0, 0];\n  vec3.add(color, processPixel((self.scene.global.W / 2 - x) / upscale, (self.scene.global.H / 2 - y) / upscale));\n  for(var i = 0; i < randomRays; i++) {\n    vec3.add(color, processPixel((self.scene.global.W / 2 - x + Math.random() - 0.5) / upscale, (self.scene.global.H / 2 - y + Math.random() - 0.5) / upscale));\n  }\n  return vec3.scale(color, 1 / (1 + randomRays));\n};\n\n/* perlin.js */\n\nvar perlin;\n\n// Generated by CoffeeScript 1.7.1\n(function() {\n  \n  // http://asserttrue.blogspot.com/2011/12/perlin-noise-in-javascript_31.html\n  // This is a port of Ken Perlin's Java code. The\n  // original Java code is at http://cs.nyu.edu/%7Eperlin/noise/.\n  // Note that in this version, a number from 0 to 1 is returned.\n  PerlinNoise = new function() {\n\n    this.noise = function noise(x, y, z) {\n\n       var p = new Array(512)\n       var permutation = [ 151,160,137,91,90,15,\n       131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,\n       190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,\n       88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,\n       77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,\n       102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,\n       135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,\n       5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,\n       223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,\n       129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,\n       251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,\n       49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,\n       138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];\n       for (var i=0; i < 256 ; i++)\n        p[256+i] = p[i] = permutation[i];\n\n        var X = Math.floor(x) & 255,                  // FIND UNIT CUBE THAT\n              Y = Math.floor(y) & 255,                  // CONTAINS POINT.\n              Z = Math.floor(z) & 255;\n          x -= Math.floor(x);                                // FIND RELATIVE X,Y,Z\n          y -= Math.floor(y);                                // OF POINT IN CUBE.\n          z -= Math.floor(z);\n          var    u = fade(x),                                // COMPUTE FADE CURVES\n                 v = fade(y),                                // FOR EACH OF X,Y,Z.\n                 w = fade(z);\n          var A = p[X  ]+Y, AA = p[A]+Z, AB = p[A+1]+Z,      // HASH COORDINATES OF\n              B = p[X+1]+Y, BA = p[B]+Z, BB = p[B+1]+Z;      // THE 8 CUBE CORNERS,\n\n          return scale(lerp(w, lerp(v, lerp(u, grad(p[AA  ], x  , y  , z   ),  // AND ADD\n                                         grad(p[BA  ], x-1, y  , z   )), // BLENDED\n                                 lerp(u, grad(p[AB  ], x  , y-1, z   ),  // RESULTS\n                                         grad(p[BB  ], x-1, y-1, z   ))),// FROM  8\n                         lerp(v, lerp(u, grad(p[AA+1], x  , y  , z-1 ),  // CORNERS\n                                         grad(p[BA+1], x-1, y  , z-1 )), // OF CUBE\n                                 lerp(u, grad(p[AB+1], x  , y-1, z-1 ),\n                                         grad(p[BB+1], x-1, y-1, z-1 )))));\n    }\n    \n    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }\n    function lerp( t, a, b) { return a + t * (b - a); }\n    function grad(hash, x, y, z) {\n      var h = hash & 15; /* CONVERT LO 4 BITS OF HASH CODE */\n      var u = h<8 ? x : y, /* INTO 12 GRADIENT DIRECTIONS. */\n      v = h<4 ? y : h==12||h==14 ? x : z;\n      return ((h&1) == 0 ? u : -u) + ((h&2) == 0 ? v : -v);\n    }\n    function scale(n) { return n; /*return (1 + n)/2;*/ }\n  };\n  \n  var clamp = function clamp(x, min, max) {\n    if (x < min) {\n      return min;\n    }\n    if (x > max) {\n      return max;\n    }\n    return x;\n  };\n\n  perlin = function perlin(pos, id, persistence, octaves, frequence) {\n    var amplitude, frequency, i, noise, _i;\n    pos = vec3.scale(pos, frequence, vec3.create());\n    noise = 0;\n    frequency = 1;\n    amplitude = 1;\n    for (i = _i = 0; 0 <= octaves ? _i < octaves : _i > octaves; i = 0 <= octaves ? ++_i : --_i) {\n      noise += amplitude * PerlinNoise.noise(pos[0] * frequency, pos[1] * frequency, pos[2] * frequency);\n      frequency *= 2;\n      amplitude *= persistence;\n    }\n    if (id === 2) {\n      noise *= 20;\n      noise = noise - Math.floor(noise);\n    }\n    if (id === 3) {\n      noise = Math.cos(noise);\n    }\n    return (clamp(noise, -1, 1) + 1) / 2;\n  };\n\n}).call(this);\n\n/* worker.js */\n\nscene = null;\nself.textures = {};\n\nfunction render(scene, animation) {\n  self.scene = scene;\n\n  if(scene.global.highdef == null) {\n    scene.global.highdef = [];\n  }\n  if(scene.global.highdef[0] == null) {\n    scene.global.highdef[0] = 1;\n  }\n  if(scene.global.highdef[1] == null) {\n    scene.global.highdef[1] = 0;\n  }\n\n  scene.global.upscale = scene.global.highdef[0];\n  scene.global.randomRays = scene.global.highdef[1];\n\n  if(scene.global.distscreen == null) {\n    scene.global.distscreen = 1000;\n  }\n  if(scene.global.max_reflect == null) {\n    scene.global.max_reflect = 10;\n  }\n  if(scene.global.l_color == null) {\n    scene.global.l_color = [0, 0, 0];\n  }\n\n  scene.global.l_intensity = (scene.global.l_intensity != null ? scene.global.l_intensity : 0) / 100;\n  vec3.scale(scene.global.l_color, scene.global.l_intensity);\n\n  if(animation) {\n    var theta = (2 * Math.PI * animation.frame) / animation.frames;\n    scene.eye.coords = [400 * Math.cos(-(Math.PI - theta)), 400 * Math.sin(-(Math.PI - theta)), 0];\n    scene.eye.rot = [0, 0, theta];\n  } else {\n    scene.eye.rot = vec3.scale(scene.eye.rot != null ? scene.eye.rot : [0, 0, 0], Math.PI / 180);\n  }\n\n  scene.global.W = scene.global.width * scene.global.upscale;\n  scene.global.H = scene.global.height * scene.global.upscale;\n  \n  var groups = {};\n  var portals = {};\n\n  if(scene.light == null) {\n    scene.light = [];\n  }\n  for(var i = 0; i < scene.light.length; i++) {\n    var light = scene.light[i];\n    if(light.coords == null) {\n      light.coords = [0, 0, 0];\n    }\n    if(light.color == null) {\n      light.color = [1, 1, 1];\n    }\n  }\n  /* Items */\n  for(var i = 0; i < scene.item.length; i++) {\n    var item = scene.item[i];\n\n    if(item.color == null) {\n      item.color = [1, 1, 1];\n    }\n    if(item.color2 == null) {\n      item.color2 = item.color.map(function(x) {\n        return 1 - x;\n      });\n    }\n    if(item.coords == null) {\n      item.coords = [0, 0, 0];\n    }\n    item.rot = vec3.scale(item.rot != null ? item.rot : [0, 0, 0], Math.PI / 180);\n    item.brightness = (item.brightness != null ? item.brightness : 0) / 100;\n    item.intensity = (item.intensity != null ? item.intensity : 100) / 100;\n    item.reflect = (item.reflect != null ? item.reflect : 0) / 100;\n    item.opacity = (item.opacity != null ? item.opacity : 100) / 100;\n    if(item.radius == null) {\n      item.radius = 2;\n    }\n    if(item.limits == null) {\n      item.limits = [0, 0, 0, 0, 0, 0];\n    }\n    for(var j = 0; j < 3; j++) {\n      if(item.limits[2 * j] >= item.limits[2 * j + 1]) {\n        item.limits[2 * j] = -Infinity;\n        item.limits[2 * j + 1] = Infinity;\n      }\n    }\n    if(item.pnoise == null) {\n      item.pnoise = 0;\n    }\n    if(item.pnoise_freq == null) {\n      item.pnoise_freq = 1;\n    }\n    if(item.pnoise_pers == null) {\n      item.pnoise_pers = 1;\n    }\n    if(item.pnoise_octave == null) {\n      item.pnoise_octave = 1;\n    }\n    item.transform = mat4.identity();\n    mat4.translate(item.transform, item.coords);\n    mat4.rotateX(item.transform, item.rot[0]);\n    mat4.rotateY(item.transform, item.rot[1]);\n    mat4.rotateZ(item.transform, item.rot[2]);\n    if(item.group_id) {\n      if(groups[item.group_id] == null) {\n        groups[item.group_id] = [];\n      }\n      groups[item.group_id].push(item);\n    }\n    if(item.portal_id != null) {\n      if (!(item.portal_id in portals)) {\n        portals[item.portal_id] = [];\n      }\n      portals[item.portal_id].push(item);\n    }\n  }\n  /* Portals */\n  for(var id in portals) {\n    portals[id][0].other = portals[id][1];\n    portals[id][1].other = portals[id][0];\n  }\n  /* Groups */\n  if(scene.group == null) {\n    scene.group = [];\n  }\n  for(var i = 0; i < scene.group.length; i++) {\n    var group = scene.group[i];\n    if(group.size_mul == null) {\n      group.size_mul = 1;\n    }\n    group.rot = vec3.scale(group.rot != null ? group.rot : [0, 0, 0], Math.PI / 180);\n    if(group.coords == null) {\n      group.coords = [0, 0, 0];\n    }\n    group.transform = mat4.identity();\n    mat4.scale(group.transform, [group.size_mul, group.size_mul, group.size_mul]);\n    mat4.translate(group.transform, group.coords);\n    mat4.rotateX(group.transform, group.rot[0]);\n    mat4.rotateY(group.transform, group.rot[1]);\n    mat4.rotateZ(group.transform, group.rot[2]);\n    if (!(group.id in groups)) {\n      continue;\n    }\n    for(var j = 0; j < groups[group.id].length; j++) {\n      var item_raw = groups[group.id][j];\n      var item = copy(item_raw);\n      delete item.group_id;\n      var t = mat4.create(group.transform);\n      mat4.multiply(t, item.transform);\n      item.transform = t;\n      scene.item.push(item);\n    }\n  }\n  scene.item = scene.item.filter(function(item) {\n    return item.group_id == null;\n  });\n\n  /* Textures */\n  for(var i = 0 ; i < scene.item.length; i++) {\n    var item = scene.item[i];\n    item.coords = mat4.multiplyVec3(item.transform, [0, 0, 0]);\n    item.inverse = mat4.inverse(item.transform, mat4.create());\n    item.radius2 = item.radius * item.radius;\n    if(item.tex != null) {\n      if(item.tex_rep == null) {\n        item.tex_rep = 0;\n      }\n      if(item.tex_coef == null) {\n        item.tex_coef = 1;\n      }\n    }\n  }\n\n  /* Render */\n  var result = []\n  for(var y = scene.job.begin_y; y < scene.job.end_y; y++) {\n    for(var x = scene.job.begin_x; x < scene.job.end_x; x++) {\n      var color = process(y, x, scene.global.upscale, scene.global.randomRays);\n      result.push(~~(color[0] * 255));\n      result.push(~~(color[1] * 255));\n      result.push(~~(color[2] * 255));\n    }\n  }\n  return result;\n}\n\n/* To run on crowdprocess */\nfunction Run(d) {\n  var scene = %%SCENE%%;\n  scene.job = d;\n  return {\n    id: d.id,\n    animation: d.animation,\n    data: render(scene, d.animation)\n  };    \n}".replace('%%SCENE%%', JSON.stringify(scene));
    
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
    function onData(result) {
        var unit = data[result.id];
        // var i = 0;
        // for(var y = unit.begin_y; y < unit.end_y; y++) {
        //     for(var x = unit.begin_x; x < unit.end_x; x++) {
        //       var z = (x * scene.global.width + y) * 3;
        //       rgb[z] = result.data[i++];
        //       rgb[z+1] = result.data[i++];
        //       rgb[z+2] = result.data[i++];
        //     }
        // }
        self.emit('data', {
            begin_x: unit.begin_x,
            end_x: unit.end_x,
            begin_y: unit.begin_y,
            end_y: unit.end_y,
            animation: result.animation,
            data: result.data
        });
    }
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
    this.run = function run() {
        self.emit('run', {
            width: scene.global.width,
            height: scene.global.height,
            splitsPerFrame: splitWidth * splitHeight
        });

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

},{"./crp-client.js":2,"./src/parser":4,"events":5}],4:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1

var __slice = [].slice;

Array.prototype.contains = function(x) {
  return (this.indexOf(x)) !== -1;
};

var Parser = (function() {
  Parser.prototype.objectify = function(pairs) {
    var hash, key, value, _i, _len, _ref;
    hash = {};
    for (_i = 0, _len = pairs.length; _i < _len; _i++) {
      _ref = pairs[_i], key = _ref[0], value = _ref[1];
      if (this.multiple.contains(key)) {
        if (!(key in hash)) {
          hash[key] = [];
        }
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
    if (!name) {
      return;
    }
    this.lines.shift();
    params = this.objectify((function() {
      var _i, _len, _ref, _ref1, _results;
      _results = [];
      while (line = this.lines.shift()) {
        if (line === '}') {
          break;
        }
        _ref = line.split(/\s+/), key = _ref[0], values = 2 <= _ref.length ? __slice.call(_ref, 1) : [];
        _ref1 = this.convert;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          convert = _ref1[_i];
          if (convert.fields.contains(key)) {
            values = convert.func(values);
          }
        }
        _results.push([key, values]);
      }
      return _results;
    }).call(this));
    return [name, params];
  };
  return Parser;
})();

module.exports.Parser = Parser;

},{}],5:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[1])