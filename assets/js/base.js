angular.module('casa-capp', ['ui.router', 'ngMaterial', 'firebaseHelper'])
	
	.config(["$locationProvider", "$urlRouterProvider", "$stateProvider", "$firebaseHelperProvider", function ($locationProvider, $urlRouterProvider, $stateProvider, $firebaseHelperProvider) {
		// routing
		$locationProvider.html5Mode(true);
		$urlRouterProvider.when('', '/');
		$stateProvider
			// pages
			.state('home', {
				url: '/',
				templateUrl: 'views/page/home.html',
				controller: 'HomeCtrl',
			});
		
		// data
		$firebaseHelperProvider.namespace('casa-capp');
	}])
	
	.factory('Auth', ["$rootScope", "$firebaseHelper", "$state", "$q", "$timeout", function ($rootScope, $firebaseHelper, $state, $q, $timeout) {
		var Auth = $firebaseHelper.auth();
		
		$rootScope.$me = {};
		Auth.$onAuth(function (authData) {
			if (authData) {
				// logging in
				var meRef      = $firebaseHelper.ref('data/users/' + authData.uid);
				$rootScope.$me = $firebaseHelper.object(meRef);
				
				// presence
				$firebaseHelper.ref('.info/connected').on('value', function (snap) {
					if (snap.val()) {
						meRef.child('online').onDisconnect().set(moment().format());
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
	}])
	.controller('AppCtrl', ["$rootScope", "$state", "$firebaseHelper", "Auth", function ($rootScope, $state, $firebaseHelper, Auth) {
		$rootScope.loaded          = true;
		$rootScope.$state          = $state;
		$rootScope.$firebaseHelper = $firebaseHelper;
	}])
	.controller('HomeCtrl', ["$scope", "$state", "$firebaseHelper", function ($scope, $state, $firebaseHelper) {
		$scope.$teams  = $firebaseHelper.array('teams');
		$scope.$games  = $firebaseHelper.array('games');
		$scope.$scores = $firebaseHelper.array('scores');
		
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
	}])
	
	
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