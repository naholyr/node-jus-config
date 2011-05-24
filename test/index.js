const config = require('..')
    , assert = require('assert')
    , async = require('async')

var tests = [], passedTests = 0



// Declare tests

// Enable parsers
add_test('enable parsers', function(callback) {
  config.parser.enable('js');
  config.parser.enable('yml');
  config.parser.enable('ini');
  callback();
}, [], function(err) {
  assert.ifError(err);
});

// No file found
add_test_load('no configuration file found', ['not_found.json'], function(err) {
  assert.ok(err instanceof Error);
  assert.ok(err.message.match(/No configuration file found/));
});

// Invalid parser
add_test_load('invalid file', ['invalid.txt'], function(err) {
  assert.ok(err instanceof Error);
  assert.ok(err.message.match(/Invalid file ".*?\/config\/invalid.txt": no parser found for extension "txt"/));
});

// Basic loading
add_test_load('simple load', ['format.yml'], function(err, config) {
  // config/format.yml → format = "yaml"
  assert.ifError(err);
  assert.equal(config.format, 'yaml');
});

// Basic overriding
add_test_load('simple override', [['format.yml', 'format.json']], function(err, config) {
  // config/format.yml → format = "yaml"
  // should be overriden by config/format.json → format = "json"
  assert.ifError(err);
  assert.equal(config.format, 'json');
});

// Load from multiple directories
add_test_load('load from multiple directories', ['value.json', ['config', 'config/override']], function(err, config) {
  // config/value.json → value = 1
  // should be overriden by config/override/value.json → value = 2
  assert.ifError(err);
  assert.equal(config.value, 2);
});

// Mix all
add_test_load('load and override from multiple directories with multiple formats', [['format.json', 'format.yml', 'format.ini', 'format.js'], ['config', 'config/override']], function(err, config) {
  assert.ifError(err);
  assert.deepEqual(config, {
    "format": "js",
    "json": true,
    "yml": true,
    "ini": "true",
    "js": true
  });
});

// Test implicit extensions
add_test_load('load with no extensions provided', ['format'], function(err, config) {
  assert.ifError(err);
  assert.deepEqual(config, {
    "format": "json", // The "json" has priority over "yml"
    "yml": true,
    "json": true,
  });
});

// Test implicit extensions, and overriding by folder
add_test_load('load with no extensions provided', ['format', ['config', 'config/override']], function(err, config) {
  assert.ifError(err);
  assert.deepEqual(config, {
    "format": "js", // The "json" has priority over "yml", but "config/override" overrides "config", and "js" has priority over "ini"
    "yml": true,
    "json": true,
    "ini": "true",
    "js": true,
  });
});



// Run tests

process_tests();



// Internals

// Add some test
function add_test(name, foo, args, asserts, env) {
  tests.push(function(callback) {
    args.push(function(err) {
      var success = false;
      try {
        asserts.apply(env, arguments);
        success = true;
      } catch (e) {
        console.error('Failed test "' + name + '": ' + (e.message || e));
      }
      callback(undefined, success);
    });
    foo.apply(env, args);
  });
}
function add_test_load(name, args, asserts) {
  add_test(name, config.load, args, asserts, config);
}

// Process tests
function process_tests() {
  process.chdir(__dirname);
  async.series(tests, function end_tests(err, results) {
    var passed = results.filter(function(v) { return v }).length;
    if (passed != tests.length) {
      console.error('Not all tests passed: ' + passed + '/' + tests.length + ' passed');
    } else {
      console.info('OK: ' + passed + '/' + tests.length + ' tests passed');
    }
  });
}
