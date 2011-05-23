// Dependencies

const path = require('path')
    , fs = require('fs')
    , yaml = require('yaml')
    , ini = require('iniparser')
    , vm = require('vm')
    , util = require('util')
    , async = require('async');


// Internal variables

var parsers = {};


// Internal API

function createParser(parse) {
  return function(content, callback) {
    var o, err;
    try {
      o = parse(content);
    } catch (e) {
      err = e;
    }
    callback(err, o);
  };
}

function registerParser(extension, parser) {
  if (typeof parser != 'function') {
    throw new Error('Invalid type for parser: function expected');
  }
  if (extension instanceof Array) {
    for (var i=0; i<extension.length; i++) registerParser(extension[i], parser);
  } else {
    parsers[extension.toLowerCase()] = parser;
  }
}

function isObject(o) {
  return typeof o == 'object' && o.constructor === Object;
}

function merge(to, from, recursive) {
  if (typeof recursive == 'undefined') recursive = true;
  for (var key in from) {
    if (recursive && isObject(from[key]) && isObject(to[key])) {
      merge(to[key], from[key], true);
    } else {
      to[key] = from[key]
    }
  }
}

function loadFile(file, config, callback) {
  if (exports.debug) util.debug('Loading configuration file: ' + file);
  var ext = path.extname(file);
  if (ext.charAt(0) != '.') {
    return callback(new Error('Invalid file "' + file + '": extension required'));
  }
  var parse = parsers[ext.toLowerCase().substring(1)];
  if (typeof parse != 'function') {
    return callback(new Error('Invalid file "' + file + '": no parser found for extension "' + ext + '"'));
  }
  fs.readFile(file, function(err, content) {
    if (err) {
      return callback(err);
    }
    parse(content.toString(), function(err, conf) {
      if (!err) {
        try {
          merge(config, conf, true);
        } catch (e) {
          err = e;
        }
      }
      if (err instanceof Error) err.message = err.message + ' in "' + file + '"';
      callback(err);
    });
  });
}

function loadFiles(files, callback) {
  if (exports.debug) util.debug('Loading configuration files: ' + files.join(', '));
  function load(i, config) {
    if (i < files.length) {
      var file = files[i];
      loadFile(file, config, function(err) {
        if (err) { // Error: end here
          callback(err, config);
        } else { // Load next file
          load(i+1, config);
        }
      });
    } else {
      // No more files: success
      callback(undefined, config);
    }
  }
  // Load files, starting with first one (last one = highest priority)
  load(0, {});
}

function loadFilesFromDirs(files, dirs, callback) {
  // Usage: …(files, callback [, dirs])
  if (typeof dirs == 'function') {
    return loadFilesFromDirs(files, callback, dirs);
  }
  // Usage: …(files, [dirs], callback)
  if (typeof dirs == 'undefined') {
    dirs = [path.join(process.cwd(), 'config')];
  }
  // Usage: …(files, dir, callback)
  if (typeof dirs == 'string') {
    dirs = [dirs];
  }
  // Usage: …(file, ...)
  if (typeof files == 'string') {
    files = [files];
  }

  // All files to be checked
  var allFiles = [];
  files.forEach(function(file) {
    if (file.charAt(0) == '/' || file.charAt(0) == '\\') {
      // Absolute path: use it as-is
      allFiles.push(file);
    } else {
      dirs.forEach(function(dir) {
        allFiles.push(path.join(dir, file));
      });
    }
  });

  // Exclude unexisting files
  if (exports.debug) util.debug('Check configuration files: ' + allFiles.join(', '));
  async.filter(allFiles, function(file, callback) {
    path.exists(file, function(exists) {
      if (!exists && exports.debug) util.debug('File not found: ' + file);
      callback(exists);
    });
  }, function(files) {
    if (files.length == 0) {
      callback(new Error('No configuration file found'));
    } else {
      loadFiles(files, callback);
    }
  });
}


// Initialize parsers

registerParser('json',          createParser(JSON.parse));
registerParser(['yml', 'yaml'], createParser(yaml.eval));
registerParser('ini',           createParser(ini.parseString));
registerParser('js',            createParser(function(s) { return vm.runInThisContext('('+s+')') }));


// Exposed API

merge(exports, {
  "parser": {
    "register": registerParser,
    "create":   createParser
  },
  "load": loadFilesFromDirs,
  "debug": false
});


// Test
if (module === require.main) {
  require('./test')
}
