var ncsa = require('ncsa');

function config() {
  return {
    optional_params: [
      'ncsa_enabled',
      'ncsa_host',
      'ncsa_port',
      'ncsa_password',
      'ncsa_encryption'
    ],
    default_values: {
      'ncsa_enabled': true,
      'ncsa_password': false,
      'ncsa_encryption': false
    },
    start_hook: function(callback) {
      if (this.ncsa_enabled) {
       if (this.ncsa_host && this.ncsa_port) {
	     // USAGE: nagios.send("localhost", "paStash check", nsca.OK, "Al Dente!");
	     this.nagios = new nsca.Notifier(this.ncsa_host,this.ncsa_port,
						this.ncsa_password ? this.ncsa_password : false,
						this.ncsa_encryption ? this.ncsa_encryption : false
			   );
       }
      }
      if (this.nagios) callback();
      else { console.log('Failed to initialize NCSA Notifier!'); return; }
    },
  };
}

exports.config = config;
