// localized config
var basePath  = '',
	overrides = {
/*
		browsersync: {
			proxy: 'example.dev',
		},
*/
	};
	

// includes
var gulp         = require('gulp'),

	// build
	fs           = require('fs'),
	merge        = require('merge'),

	// utility
	gutil        = require('gulp-util'),
	argv         = require('yargs').argv,

	// watching
	browserSync  = require('browser-sync'),

	// js
	concat       = require('gulp-concat'),
	rename       = require('gulp-rename');


// config
var config = merge.recursive({
	autoprefixer: 'last 2 versions',
	htmlhint: {
		"doctype-first": false,
		"spec-char-escape": false,
		"attr-lowercase": false,
		"tagname-lowercase": false,
		"img-alt-require": true,
		"attr-unsafe-chars": true,
		"space-tab-mixed-disabled": true,
	},
	iconfont: {
		lessPath: basePath + 'assets/styles',
		lessFile: 'icons.inc.less',
		className: 'icon',
		fontName: 'icons',
		fixedWidth: true,
		formats: ['ttf', 'eot', 'woff', 'woff2', 'svg'],
		centerHorizontally: true,
		normalize: true,
	},
	browsersync: {
		ui: false,
		watchOptions: {debounce: 400},
		reloadDebounce: 400,
		notify: false,
		server: {
			baseDir: './' + basePath,
			middleware: [ require('connect-history-api-fallback')() ],
		},
	},
	concat: {
		js: 'base',
	},
	globs: {
		excludes: [
			'!node_modules/**/*',
			'!vendor/**/*',
			'!wp/**/*',
		],
		html: [
			basePath + '**/*.{html,htm,php}',
		],
		js: [
			basePath + 'assets/scripts/*/**/*.js', // subfolders first
			basePath + 'assets/scripts/**/*.js',
		],
		less: [
			basePath + 'assets/styles/**/*.less',
			// note that files ending in ".inc.less" will not be compiled (but they will be watched)
		],
		files: [
			basePath + '**/*.{htaccess,jpg,jpeg,gif,png,svg}',
		],
		icons: [
			basePath + 'assets/img/icon/*.svg',
		],
	},
	dests: {
		scripts:   basePath + 'assets/js',
		styles:    basePath + 'assets/css',
		icons:     basePath + 'assets/fonts',
	},
}, overrides);


