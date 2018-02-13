fs = require('fs');
var bayes = require('bayes');
var classifier = bayes();

function config() {
  return {
    optional_params: [
      'shared',
      'file'
    ],
    default_values: {
      'shared': true,
      'file': '/tmp/pastash_bayes.json'
    },
    start_hook: function(callback) {
      if(this.shared) {
	this.classifier = classifier;
      } else {
	this.classifier = bayes();
      }
      // Load/Save Functions on demand
      this.classifier_load = function(filename) { this.classifier.fromJson( JSON.parse(fs.readFileSync(filename||this.file, 'utf8')) ); };
      this.classifier_save = function(filename) { fs.writeFile( filename||this.file, this.classifier.toJson(), 'utf8'); };
      callback();
    },
  };
}

exports.config = config;
