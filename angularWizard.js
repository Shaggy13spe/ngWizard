(function() {
  'use strict';

  angular
    .module('ngWizard')
    .directive('angularWizard', angularWizardDirective)
    .directive('angularWizardFrame', angularWizardFrameDirective)
    .animation('.item', ['$animateCss', angularWizardAnimation]);
  
  /*@ngInject*/
  function angularWizardAnimation($animateCss) {
    var SLIDE_DIRECTION = 'angular-wizard-slideDirection';

    function removeClass(element, className, callback) {
      element.removeClass(className);
      if(callback)
        callback();
    }

    return {
      beforeAddClass: function(element, className, done) {
        if(className === 'active') {
          var stopped = false;
          var direction = element.data(SLIDE_DIRECTION);
          var directionClass = direction === 'next' ? 'left' : 'right';
          var removeClassFn = removeClass.bind(this, element, directionClass + ' ' + direction, done);

          element.addClass(direction);
          $animateCss(element, { addClass: directionClass })
            .start()
            .done(removeClassFn);

          return function() {
            stopped = true;
          };
        }
        done();
      },
      beforeRemoveClass: function(element, className, done) {
        if(className === 'active') {
          var stopped = false;
          var direction = element.data(SLIDE_DIRECTION);
          var directionClass = direction === 'next' ? 'left' : 'right';
          var removeClassFn = removeClass.bind(this, element, directionClass, done);

          $animateCss(element, { addClass: directionClass })
            .start()
            .done(removeClassFn);

          return function() {
            stopped = true;
          };
        }
        done();
      }
    };
  }

  function angularWizardDirective() {
    return {
      restrict: 'AE',
      transclude: true,
      replace: true,
      templateUrl: '/templates/angularWizard/angularWizard.html',
      scope: {
        active: '=',
        beforeNext: '=',
        onFinish: '='
      },
      controller: AngularWizardController,
      controllerAs: 'vm'
    };
  }
  /*@ngInject*/
  function AngularWizardController($scope, $element, $animate) {
    var vm = this;
    var frames = vm.frames = $scope.frames = [];
    var SLIDE_DIRECTION = 'angular-wizard-slideDirection';
    var currentIndex = $scope.active;
    var bufferedTransitions = [];
    
    var destroyed = false;

    vm.addFrame = function(frame, element) {
      frames.push({
        frame: frame,
        element: element
      });
      frames.sort(function(a, b) {
        return +a.frame.index - +b.frame.index;
      });
      //if this is the first frame or the frame is set to active, select it
      if(frame.index === $scope.active || frames.length === 1 && !angular.isNumber($scope.active)) {
        if($scope.$currentTransition) 
          $scope.$currentTransition = null;

        currentIndex = frame.index;
        $scope.active = frame.index;
        setActive(currentIndex);
        vm.select(frames[findFrameIndex(frame)]);
      }
    };

    vm.getCurrentIndex = function() {
      for(var i = 0; i < frames.length; i++) {
        if(frames[i].frame.index === currentIndex)
          return i;
      }
    };

    vm.next = $scope.next = function() {
      if(!$scope.beforeNext || $scope.beforeNext()) {
        var newIndex = (vm.getCurrentIndex() + 1) % frames.length;

        return vm.select(frames[newIndex], 'next');
      }
    };

    vm.prev = $scope.prev = function() {
      if(vm.getCurrentIndex() === 0) return;
      
      var newIndex = vm.getCurrentIndex() - 1 < 0 ? frames.length - 1 : vm.getCurrentIndex() - 1;

      return vm.select(frames[newIndex], 'prev');
    };

    vm.finish = $scope.finish = function() {
      if($scope.onFinish)
        $scope.onFinish();
    };

    vm.removeFrame = function(frame) {
      var index = findFrameIndex(frame);
      var bufferedIndex = bufferedTransitions.indexOf(frames[index]);
      
      if(bufferedIndex !== -1) 
        bufferedTransitions.splice(bufferedIndex, 1);

      //get the index of the frame inside the carousel
      frames.splice(index, 1);
      if (frames.length > 0 && currentIndex === index) {
        if (index >= frames.length) {
          currentIndex = frames.length - 1;
          $scope.active = currentIndex;
          setActive(currentIndex);
          vm.select(frames[frames.length - 1]);
        } 
        else {
          currentIndex = index;
          $scope.active = currentIndex;
          setActive(currentIndex);
          vm.select(frames[index]);
        }
      } 
      else if (currentIndex > index) {
        currentIndex--;
        $scope.active = currentIndex;
      }

      //clean the active value when no more frame
      if (frames.length === 0) {
        currentIndex = null;
        $scope.active = null;
        clearBufferedTransitions();
      }
    };

    /* direction: "prev" or "next" */
    vm.select = $scope.select = function(nextFrame, direction) {
      var nextIndex = findFrameIndex(nextFrame.frame);
      //Decide direction if it's not given
      if(angular.isUndefined(direction)) {
        direction = nextIndex > vm.getCurrentIndex() ? 'next' : 'prev';
      }
      //Prevent this user-triggered transition from occurring if there is already one in progress
      if(nextFrame.frame.index !== currentIndex &&
        !$scope.$currentTransition) {
        goNext(nextFrame.frame, nextIndex, direction);
      } 
      else if(nextFrame && nextFrame.frame.index !== currentIndex && $scope.$currentTransition) {
        bufferedTransitions.push(frames[nextIndex]);
      }
    };

    $scope.indexOfFrame = function(frame) {
      return +frame.frame.index;
    };

    $scope.isActive = function(frame) {
      return $scope.active === frame.frame.index;
    };

    $scope.isPrevDisabled = function() {
      return $scope.active === 0;
    };

    $scope.isNextDisabled = function() {
      return $scope.active === frames.length - 1;
    };

    $scope.$on('$destroy', function() {
      destroyed = true;
    });

    $scope.$watch('noTransition', function(noTransition) {
      $animate.enabled($element, !noTransition);
    });

    $scope.$watchCollection('frames', resetTransition);

    $scope.$watch('active', function(index) {
      if (angular.isNumber(index) && currentIndex !== index) {
        for (var i = 0; i < frames.length; i++) {
          if (frames[i].frame.index === index) {
            index = i;
            break;
          }
        }

        var frame = frames[index];
        if (frame) {
          setActive(index);
          vm.select(frames[index]);
          currentIndex = index;
        }
      }
    });

    function clearBufferedTransitions() {
      while (bufferedTransitions.length) {
        bufferedTransitions.shift();
      }
    }

    function getFrameByIndex(index) {
      for (var i = 0, l = frames.length; i < l; ++i) {
        if (frames[i].index === index) {
          return frames[i];
        }
      }
    }

    function setActive(index) {
      for (var i = 0; i < frames.length; i++) {
        frames[i].frame.active = i === index;
      }
    }

    function goNext(frame, index, direction) {
      if (destroyed) {
        return;
      }

      angular.extend(frame, { direction: direction });
      angular.extend(frames[currentIndex].frame || {}, { direction: direction });
      if ($animate.enabled($element) && !$scope.$currentTransition &&
      frames[index].element && vm.frames.length > 1) {
        frames[index].element.data(SLIDE_DIRECTION, frame.direction);
        var currentIdx = vm.getCurrentIndex();

        if (angular.isNumber(currentIdx) && frames[currentIdx].element) {
          frames[currentIdx].element.data(SLIDE_DIRECTION, frame.direction);
        }

        $scope.$currentTransition = true;
        $animate.on('addClass', frames[index].element, function(element, phase) {
          if (phase === 'close') {
            $scope.$currentTransition = null;
            $animate.off('addClass', element);
            if (bufferedTransitions.length) {
              var nextFrame = bufferedTransitions.pop().frame;
              var nextIndex = nextFrame.index;
              var nextDirection = nextIndex > vm.getCurrentIndex() ? 'next' : 'prev';
              clearBufferedTransitions();

              goNext(nextFrame, nextIndex, nextDirection);
            }
          }
        });
      }

      $scope.active = frame.index;
      currentIndex = frame.index;
      setActive(index);

    }

    function findFrameIndex(frame) {
      for (var i = 0; i < frames.length; i++) {
        if (frames[i].frame === frame) {
          return i;
        }
      }
    }

    function resetTransition(frames) {
      if (!frames.length) {
        $scope.$currentTransition = null;
        clearBufferedTransitions();
      }
    }

  }
 
  function angularWizardFrameDirective() {
    return {
      require: '^angularWizard',
      transclude: true,
      replace: true,
      templateUrl: function(element, attrs) {
        return attrs.templateUrl || '/templates/angularWizard/angularWizardFrame.html';
      },
      scope: {
        actual: '=?',
        index: '=?'
      },
      link: function(scope, element, attrs, wizardCtrl) {
        wizardCtrl.addFrame(scope, element);
              //when the scope is destroyed, then remove the frame from the current frames array
        scope.$on('$destroy', function() {
          wizardCtrl.removeFrame(scope);
        });
      }
    };
  }

})();

