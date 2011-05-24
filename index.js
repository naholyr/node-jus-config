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
var enabledParsers = [];
var debug = false;


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

function registerParser(extension, parser, enable) {
  if (typeof parser != 'function') {
    throw new Error('Invalid type for parser: function expected');
  }
  if (extension instanceof Array) {
    for (var i=0; i<extension.length; i++) registerParser(extension[i], parser, enable);
  } else {
    parsers[extension.toLowerCase()] = parser;
    if (enable) enableParser(extension);
  }
}

function enableParser(extension) {
  if (isParserEnabled(extension)) {
    if (debug) util.debug('Parser for "' + extension + '" is already enabled');
    return false;
  }
  if (isParserRegistered(extension)) {
    enabledParsers.push(extension.toLowerCase());
    return true;
  } else {
    throw new Error('No registered parser for "' + extension + '"');
  }
}

function disableParser(extension) {
  if (!isParserEnabled(extension)) {
    if (debug) util.debug('Parser for "' + extension + '" is already disabled');
    return false;
  }
  if (isParserRegistered(extension)) {
    enabledParsers.splice(enabledParsers.indexOf(extension.toLowerCase()), 1);
    return true;
  } else {
    throw new Error('No registered parser for "' + extension + '"');
  }
}

function isParserEnabled(extension) {
  return enabledParsers.indexOf(extension.toLowerCase()) != -1;
}

function isParserRegistered(extension) {
  return typeof parsers[extension.toLowerCase()] == 'function';
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

function parseFile(file, callback) {
  var ext = path.extname(file);
  if (ext.charAt(0) == '') {
    return callback(new Error('Invalid file "' + file + '": extension required'));
  }
  ext = ext.substring(1);
  if (!isParserEnabled(ext)) {
    return callback(new Error('Invalid file "' + file + '": no parser found for extension "' + ext + '"'));
  }
  fs.readFile(file, function(err, content) {
    if (err) {
      return callback(err);
    }
    parseString(content.toString(), ext, callback);
  });
}

function parseString(string, extension, callback) {
  if (!isParserEnabled(extension)) {
    return callback(new Error('No enabled parser for "' + extension + '"'));
  }
  parsers[extension.toLowerCase()](string, callback);
}

function loadFile(file, config, callback) {
  if (debug) util.debug('Loading configuration file: ' + file);
  parseFile(file, function(err, conf) {
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
}

function loadFiles(files, callback) {
  if (debug) util.debug('Loading configuration files: ' + files.join(', '));
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
  function addFile(file) {
    if (path.extname(file) == '') {
      if (debug) util.debug('No extension for ' + file + ', try all enabled parsers (first enabled = highest priority)');
      var guessedFiles = [];
      enabledParsers.forEach(function(knownExtension) {
        guessedFiles.unshift(file + '.' + knownExtension);
      });
      guessedFiles.forEach(function(f) {
        addFile(f);
      });
    } else {
      allFiles.push(file);
    }
  }
  files.forEach(function(file) {
    if (file.charAt(0) == '/' || file.charAt(0) == '\\') {
      // Absolute path: use it as-is
      addFile(file);
    } else {
      dirs.forEach(function(dir) {
        addFile(path.join(dir, file));
      });
    }
  });

  // Exclude unexisting files
  if (debug) util.debug('Check configuration files: ' + allFiles.join(', '));
  async.filter(allFiles, function(file, callback) {
    path.exists(file, function(exists) {
      if (!exists && debug) util.debug('File not found: ' + file);
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

registerParser('ini',           createParser(ini.parseString));
registerParser(['yml', 'yaml'], createParser(yaml.eval));
registerParser('json',          createParser(JSON.parse));
registerParser('js',            createParser(function(s) { return vm.runInThisContext('('+s+')') }));

enableParser('json'); // This one will always be the first loaded, and therefore the highest priority format


// Exposed API

merge(exports, {
  "parser": {
    "register":    registerParser,
    "registered":  isParserRegistered,
    "enable":      enableParser,
    "disable":     disableParser,
    "enabled":     isParserEnabled,
    "create":      createParser,
    "parseFile":   parseFile,
    "parseString": parseString
  },
  "load": loadFilesFromDirs,
  "debug": function(enabled) { debug = enabled }
});


// Test
if (module === require.main) {
  require('./test')
}
