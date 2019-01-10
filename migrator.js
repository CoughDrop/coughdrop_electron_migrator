var fs = require('fs');
var path = require('path');
var cp = require('child_process');

(function () {
  // everything should now go to the LOCALAPPDATA/coughdrop folder
  // since we figured out a way for acapela to load from there
  // look for "../app.ico"
  // if it exists, look for directories that start with "app-"
  // if they don't match the current app-* directory, look for a /data folder"
  // if it exists
  //  - duplicate any subdirectories
  //  - move any directories in those subdirectories into their duplicates

  console.log("cwd: " + process.cwd());
  console.log("execPath: " + process.execPath);
  var target = path.basename(process.execPath);
  var app_data = null;
  var acap_dir = null;
  if(process.env.LOCALAPPDATA) {
    app_data = path.resolve(process.env.LOCALAPPDATA || '', 'coughdrop');
    acap_dir = path.resolve(app_data, 'data');
  }
  var root = path.dirname(process.execPath);
  if (path.basename(root).match(/^app/)) {
    root = path.dirname(root);
  }
  if (!path.basename(root).match(/coughdrop/)) {
    root = process.cwd();
    if (path.basename(root).match(/^app/)) {
      root = path.dirname(root);
    }
  }
  if (!path.basename(root).match(/coughdrop/)) {
    console.log("bad path: " + root);
  }
  var temp = null;
  if(root) {
    var local = path.resolve(app_data, 'tmp');
    temp = local;
  }

  var current_app_dir = null;
  // check for or create the specified directory
  var assert_dir = function(dir_path, callback, depth) {
    depth = depth || 0;
    fs.stat(dir_path, function(err, stats) {
      if(err) {
        if(depth > 3) {
          callback({error: 'too many nonexistant directories'});
        } else {
          assert_dir(path.basename(dir_path), function() {
            fs.mkdir(dir_path, {recursive: true}, function(err, res) {
              callback(err, res);
            })
          }, depth + 1);
        }
      } else {
        if(stats && stats.isDirectory()) {
          callback();
        } else {
          callback({error: "not a directory"});
        }
      }
    })
  }
  
  // should be in an app directory
  var check_for_installed_dir = function (version, done) {
    current_app_dir = path.resolve(root, "app-" + version);
    if (target != 'update.exe' && target != 'squirrel.exe' && target != 'coughdrop.exe') {
      console.log("not called as part of an update")
    }
    if(!app_data) {
      console.log("LOCALAPPDATA not available, nothing to do");
      done();
    }
    // assert LOCALAPPDATA/coughdrop directory
    assert_dir(app_data, function(err) {
      if(err) { 
        console.log("error asserting LOCALAPPDATA"); console.log(err); 
      } else {
        // with an app.ico file, to double-check
        fs.stat(path.resolve(root, "app.ico"), function (err, res) {
          if (err) {
            console.log("app.ico not found, nothing to do");
            done();
          } else {
            // confirm that the app directory is a valid directory
            fs.stat(current_app_dir, function(err, res) {
              if(res && res.isDirectory()) {
                console.log("app directory found, looking for prior installs");
                check_for_prior_installs(done);
              } else {
                console.log("app directory not found, nothing to do");
                done();
              }
            });
          }
        });
      }
    });
  };
  
  // iterate through any prior installs
  var check_for_prior_installs = function (done) {
    console.log("checking for prior install directories");
    fs.readdir(root, function (err, res) {
      if (err) {
        console.log("error looking for directories");
        console.log(err);
        done();
      } else {
        var prior_installs = [];
        // add prior installs to a list
        res.forEach(function (app_dir) {
          if (app_dir.match(/^app-/) && path.resolve(root, app_dir) != current_app_dir) {
            console.log("found prior install, " + app_dir);
            prior_installs.push(path.resolve(root, app_dir));
          }
        });
        console.log("found " + prior_installs.length + " prior installs");
        handle_prior_installs(prior_installs, done);
      }
    });
  };
  
  var handle_prior_installs = function (prior_installs, done) {
    // also check the temp directory for any prior installs
    prior_installs.push(temp);
    var data_directories = [];
    console.log("handling prior installs");
    var next_prior = function () {
      var dir = prior_installs.pop();
      // once they're all done, proceed
      if (!dir) {
        console.log("found " + data_directories.length + " data directories");
        console.log("asserting data directory");
        // data directory must exist on destination
        assert_dir(acap_dir, function(err, res) {
        // fs.mkdir(path.resolve(root, current_app_dir, 'data'), function(err, res) {
          if(err) { console.log(err); }
          clone_data_directories(data_directories, done);
        });
      } else {
        // check that the entry has a data directory, add it to the list
        var data_dir = path.resolve(dir, 'data');
        fs.stat(data_dir, function (err, res) {
          if (res && res.isDirectory()) {
            console.log("found data directory, " + data_dir);
            data_directories.push(data_dir);
          }
          next_prior();
        });
      }
    };
    next_prior();
  };
  
  // iterate through prior data directories, looking for sub-folders
  var clone_data_directories = function (data_directories, done, clone_only) {
    console.log("cloning data directories");
    var paths_checked = [];
    var next_dir = function () {
      var data_dir = data_directories.pop();
      if (!data_dir) {
        console.log("found " + paths_checked.length + " resource directories");
        if(clone_only) {
          done();
        } else {
          clone_files(done);
        }
      } else {
        console.log("checking " + data_dir + " for resources");
        fs.readdir(data_dir, function (err, res) {
          if (err) {
            console.log("error checking " + data_dir);
            console.log(err);
            next_dir();
          } else {
            // xcopy src dest /e /y /i
            var dest = acap_dir;
            var child = cp.exec("xcopy /y /e /i \"" + data_dir + "\" \"" + dest + "\"", function(err) {
              if (err) { console.log("error moving speech from " + data_dir); console.log(err); }
              paths_checked.push(dest);
              next_dir();
            });
          }
        });
      }
    };
    next_dir();
  };

  var clone_files = function(done) {
    var dest_files_dir = path.resolve(app_data, 'files');
    var src_files_dir = path.resolve(root, 'files');
    var child = cp.exec("xcopy /y /e /i \"" + src_files_dir + "\" \"" + dest_files_dir + "\"", function(err) {
      if(err) { console.log("error moving files from " + src_files_dir); }
      done();
    })
  };


  module.exports = {
    start: function (version, done) {
      check_for_installed_dir(version, done);
    },
    preserve: function (version, done) {
      if(root && temp) {
        var src_data_dir = path.resolve(root, "app-" + version, 'data');
        var dest_data_dir = path.resolve(app_data, "tmp");
        console.log("moving " + src_data_dir + " to " + dest_data_dir);
        assert_dir(dest_data_dir, function(err, res) {
          if(err) { 
            console.log(err); 
          // } else {
          //   // xcopy src dest /e /y /i
          //   var child = cp.exec("xcopy /y /e /i \"" + src_data_dir + "\" \"" + dest_data_dir + "\"", function(err) {
          //     if (err) { console.log("error moving"); console.log(err); }
          //     done();
          //   });
          }
          clone_data_directories([dest_data_dir], done, true);
        });
      } else {
        console.log("root: " + root);
        console.log("temp: " + temp);
        console.log("couldn't find a needed folder");
      }
    }
  };
})();
