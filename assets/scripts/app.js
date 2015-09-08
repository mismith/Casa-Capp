angular.module('casa-capp', ['ui.router', 'ngMaterial', 'firebaseHelper'])
	
	.config(function ($locationProvider, $urlRouterProvider, $stateProvider, $firebaseHelperProvider) {
		// routing
		$locationProvider.html5Mode(true);
		$urlRouterProvider.when('', '/');
		$stateProvider
			// pages
			.state('home', {
				url: '/',
				templateUrl: 'views/page/home.html',
				controller: 'HomeCtrl',
			})
			.state('admin', {
				url: '/admin',
				templateUrl: 'views/page/admin.html',
				controller: 'AdminCtrl',
			});
		
		// data
		$firebaseHelperProvider.namespace('casa-capp');
	})
	
	.factory('Auth', function ($rootScope, $firebaseHelper, $state, $q, $timeout) {
		var Auth = $firebaseHelper.auth();
		
		$rootScope.$me = {};
		Auth.$onAuth(function (authData) {
			if (authData) {
				// logging in
				var meRef      = $firebaseHelper.ref('users/' + authData.uid);
				$rootScope.$me = $firebaseHelper.object(meRef);
				
				// presence
				$firebaseHelper.ref('.info/connected').on('value', function (snap) {
					if (snap.val()) {
						meRef.child('online').onDisconnect().set((new Date).toISOString());
						meRef.child('online').set(true);
					}
				});
				
				// info
				meRef.update(authData); // update it w/ any changes since last login
				
				// don't show login screen
				if ($state.current.name === 'home') {
					$state.reload();
				}
			} else {
				// page loaded or refreshed while not logged in, or logging out
				if ($rootScope.$me && $rootScope.$me.$id) {
					$rootScope.$me.$ref().child('online').set((new Date).toISOString());
				}
				$rootScope.$me = {};
			}
		});
		Auth.$waitForMe = function () {
			var deferred = $q.defer();
			
			Auth.$waitForAuth().then(function (authData) {
				$timeout(function () {
					deferred.resolve($rootScope.$me);
				});
			});
			
			return deferred.promise;
		};
		
		$rootScope.$auth = Auth.$auth = function () {
			return $q.when(Auth.$getAuth() || Auth['$authWithOAuth' + ($rootScope.isMobile ? 'Redirect' : 'Popup')]('facebook', {scope: 'email'}));
		};
		$rootScope.$unauth = Auth.$unauth;
		
		return Auth;
	})
	.controller('AppCtrl', function ($rootScope, $state, $firebaseHelper, Auth) {
		$rootScope.loaded          = true;
		$rootScope.$state          = $state;
		$rootScope.$firebaseHelper = $firebaseHelper;
		
		$rootScope.permission = function () {
			return !! $rootScope.$me.$id;
		};
	})
	.controller('HomeCtrl', function ($scope, $state, $firebaseHelper, $mdDialogForm, $q) {
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