// tasks
gulp
	// build
	.task('html', function () {
		return gulp.src(config.globs.excludes.concat(config.globs.html))
			.pipe(browserSync.reload({stream: true}));
	})
	.task('rev', function () {
		return gulp.src(config.globs.excludes.concat(config.globs.html))
			.pipe(require('gulp-rev-append')())
			.pipe(gulp.dest(basePath || '.'));
	})
	.task('js', function () {
		return gulp.src(config.globs.excludes.concat(config.globs.js))
			.pipe(require('gulp-jsvalidate')(config.jsValidate)).on('error', handleError)
			.pipe(require('gulp-babel')(config.babel)).on('error', handleError)
			.pipe(require('gulp-ng-annotate')(config.ngAnnotate)).on('error', handleError)
			.pipe(concat(config.concat.js + '.js'))
			.pipe(gulp.dest(config.dests.scripts))
			
			.pipe(rename({suffix: '.min'}))
			.pipe(require('gulp-uglify')(config.uglify)).on('error', handleError)
			.pipe(gulp.dest(config.dests.scripts))
			
			.pipe(browserSync.reload({stream: true}));
	})
	.task('less', function () {
		return gulp.src(config.globs.excludes.concat(config.globs.less).concat('!**/*.inc.less')) // don't output .inc.less files as they are never accessed directly
			.pipe(require('gulp-less')(config.less)).on('error', handleError)
			.pipe(require('gulp-autoprefixer')(config.autoprefixer))
			.pipe(gulp.dest(config.dests.styles))
			
			.pipe(rename({suffix: '.min'}))
			.pipe(require('gulp-minify-css')(config.minifyCss))
			.pipe(gulp.dest(config.dests.styles))
			
			.pipe(browserSync.reload({stream: true}));
	})
	.task('icons', function () {
		return gulp.src(config.globs.excludes.concat(config.globs.icons))
			.pipe(require('gulp-iconfont')(config.iconfont))
				.on('glyphs', function (glyphs, options) {
					var replace   = '/* @GENERATED: */',
						generated = replace + '\n';
					
					glyphs.map(function (glyph) {
						generated += '.' + options.className + '.' + options.className + '-' + glyph.name + ':before { content: "\\' + glyph.unicode[0].charCodeAt(0).toString(16).toUpperCase() + '"; }\n';
					});
					
					gulp.src(config.iconfont.lessPath + '/' + config.iconfont.lessFile)
						.pipe(require('gulp-replace')(new RegExp(replace.replace(/([\/\*])/g, '\\$1') + '[^]*$'), generated))
						.pipe(gulp.dest(config.iconfont.lessPath))
						
						.pipe(browserSync.reload({stream: true}));
				})
			.pipe(gulp.dest(config.dests.icons))
			
			.pipe(browserSync.reload({stream: true}));
		
	})
	.task('build', ['html','rev','js','less','icons'])
	
	// lint
	.task('html.lint', function () {
		return gulp.src(config.globs.excludes.concat(config.globs.html))
			.pipe(require('gulp-htmlhint')(config.htmlhint))
			.pipe(htmlhint.reporter());
	})
	.task('lint', ['html.lint'])
	
	// watch
	.task('html.watch', function () {
		return gulp.watch(config.globs.excludes.concat(config.globs.html), ['html']);
	})
	.task('js.watch', function () {
		return gulp.watch(config.globs.excludes.concat(config.globs.js), ['js']);
	})
	.task('less.watch', function () {
		return gulp.watch(config.globs.excludes.concat(config.globs.less), ['less']);
	})
	.task('icons.watch', function () {
		return gulp.watch(config.globs.excludes.concat(config.globs.icons), ['icons']);
	})
	.task('watch', ['html.watch','js.watch','less.watch','icons.watch'], function () {
		var options = merge.recursive(config.browsersync || {}, {
			files:     config.globs.excludes.concat(config.globs.files),
			ghostMode: !! (argv.g || gutil.env.ghost), // call `gulp -g` or `gulp --ghost` to start in ghostMode
			open:      ! (argv.s || gutil.env.silent), // call `gulp -s` or `gulp --silent` to start gulp without opening a new browser window
		});
		if (options.proxy) delete options.server; // prefer proxy to server
		browserSync.init(options);
	})
	
	
	// default
	.task('default', ['watch']);


// error handling
var handleError = function(error, type){
	//console.log(error);
	
	// remove any leading error marker
	error.message = error.message.replace(/^error:\s*/i, '');
	
	// shorten fileName
	var fileName = error.fileName ? error.fileName.replace(__dirname, '') : '';
	
	// show an OS-level notification to make sure we catch our attention
	// (do this before we format things since it can't handle the formatting)
	require('node-notifier').notify({
		title: 'ERROR(' + error.plugin + ')',
		subtitle: fileName,
		message: error.message,
		sound: 'Basso',
		activate: 'com.apple.Terminal',
	});
	
	// colour the problematic line for higher visibility
	if(error.extract){
		var middleIndex = Math.floor(error.extract.length / 2);
		error.extract[middleIndex] = gutil.colors.red(error.extract[middleIndex]);
	}
	// append highlighted fileName to message, if not already there
	if(fileName){
		if(error.message.indexOf(error.fileName) >= 0){
			error.message = error.message.replace(error.fileName, gutil.colors.magenta(fileName));
		}else{
			error.message += ' in ' + gutil.colors.magenta(fileName);
		}
	}
	// process line numbers
	var line = error.lineNumber || error.line;
	
	// output the formatted error
	gutil.log(
		// error and plugin
		gutil.colors.red('ERROR(' + error.plugin + '): ') +
		
		// message
		error.message +
		
		// offending line number and column
		(line ? ' [' + gutil.colors.cyan(line) + ':' + gutil.colors.cyan(error.column) + ']' : '') +
		
		// preview the offending code
		(error.extract ? '\n\n\t' + error.extract.join('\n\t') : '') +
		
		// finish with a new line
		'\n'
	);
	
	// prevent this error from breaking/stopping watchers
	this.emit('end');
};