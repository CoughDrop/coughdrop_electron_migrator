var fs = require('fs');
var path = require('path');
var cp = require('child_process');

(function () {
  // look for "../app.ico"
  // if it exists, look for directories that start with "app-"
  // if they don't match the current app-* directory, look for a /data folder"
  // if it exists
  //  - duplicate any subdirectories
  //  - move any directories in those subdirectories into their duplicates

  console.log("cwd: " + process.cwd());
  console.log("execPath: " + process.execPath);
  var target = path.basename(process.execPath);
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
    var local = path.resolve(root, '..', 'Temp', 'coughdrop');
    if(local.match(/Local/)) {
      temp = local;
    }
  }

  var current_app_dir = null;
  
  // should be in an app directory
  var check_for_installed_dir = function (version, done) {
    current_app_dir = path.resolve(root, "app-" + version);
    if (target != 'update.exe' && target != 'squirrel.exe' && target != 'coughdrop.exe') {
      console.log("not called as part of an update")
    }
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
        fs.mkdir(path.resolve(root, current_app_dir, 'data'), function(err, res) {
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
  var clone_data_directories = function (data_directories, done) {
    console.log("cloning data directories");
    var paths_to_assert = [];
    var next_dir = function () {
      var data_dir = data_directories.pop();
      if (!data_dir) {
        console.log("found " + paths_to_assert.length + " resource directories");
        done();
//         check_resource_directories(paths_to_assert, done);
      } else {
        console.log("checking " + data_dir + " for resources");
        fs.readdir(data_dir, function (err, res) {
          if (err) {
            console.log("error checking " + data_dir);
            console.log(err);
            next_dir();
          } else {
            // xcopy src dest /e /y /i
            var dest = path.resolve(root, current_app_dir, 'data');
            var child = cp.exec("xcopy /y /e /i \"" + data_dir + "\" \"" + dest + "\"", function(err) {
              if (err) { console.log("error moving"); console.log(err); }
              next_dir();
            });
            
            // create duplicates of language directories in the current app folder
            // and check for all voice and locale directories in each language directory
//             res.forEach(function (language) {
//               fs.stat(path.resolve(data_dir, language), function(err, res) {
//                 if(err) { console.log(err); }
//                 if (language && res && res.isDirectory()) {
//                   console.log("found language, " + language);
//                   fs.mkdir(path.resolve(root, current_app_dir, 'data', language), function (err, res) {
//                     console.log("cloned language folder, looking for resources");
//                     if (err) { console.log(err); }
//                     fs.readdir(path.resolve(data_dir, language), function (err, res) {
//                       if (res) {
//                         res.forEach(function (resource) {
//                           console.log("found possible resource, " + resource);
//                           paths_to_assert.push({
//                             source_dir: data_dir,
//                             language: language,
//                             resource: resource
//                           });
//                         });
//                       }
//                       next_dir();
//                     });
//                   });
//                 }
//               });
//             });
          }
        });
      }
    };
    next_dir();
  };
  
  // all the locale and voice directories should be valid, if they are queue them for moving
//   var check_resource_directories = function(paths_to_assert, done) {
//     var valid_paths_to_assert = [];
//     var next_path = function() {
//       var ref = paths_to_assert.pop();
//       if(!ref) {
//         console.log("found " + valid_paths_to_assert.length + " valid resources");
//         move_language_directories(valid_paths_to_assert, done);
//       } else {
//         var full_path = path.resolve(ref.source_dir, ref.language, ref.resource);
//         console.log("checking " + full_path);
//         
//         fs.stat(full_path, function(err, res) {
//           if(err) { console.log(err); }
//           if(res && res.isDirectory()) {
//             valid_paths_to_assert.push(ref);
//           }
//           next_path();
//         });
//       }
//     };
//     next_path();
//   };
  
  // move all locale and voice directories to the new app path unless they already exist
//   var move_language_directories = function (paths_to_assert, done) {
//     console.log("moving language directories");
//     var next_path = function () {
//       var ref = paths_to_assert.pop();
//       if (!ref) {
//         console.log("done!");
//         done();
//       } else {
//         var dest = path.resolve(root, current_app_dir, 'data', ref.language, ref.resource);
//         console.log("checking for existence of " + dest);
//         fs.stat(dest, function (err, res) {
//           if (err) {
//             var prior = path.resolve(ref.source_dir, ref.language, ref.resource);
//             console.log("copying " + prior + " to " + dest);
//             // xcopy src dest /e /y /i
//             var child = cp.exec("xcopy /y /e /i \"" + prior + "\" \"" + dest + "\"", function(err) {
//               if (err) { console.log("error moving"); console.log(err); }
//               next_path();
//             });
//           } else {
//             console.log(dest + " already exists, skipping");
//             next_path();
//           }
//         });
//       }
//     };
//     next_path();
//   };

  module.exports = {
    start: function (version, done) {
      check_for_installed_dir(version, done);
    },
    preserve: function (version, done) {
      if(root && temp) {
        var src_data_dir = path.resolve(root, "app-" + version, "data");
        var dest_data_dir = path.resolve(temp, "data");
        console.log("moving " + src_data_dir + " to " + dest_data_dir);
        fs.mkdir(dest_data_dir), function(err, res) {
          if(err) { 
            console.log(err); 
          } else {
            // xcopy src dest /e /y /i
            var child = cp.exec("xcopy /y /e /i \"" + src_data_dir + "\" \"" + dest_data_dir + "\"", function(err) {
              if (err) { console.log("error moving"); console.log(err); }
              done();
            });
          }
          clone_data_directories(data_directories, done);
        });
      } else {
        console.log("root: " + root);
        console.log("temp: " + temp);
        console.log("couldn't find a needed folder");
      }
    }
  };
})();
