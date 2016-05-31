var fs = require('fs')

fs.readFile('fred.html' , 'utf8', function (err,data) {
  var result = null;
  var replacement = null;

  if (process.env.npm_package_config_hostType === 'server') {
    replacement = 'var FRED_SERVER = true;';
    console.log('FRED host type is *server*');
  } else {
    replacement = 'var FRED_SERVER = false;';
    console.log('FRED host type is *client*');
  }

  result = data.replace(/var FRED_SERVER = [a-z]+;/g, replacement);
  fs.writeFile('fred.html', result, 'utf8', function (err) {
     if (err) return console.log(err);
  });

});
