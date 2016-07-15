var fs = require('fs');
var path = require('path');
var mv = require('mv');

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

    var current_app_dir = null;
    var check_for_installed_dir = function (version, done) {

        current_app_dir = path.resolve(root, "app-" + version);

        if (target != 'update.exe' && target != 'squirrel.exe') {

            console.log("not called as part of an update")

        }

        fs.stat(path.resolve(root, "app.ico"), function (err, res) {

            if (err) {

                console.log("app.ico not found, nothing to do");

                done();

            } else {

                console.log("app.ico found, looking for prior installs");

                check_for_prior_installs(done);

            }

        });

    };
    var check_for_prior_installs = function (done) {

        console.log("checking for prior install directories");
        fs.readdir(root, function (err, res) {

            if (err) {

                console.log("error looking for directories");

                console.log(err);

                done();

            } else {

                var prior_installs = [];

                res.forEach(function (path) {

                    if (path.match(/^app-/) && !path.match(/\./) && path != current_app_dir) {

                        console.log("found prior install, " + path);

                        prior_installs.push(path);

                    }

                });

                console.log("found " + prior_installs.length + " prior installs");

                handle_prior_installs(prior_installs, done);

            }

        });

    };
    var handle_prior_installs = function (prior_installs, done) {

        prior_installs.push(root);

        var data_directories = [];
        console.log("handling prior installs");
        var next_prior = function () {

            var dir = prior_installs.pop();

            if (!dir) {

                console.log("found " + data_directories.length + " data directories");

                clone_data_directories(data_directories, done);

            } else {

                var data_dir = path.resolve(root, dir, "data");

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
    var clone_data_directories = function (data_directories, done) {

        console.log("cloning data directories");
        var paths_to_assert = [];
        var next_dir = function () {

            var data_dir = data_directories.pop();

            if (!data_dir) {

                console.log("found " + paths_to_assert.length + " resource directories");

                move_language_directories(paths_to_assert, done);

            } else {

                console.log("checking " + data_dir + " for resources");

                fs.readdir(data_dir, function (err, res) {

                    if (err) {

                        console.log("error checking " + data_dir);

                        console.log(err);

                        next_dir();

                    } else {

                        // create duplicates of language directories in the current app folder

                        // and check for all voice and locale directories in each language directory

                        res.forEach(function (path) {

                            if (path && !path.match(/\./)) {

                                console.log("found language, " + path);

                                fs.mkdir(path.resolve(root, current_app_dir, 'data', path), function (err, res) {

                                    console.log("cloned language folder, looking for resources");

                                    if (err) { console.log(err); }

                                    fs.readdir(path.resolve(data_dir, path), function (err, res) {

                                        if (res) {

                                            res.forEach(function (sub_path) {

                                                if (sub_path && !sub_path.match(/\./)) {

                                                    console.log("found resource, " + sub_path);

                                                    paths_to_assert.push({

                                                        source_dir: data_dir,

                                                        language: path,

                                                        resource: sub_path

                                                    })

                                                }

                                            });

                                        }

                                        next_dir();

                                    });

                                });

                            }

                        });

                    }

                });

            }

        };

        next_dir();

    };
    var move_language_directories = function (paths_to_assert, done) {

        console.log("moving language directories");

        var next_path = function () {

            var path = paths_to_assert.pop();

            if (!path) {

                console.log("done!");

                done();

            } else {

                var dest = path.resolve(root, current_app_directory, 'data', path.language, path.resource);

                console.log("checking for existence of " + dest);

                fs.stat(dest, function (err, res) {

                    if (err) {

                        var prior = path.resolve(path.source_dir, path.language, path.resource);

                        console.log("moving " + prior + " to " + dest);

                        fs.rename(prior, dest, function (err) {

                            if (err) { console.log("error moving"); console.log(err); }

                            next_path();

                        });

                    } else {

                        console.log(dest + " already exists, skipping");

                        next_path();

                    }

                });

            }

        };

        next_path();

    };

    module.exports = {

        start: function (version, done) {

            check_for_installed_dir(version, done);
        },

        preserve: function (version, done) {

            var src_data_dir = path.resolve(root, "app-" + version, "data");

            var dest_data_dir = path.resolve(root, "data");

            mv(src_data_dir, dest_data_dir, { mkdirp: true }, done);
        }

    };



})();