module.exports = function plugin() {

  this.multiply = function(a,b,data) {
    // Everything is an Array
    if(!Array.isArray(data)) { data = [data]; }
    for (var set of data) {
      if(set[a]) set[a] = set[a] * b
    }
    // Apply Data
    this.data(data);
    // Return Chain
    return this;
  }

  this.divide = function(a,b,data) {
    // Everything is an Array
    if(!Array.isArray(data)) { data = [data]; }
    for (var set of data) {
      if(set[a]) set[a] = set[a] / b
    }
    // Apply Data
    this.data(data);
    // Return Chain
    return this;
  }

}


