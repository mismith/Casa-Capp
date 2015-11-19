angular.module('casa-capp', ['ui.router', 'ngMaterial', 'firebaseHelper'])
	
	.config(function ($locationProvider, $urlRouterProvider, $stateProvider, $firebaseHelperProvider) {
		// routing
		$locationProvider.html5Mode(true);
		$urlRouterProvider.when('', '/');
		$stateProvider
			// pages
			.state('home', {
				url: '/',
				templateUrl: 'views/page/home.html?rev=1',
				controller: 'HomeCtrl',
			})
			.state('admin', {
				url: '/admin',
				templateUrl: 'views/page/admin.html',
				controller: 'AdminCtrl',
			});
		
		// data
		$firebaseHelperProvider.namespace('mismith');
		$firebaseHelperProvider.root('casa-capp');
	})
	
	.controller('AppCtrl', function ($rootScope, $state, $firebaseHelper, $location) {
		$rootScope.loaded          = true;
		$rootScope.$state          = $state;
		$rootScope.$firebaseHelper = $firebaseHelper;
		
		$rootScope.permission = function () {
			return !! $location.search().permission; //!! $rootScope.$me.$id;
		};
	})
	.controller('HomeCtrl', function ($scope, $state, $firebaseHelper, $mdDialog, $mdDialogForm, $q) {
		$scope.$teams  = $firebaseHelper.array('teams');
		$scope.$games  = $firebaseHelper.array('games');
		$scope.$scores = $firebaseHelper.array('scores');
		$scope.alert   = function (text) {
			alert(text);
		};
		
		$scope.getScores = function (team, game) {
			if ( ! team) return [];
			
			return $scope.$scores.filter(function (s) {
				return (s.homeTeam === team.$id || s.awayTeam === team.$id) && ((game && s.game === game.$id) || ! game) ;
			});
		};
		$scope.getPoints = function (team, game, score) {
			if (game !== undefined) {
				if (score !== undefined) {
					var diff     = (score.homeTeam === team.$id ? 1 : -1) * (score.home - score.away),
						points   = Math.max(0, diff),
						weighted = points / game.win * 10;
					
					return weighted;
				} else {
					var total = 0;
					angular.forEach($scope.getScores(team, game), function (s) {
						total += $scope.getPoints(team, game, s);
					});
					return total;
				}
			} else {
				var total = 0;
				angular.forEach($scope.getScores(team), function (s) {
					total += $scope.getPoints(team, $scope.$games.$getRecord(s.game), s);
				});
				return total;
			}
		};
		$scope.getSpread = function (team, game, score) {
			if ( ! score) return;
			
			return score.homeTeam === team.$id && score.home > score.away ? score.home + '-' + score.away : score.away + '-' + score.home;
		};
		$scope.getOpponent = function (team, score) {
			if ( ! score) return;
			
			return $scope.$teams.$getRecord(score.homeTeam === team.$id ? score.awayTeam : score.homeTeam);
		};
		
		$scope.editScore = function (score) {
			var scope = $scope.$new();
			scope.score = score.$id ? $firebaseHelper.object($scope.$scores, score.$id) : angular.copy(score);
			
			scope.deleteScore = function (score, skipConfirm) {
				var deferred = $q.defer();
				if (skipConfirm || confirm('Are you sure you want to permanently delete this score?')) {
					return $scope.$scores.$remove($scope.$scores.$getRecord(score.$id)).then(function () {
						$mdDialog.hide();
						
						deferred.resolve();
					});
				} else {
					deferred.reject();
				}
				return deferred.promise;
			};
			$mdDialogForm.show({
				scope:      scope,
				contentUrl: 'views/template/score.html',
				onSubmit:   function (scope) {
					if (scope.score.$save) {
						return scope.score.$save();
					} else {
						return $scope.$scores.$add(scope.score);
					}
				},
			});
		};
		$scope.editTeam = function (team) {
			var scope = $scope.$new();
			scope.team = team.$id ? $firebaseHelper.object($scope.$teams, team.$id) : angular.copy(team);
			
			scope.deleteTeam = function (team, skipConfirm) {
				var deferred = $q.defer();
				if (skipConfirm || confirm('Are you sure you want to permanently delete this team?')) {
					return $scope.$teams.$remove($scope.$teams.$getRecord(team.$id)).then(function () {
						$mdDialog.hide();
						
						deferred.resolve();
					});
				} else {
					deferred.reject();
				}
				return deferred.promise;
			};
			$mdDialogForm.show({
				scope:      scope,
				contentUrl: 'views/template/team.html',
				onSubmit:   function (team) {
					if (scope.team.$save) {
						return scope.team.$save();
					} else {
						return $scope.$teams.$add(scope.team);
					}
				},
			});
		};
	})
	.controller('AdminCtrl', function ($scope, $state, $firebaseHelper) {
		$scope.$teams  = $firebaseHelper.array('teams');
		$scope.$games  = $firebaseHelper.array('games');
		$scope.$scores = $firebaseHelper.array('scores');
	})
	
	.factory('$mdDialogForm', function ($mdDialog, $q) {
		return {
			show: function (options) {
				return $mdDialog.show($mdDialog.confirm(angular.extend({
					ok:            'Submit',
					cancel:        'Cancel',
					template:      [
						'<md-dialog ng-form="dialogForm" md-theme="{{ dialog.theme }}" aria-label="{{ dialog.ariaLabel }}">',
							'<md-dialog-content role="document" tabIndex="-1">',
								'<h2 class="md-title">{{ dialog.title }}</h2>',
								'<p ng-if="dialog.content">{{ dialog.content }}</p>',
								'<div ng-if="dialog.contentUrl" ng-include="dialog.contentUrl"></div>',
							'</md-dialog-content>',
							'<div class="md-actions">',
								'<md-button ng-if="dialog.$type == \'confirm\'" ng-click="dialog.abort()">',
									'{{ dialog.cancel }}',
								'</md-button>',
								'<md-button ng-disabled="dialogForm.$invalid || dialog.loading" ng-click="dialog.startLoading(); dialog.onSubmit(this).then(dialog.hide).finally(dialog.stopLoading)" class="md-primary">',
									'{{ dialog.ok }}',
								'</md-button>',
							'</div>',
						'</md-dialog>'
					].join(''),
					onSubmit:      function onSubmit (scope) {
						var deferred = $q.defer();
						
						deferred.resolve();
						
						return deferred.promise;
					},
				}, options || {})));
			},
		};
	})
	
	
	.filter('length', function () {
		return function (array) {
			if (angular.isArray(array)) return array.length;
			if (angular.isObject(array)) return Object.keys(array).length;
			return 0;
		};
	})
	.directive('loading', function () {
		return {
			restrict: 'E',
			replace: true,
			template: ['<div flex layout="column" layout-align="center center">',
				'<md-progress-circular md-mode="indeterminate"></md-progress-circular>',
			'</div>'].join(''),
		}
	});