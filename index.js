const inquirer = require('inquirer');
const fs = require('fs');
const process = require('process');
const async = require('async');
const exec = require('child_process').exec;

function createPackageDotJSON(name) {
  return {
    "name": name,
    "version": "1.0.0",
    "description": "Your new three.js app",
    "main": "index.js",
    "scripts": {
      "start": "npx webpack-dev-server --hot"
    },
    "author": "",
    "license": "ISC"
  };
}

function moduleInstallerCallback(module, dev, verbose=false) {
  return done => {
    console.log(`Installing ${module}`);
    exec(`npm install --save${dev ? '-dev' : ''} ${module}`, (err, stdout, stderr) => {
      if (verbose) {
        console.log(stdout);
        if (stderr) console.log(stderr);
      }
      done(err);
    });
  }
}

function copyFile(src, dest) {
  return new Promise((resolve, reject) => {
    fs.copyFile(src, dest, err => {
      if (err) reject(err);
      resolve();
    })
  })
}

function moduleInstallers(modules, verbose=false) {
  return modules.map(({name, dev}) => moduleInstallerCallback(name, dev, verbose));
}

async function copyTemplates(target, isTypescript) {
  // copy templates over
  await copyFile(__dirname + '/templates/index.html', 'index.html');
  console.log(`Copied index.html to ${target}`);
  if (isTypescript) {
    await copyFile(__dirname + '/templates/index.js', 'src/index.ts');
    console.log(`Copied index.ts to ${target}/src`);
    await copyFile(__dirname + '/templates/webpack.config.ts.js', 'webpack.config.js');
    console.log(`Copied webpack.config.js to ${target}/src`);
    await copyFile(__dirname + '/templates/tsconfig.json', 'tsconfig.json');
    console.log(`Copied tsconfig.json to ${target}`);
  } else {
    await copyFile(__dirname + '/templates/index.js', 'src/index.js');
    console.log(`Copied index.js to ${target}/src`);
    await copyFile(__dirname + '/templates/webpack.config.js', 'webpack.config.js');
    console.log(`Copied webpack.config.js to ${target}/src`);
  }
}

inquirer.prompt([
  {
    name: "title",
    message: "What do you want to call the project?",
    validate: input => {
      let stats;

      try {
        stats = fs.statSync(process.cwd() + '/' + input);
      } catch (e) {
      }

      if (stats) {
        return "Directory or file already exists";
      } else if (input.length === 0) {
        return "Please enter a name for the project";
      } else {
        return true;
      }
    }
  },
  {
    type: "list",
    choices: ["Yes", "No"],
    name: "typescript",
    message: "Do you want to use typescript?"
  }
]).then(answers => {
  const target = answers.title;
  const verbose = process.argv.includes("-v");

  fs.mkdir(target, {recursive: false}, (err) => {
    if (err) throw err;

    console.log("Created project directory");

    process.chdir(target);

    // create the package.json
    let packageJson = JSON.stringify(createPackageDotJSON(target), null, 2);

    fs.writeFile("package.json", packageJson, err => {
      if (err) throw err;

      console.log("Created package.json");

      let modules = [
        {name: 'three', dev: false},
        {name: 'webpack', dev: true},
        {name: 'webpack-cli', dev: true},
        {name: 'webpack-dev-server', dev: true}
      ];

      if (answers.typescript === "Yes") {
        modules.push({name: 'ts-loader', dev: true}, {name: 'typescript', dev: true});
      }

      const callbacks = moduleInstallers(modules, verbose);

      // install modules
      async.series(callbacks, err => {
        if (err) throw err;

        const moduleNames = modules.map(({name}) => name).join(', ');

        console.log(`Installed ${moduleNames}`);

        // setup directories
        fs.mkdirSync('src');
        console.log(`Created ${target}/src`);
        fs.mkdirSync('dist');
        console.log(`Created ${target}/dist`);

        copyTemplates(target, answers.typescript === "Yes").then(() => {
          console.log("Finished!");
          console.log("To start use `npm run start`");
        }).catch(console.log);
      });
    });
  });
});