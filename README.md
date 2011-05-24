# jus-config

Jus-Config is a Node.JS module that will help you manager your configuration files, supporting 
multiple formats, and ability to load and merge multiple files over multiple directories.

## Quick example

Suppose you want to make your app's port configurable. You'll have these two configuration files:

```javascript
// "config/default.json"
// This is the default options
{ "host": "localhost"
, "port": 3000 }

// "config/prod.json"
// This is, for example, your unversionned env-specific configuration
{ "port": 80 }
```

Then you can load your configuration files this way:

```javascript
var conf = require('jus-config')
  , express = require('express')
  , app = express.createServer()

// Load configuration from "config/default.json" and/or "config/prod.json"
conf.load(['default', 'prod'], function(err, config) {
  // config = { "host": "localhost", "port": 80 }
  app.listen(config.port, config.host)
})
```

## Download and install

### From npm

```
npm install jus-config
```

or add "jus-config" as a dependency in your package.json and call `npm install`.

### From git

`git clone` the repository `git@github.com:naholyr/node-jus-config.git` in `node_modules/jus-config`.
You're ready to go.

## Documentation

### Loading configuration

* [load](#load) - load configuration

### Configure parsers

* [parser.register](#parser_register) - register parser for a new extension
* [parser.registered](#parser_registered) - check if a parser is registered for given extension
* [parser.enable](#parser_enable) - enable a registered parser
* [parser.disable](#parser_disable) - disable an enabled parser
* [parser.enabled](#parser_enabled) - check if a parser is registered and enabled for given extension
* [parser.parseFile](#parser_parseFile) - parse a file
* [parser.parseString(#parser_parseString) - parse a string

### Debug mode

* [debug](#debug) - enables/disables debug
