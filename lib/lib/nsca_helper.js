var nsca = require('nsca');

function config() {
  return {
    optional_params: [
      'nsca_enabled',
      'nsca_host',
      'nsca_port',
      'nsca_password',
      'nsca_encryption'
    ],
    default_values: {
      'nsca_enabled': true,
      'nsca_password': false,
      'nsca_encryption': false
    },
    start_hook: function(callback) {
      if (this.nsca_enabled) {
       if (this.nsca_host && this.nsca_port) {
	     // USAGE: nagios.send("localhost", "paStash check", nsca.OK, "Al Dente!");
	     try {
		     this.nagios = new nsca.Notifier(this.nsca_host,this.nsca_port,
						this.nsca_password ? this.nsca_password : false,
						this.nsca_encryption ? this.nsca_encryption : false
		     );
	    } catch(e) { console.log('Failed to Initialize NSCA Notifier!',e); }
       }
      }
      if (this.nagios) callback();
      else { console.log('Failed to initialize NSCA Notifier!'); return; }
    },
  };
}

exports.config = config;
